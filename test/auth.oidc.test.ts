import { describe, it, expect } from 'vitest'
import { createServer } from 'node:http'
import { generateKeyPair, exportJWK, SignJWT, calculateJwkThumbprint } from 'jose'
import { createTestApp, makeConfig } from './helpers.js'

interface FakeIdp {
  url: string
  sign(claims: { sub: string; email?: string; role?: string; scope?: string }): Promise<string>
  close(): void
}

async function startFakeIdp(issuer: string, audience: string): Promise<FakeIdp> {
  const { privateKey, publicKey } = await generateKeyPair('RS256')
  const jwkPublic = await exportJWK(publicKey)
  const kid = await calculateJwkThumbprint(jwkPublic)

  const server = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json')
    if (req.url === '/.well-known/openid-configuration') {
      res.end(JSON.stringify({ jwks_uri: `${issuer}/jwks` }))
    } else if (req.url === '/jwks') {
      res.end(JSON.stringify({ keys: [{ ...jwkPublic, kid, alg: 'RS256', use: 'sig' }] }))
    } else {
      res.statusCode = 404
      res.end('{}')
    }
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const addr = server.address() as { port: number }
  const baseUrl = `http://127.0.0.1:${addr.port}`

  return {
    url: baseUrl,
    async sign(claims) {
      const now = Math.floor(Date.now() / 1000)
      return new SignJWT({
        email: claims.email,
        role: claims.role ?? 'user',
        scope: claims.scope ?? 'notes:read notes:write',
        realm_access: claims.role === 'admin' ? { roles: ['admin'] } : { roles: ['user'] },
      })
        .setProtectedHeader({ alg: 'RS256', kid })
        .setIssuer(issuer)
        .setAudience(audience)
        .setSubject(claims.sub)
        .setIssuedAt(now)
        .setNotBefore(now)
        .setExpirationTime(now + 3600)
        .sign(privateKey)
    },
    close() {
      server.close()
    },
  }
}

describe('OIDC mode', () => {
  it('valid OIDC token → /me returns 200', async () => {
    const idp = await startFakeIdp('test-oidc-issuer', 'test-audience')
    const { app } = await createTestApp({
      authMode: 'oidc',
      jwtIssuer: 'test-oidc-issuer',
      jwtAudience: 'test-audience',
      oidcJwksUrl: `${idp.url}/jwks`,
    })
    const token = await idp.sign({ sub: 'oidc-user-1', email: 'oidc@test.com' })
    const res = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().sub).toBe('oidc-user-1')
    idp.close()
    await app.close()
  })

  it('realm_access.roles=admin → role is admin', async () => {
    const idp = await startFakeIdp('issuer-admin', 'aud-admin')
    const { app } = await createTestApp({
      authMode: 'oidc',
      jwtIssuer: 'issuer-admin',
      jwtAudience: 'aud-admin',
      oidcJwksUrl: `${idp.url}/jwks`,
    })
    const token = await idp.sign({ sub: 'admin-user', role: 'admin' })
    const res = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().role).toBe('admin')
    idp.close()
    await app.close()
  })

  it('wrong issuer → 401', async () => {
    const idp = await startFakeIdp('wrong-issuer', 'test-aud')
    const { app } = await createTestApp({
      authMode: 'oidc',
      jwtIssuer: 'expected-issuer',
      jwtAudience: 'test-aud',
      oidcJwksUrl: `${idp.url}/jwks`,
    })
    const token = await idp.sign({ sub: 'u1' })
    const res = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(401)
    idp.close()
    await app.close()
  })

  it('IdP unavailable → 503', async () => {
    const { app } = await createTestApp({
      authMode: 'oidc',
      jwtIssuer: 'http://127.0.0.1:19999/realms/notes',
      jwtAudience: 'notes-api',
      oidcJwksUrl: 'http://127.0.0.1:19999/jwks',
    })
    // Sign a syntactically valid JWT manually (we just need it to parse headers so JWKS is fetched)
    const { privateKey: tmpKey } = await generateKeyPair('RS256')
    const token = await new SignJWT({ role: 'user', scope: 'notes:read' })
      .setProtectedHeader({ alg: 'RS256', kid: 'x' })
      .setIssuer('http://127.0.0.1:19999/realms/notes')
      .setAudience('notes-api')
      .setSubject('u1')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(tmpKey)
    const res = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(503)
    expect(res.json().error).toBe('idp_unavailable')
    await app.close()
  })

  it('POST /auth/register in OIDC mode → 404', async () => {
    const { app } = await createTestApp({ authMode: 'oidc', jwtIssuer: 'https://idp.test' })
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'x@x.com', password: 'password123' },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })
})

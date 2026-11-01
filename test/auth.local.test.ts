import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { generateKeyPair, exportPKCS8, exportSPKI } from 'jose'
import { createTestApp, makeConfig } from './helpers.js'
import type { FastifyInstance } from 'fastify'

describe('POST /auth/register', () => {
  it('creates user and returns 201', async () => {
    const { app } = await createTestApp()
    const res = await app.inject({
      method: 'POST', url: '/auth/register',
      payload: { email: 'alice@example.com', password: 'password123' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.email).toBe('alice@example.com')
    expect(body.role).toBe('user')
    expect(body.id).toBeDefined()
    await app.close()
  })

  it('normalises email to lowercase', async () => {
    const { app } = await createTestApp()
    const res = await app.inject({
      method: 'POST', url: '/auth/register',
      payload: { email: 'Alice@Example.COM', password: 'password123' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().email).toBe('alice@example.com')
    await app.close()
  })

  it('duplicate email → 409', async () => {
    const { app } = await createTestApp()
    const payload = { email: 'dup@example.com', password: 'password123' }
    await app.inject({ method: 'POST', url: '/auth/register', payload })
    const res = await app.inject({ method: 'POST', url: '/auth/register', payload })
    expect(res.statusCode).toBe(409)
    expect(res.json().error).toBe('conflict')
    await app.close()
  })

  it('short password → 400', async () => {
    const { app } = await createTestApp()
    const res = await app.inject({
      method: 'POST', url: '/auth/register',
      payload: { email: 'b@example.com', password: 'short' },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('password_hash in DB starts with $argon2id$', async () => {
    const { app, db } = await createTestApp()
    await app.inject({
      method: 'POST', url: '/auth/register',
      payload: { email: 'c@example.com', password: 'password123' },
    })
    const row = db.prepare('SELECT password_hash FROM users WHERE email = ?').get('c@example.com') as { password_hash: string }
    expect(row.password_hash).toMatch(/^\$argon2id\$/)
    await app.close()
  })

  it('returns 404 in OIDC mode', async () => {
    const { app } = await createTestApp({ authMode: 'oidc', jwtIssuer: 'https://idp.test' })
    const res = await app.inject({
      method: 'POST', url: '/auth/register',
      payload: { email: 'x@x.com', password: 'password123' },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })
})

describe('POST /auth/token', () => {
  it('valid credentials → 200 with access_token', async () => {
    const { app } = await createTestApp()
    await app.inject({
      method: 'POST', url: '/auth/register',
      payload: { email: 'login@example.com', password: 'password123' },
    })
    const res = await app.inject({
      method: 'POST', url: '/auth/token',
      payload: { email: 'login@example.com', password: 'password123' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.access_token).toBeDefined()
    expect(body.token_type).toBe('Bearer')
    expect(body.expires_in).toBe(3600)
    await app.close()
  })

  it('wrong password → 401 with same body as unknown email', async () => {
    const { app } = await createTestApp()
    await app.inject({
      method: 'POST', url: '/auth/register',
      payload: { email: 'pw@example.com', password: 'correctpass123' },
    })
    const resWrongPw = await app.inject({
      method: 'POST', url: '/auth/token',
      payload: { email: 'pw@example.com', password: 'wrongpass' },
    })
    const resUnknown = await app.inject({
      method: 'POST', url: '/auth/token',
      payload: { email: 'nobody@example.com', password: 'anything' },
    })
    expect(resWrongPw.statusCode).toBe(401)
    expect(resUnknown.statusCode).toBe(401)
    expect(resWrongPw.json()).toEqual(resUnknown.json())
    await app.close()
  })
})

describe('Token validation', () => {
  it('no Authorization header → 401 with WWW-Authenticate', async () => {
    const { app } = await createTestApp()
    const res = await app.inject({ method: 'GET', url: '/me' })
    expect(res.statusCode).toBe(401)
    expect(res.headers['www-authenticate']).toBe('Bearer')
    await app.close()
  })

  it('Basic scheme → 401', async () => {
    const { app } = await createTestApp()
    const res = await app.inject({
      method: 'GET', url: '/me',
      headers: { authorization: 'Basic dXNlcjpwYXNz' },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('invalid token → 401', async () => {
    const { app } = await createTestApp()
    const res = await app.inject({
      method: 'GET', url: '/me',
      headers: { authorization: 'Bearer notavalidtoken' },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('wrong secret → 401', async () => {
    const { app: app1, jwtSigner: signer1 } = await createTestApp()
    const { app: app2 } = await createTestApp({ jwtSecret: 'other-secret-must-be-at-least-32-chars!!' })
    const token = await signer1.sign({ sub: 'user1', role: 'user', scopes: ['notes:read', 'notes:write'] })
    const res = await app2.inject({
      method: 'GET', url: '/me',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(401)
    await Promise.all([app1.close(), app2.close()])
  })

  it('expired token → 401', async () => {
    const { app } = await createTestApp({ jwtTtlSeconds: -1 })
    // Register + login with -1 TTL to get an already-expired token
    await app.inject({
      method: 'POST', url: '/auth/register',
      payload: { email: 'exp@example.com', password: 'password123' },
    })
    const tokenRes = await app.inject({
      method: 'POST', url: '/auth/token',
      payload: { email: 'exp@example.com', password: 'password123' },
    })
    // TTL=-1 means already expired
    const token = tokenRes.json().access_token as string
    const res = await app.inject({
      method: 'GET', url: '/me',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('wrong issuer → 401', async () => {
    const { app: app1, jwtSigner } = await createTestApp({ jwtIssuer: 'issuer-a' })
    const { app: app2 } = await createTestApp({ jwtIssuer: 'issuer-b' })
    const token = await jwtSigner.sign({ sub: 'u1', role: 'user', scopes: ['notes:read'] })
    const res = await app2.inject({
      method: 'GET', url: '/me',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(401)
    await Promise.all([app1.close(), app2.close()])
  })

  it('wrong audience → 401', async () => {
    const { app: app1, jwtSigner } = await createTestApp({ jwtAudience: 'aud-a' })
    const { app: app2 } = await createTestApp({ jwtAudience: 'aud-b' })
    const token = await jwtSigner.sign({ sub: 'u1', role: 'user', scopes: ['notes:read'] })
    const res = await app2.inject({
      method: 'GET', url: '/me',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(401)
    await Promise.all([app1.close(), app2.close()])
  })

  it('token without required scope → 403', async () => {
    const { app, jwtSigner } = await createTestApp()
    const token = await jwtSigner.sign({ sub: 'u1', role: 'user', scopes: [] })
    const res = await app.inject({
      method: 'GET', url: '/notes',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error).toBe('forbidden')
    await app.close()
  })
})

describe('RS256 local mode', () => {
  it('/.well-known/jwks.json returns public key and issued token validates', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256')
    const privateKeyPem = await exportPKCS8(privateKey)
    const publicKeyPem = await exportSPKI(publicKey)

    const { app } = await createTestApp({
      jwtAlg: 'RS256',
      jwtPrivateKey: privateKeyPem,
      jwtPublicKey: publicKeyPem,
      jwtSecret: undefined,
    })

    const jwksRes = await app.inject({ method: 'GET', url: '/.well-known/jwks.json' })
    expect(jwksRes.statusCode).toBe(200)
    const { keys } = jwksRes.json() as { keys: unknown[] }
    expect(keys.length).toBe(1)

    await app.inject({
      method: 'POST', url: '/auth/register',
      payload: { email: 'rs@example.com', password: 'password123' },
    })
    const tokenRes = await app.inject({
      method: 'POST', url: '/auth/token',
      payload: { email: 'rs@example.com', password: 'password123' },
    })
    expect(tokenRes.statusCode).toBe(200)
    const meRes = await app.inject({
      method: 'GET', url: '/me',
      headers: { authorization: `Bearer ${tokenRes.json().access_token}` },
    })
    expect(meRes.statusCode).toBe(200)
    await app.close()
  })

  it('HS256 token sent to RS256 app → 401', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256')
    const privateKeyPem = await exportPKCS8(privateKey)
    const publicKeyPem = await exportSPKI(publicKey)
    const { app: hs256app, jwtSigner: hs256signer } = await createTestApp()
    const { app: rs256app } = await createTestApp({
      jwtAlg: 'RS256', jwtPrivateKey: privateKeyPem, jwtPublicKey: publicKeyPem, jwtSecret: undefined,
    })
    const token = await hs256signer.sign({ sub: 'u1', role: 'user', scopes: ['notes:read'] })
    const res = await rs256app.inject({
      method: 'GET', url: '/me',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(401)
    await Promise.all([hs256app.close(), rs256app.close()])
  })
})

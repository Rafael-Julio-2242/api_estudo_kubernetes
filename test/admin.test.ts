import { describe, it, expect } from 'vitest'
import { createTestApp } from './helpers.js'

async function getAdminToken(app: Awaited<ReturnType<typeof createTestApp>>['app'], jwtSigner: Awaited<ReturnType<typeof createTestApp>>['jwtSigner']) {
  return jwtSigner.sign({ sub: 'admin-1', role: 'admin', scopes: ['notes:read', 'notes:write', 'admin:read'] })
}

async function getUserToken(app: Awaited<ReturnType<typeof createTestApp>>['app'], jwtSigner: Awaited<ReturnType<typeof createTestApp>>['jwtSigner']) {
  return jwtSigner.sign({ sub: 'user-1', role: 'user', scopes: ['notes:read', 'notes:write'] })
}

describe('GET /admin/stats', () => {
  it('admin token → 200 with counts', async () => {
    const { app, jwtSigner } = await createTestApp()
    const token = await getAdminToken(app, jwtSigner)
    const res = await app.inject({
      method: 'GET', url: '/admin/stats',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(typeof body.users).toBe('number')
    expect(typeof body.notes).toBe('number')
    await app.close()
  })

  it('user token → 403', async () => {
    const { app, jwtSigner } = await createTestApp()
    const token = await getUserToken(app, jwtSigner)
    const res = await app.inject({
      method: 'GET', url: '/admin/stats',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('OIDC mode → users is null', async () => {
    const { app, jwtSigner } = await createTestApp({ authMode: 'oidc', jwtIssuer: 'https://idp.test' })
    const token = await getAdminToken(app, jwtSigner)
    const res = await app.inject({
      method: 'GET', url: '/admin/stats',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().users).toBeNull()
    await app.close()
  })
})

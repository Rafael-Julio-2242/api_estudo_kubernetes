import { describe, it, expect } from 'vitest'
import { createTestApp } from './helpers.js'

async function registerAndLogin(app: Awaited<ReturnType<typeof createTestApp>>['app'], email: string) {
  await app.inject({
    method: 'POST', url: '/auth/register',
    payload: { email, password: 'password123' },
  })
  const res = await app.inject({
    method: 'POST', url: '/auth/token',
    payload: { email, password: 'password123' },
  })
  return res.json().access_token as string
}

describe('Notes CRUD', () => {
  it('POST /notes creates note (201)', async () => {
    const { app } = await createTestApp()
    const token = await registerAndLogin(app, 'a@example.com')
    const res = await app.inject({
      method: 'POST', url: '/notes',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Hello', content: 'World' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.id).toBeDefined()
    expect(body.title).toBe('Hello')
    expect(body.content).toBe('World')
    expect(body.created_at).toBeDefined()
    await app.close()
  })

  it('GET /notes returns only caller notes, newest first', async () => {
    const { app } = await createTestApp()
    const tokenA = await registerAndLogin(app, 'na@example.com')
    const tokenB = await registerAndLogin(app, 'nb@example.com')

    await app.inject({
      method: 'POST', url: '/notes', headers: { authorization: `Bearer ${tokenA}` },
      payload: { title: 'A-1', content: 'x' },
    })
    await app.inject({
      method: 'POST', url: '/notes', headers: { authorization: `Bearer ${tokenB}` },
      payload: { title: 'B-1', content: 'x' },
    })
    await app.inject({
      method: 'POST', url: '/notes', headers: { authorization: `Bearer ${tokenA}` },
      payload: { title: 'A-2', content: 'x' },
    })

    const res = await app.inject({
      method: 'GET', url: '/notes', headers: { authorization: `Bearer ${tokenA}` },
    })
    expect(res.statusCode).toBe(200)
    const notes = res.json() as Array<{ title: string }>
    expect(notes.map((n) => n.title)).toEqual(['A-2', 'A-1'])
    await app.close()
  })

  it('GET /notes/:id returns 404 for other user note', async () => {
    const { app } = await createTestApp()
    const tokenA = await registerAndLogin(app, 'oa@example.com')
    const tokenB = await registerAndLogin(app, 'ob@example.com')
    const createRes = await app.inject({
      method: 'POST', url: '/notes', headers: { authorization: `Bearer ${tokenA}` },
      payload: { title: 'secret', content: 'private' },
    })
    const { id } = createRes.json() as { id: string }
    const res = await app.inject({
      method: 'GET', url: `/notes/${id}`, headers: { authorization: `Bearer ${tokenB}` },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('DELETE /notes/:id returns 204 and note is gone', async () => {
    const { app } = await createTestApp()
    const token = await registerAndLogin(app, 'del@example.com')
    const createRes = await app.inject({
      method: 'POST', url: '/notes', headers: { authorization: `Bearer ${token}` },
      payload: { title: 'bye', content: 'gone' },
    })
    const { id } = createRes.json() as { id: string }
    const delRes = await app.inject({
      method: 'DELETE', url: `/notes/${id}`, headers: { authorization: `Bearer ${token}` },
    })
    expect(delRes.statusCode).toBe(204)
    const getRes = await app.inject({
      method: 'GET', url: `/notes/${id}`, headers: { authorization: `Bearer ${token}` },
    })
    expect(getRes.statusCode).toBe(404)
    await app.close()
  })

  it('POST /notes title too short → 400', async () => {
    const { app } = await createTestApp()
    const token = await registerAndLogin(app, 'v@example.com')
    const res = await app.inject({
      method: 'POST', url: '/notes', headers: { authorization: `Bearer ${token}` },
      payload: { title: '', content: 'x' },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('POST /notes content too long → 400', async () => {
    const { app } = await createTestApp()
    const token = await registerAndLogin(app, 'vl@example.com')
    const res = await app.inject({
      method: 'POST', url: '/notes', headers: { authorization: `Bearer ${token}` },
      payload: { title: 'ok', content: 'x'.repeat(10001) },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })
})

import { describe, it, expect } from 'vitest'
import { createTestApp } from './helpers.js'

describe('GET /health/live', () => {
  it('returns 200 { status: ok }', async () => {
    const { app } = await createTestApp()
    const res = await app.inject({ method: 'GET', url: '/health/live' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ok' })
    await app.close()
  })
})

describe('GET /health/ready', () => {
  it('returns 200 when DB is healthy', async () => {
    const { app } = await createTestApp()
    const res = await app.inject({ method: 'GET', url: '/health/ready' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ok', checks: { database: 'ok' } })
    await app.close()
  })

  it('returns 503 when shuttingDown=true', async () => {
    const { app, shuttingDown } = await createTestApp()
    shuttingDown.value = true
    const res = await app.inject({ method: 'GET', url: '/health/ready' })
    expect(res.statusCode).toBe(503)
    await app.close()
  })
})

describe('GET /version', () => {
  it('reflects config values', async () => {
    const { app } = await createTestApp({ appEnv: 'staging', gitSha: 'abc123' })
    const res = await app.inject({ method: 'GET', url: '/version' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.name).toBe('notes-api')
    expect(body.environment).toBe('staging')
    expect(body.git_sha).toBe('abc123')
    expect(body.auth_mode).toBe('local')
    expect(body.started_at).toBeDefined()
    await app.close()
  })
})

describe('Error handling', () => {
  it('unknown route → 404 with error format', async () => {
    const { app } = await createTestApp()
    const res = await app.inject({ method: 'GET', url: '/does-not-exist' })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ error: 'not_found' })
    await app.close()
  })
})

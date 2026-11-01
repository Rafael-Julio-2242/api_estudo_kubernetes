import { describe, it, expect } from 'vitest'
import { writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadConfig, ConfigError } from '../src/config.js'

const secret = 'a-valid-secret-must-be-at-least-32-chars!!'

describe('loadConfig', () => {
  it('returns defaults with minimal valid env (local+HS256)', () => {
    const c = loadConfig({ JWT_SECRET: secret })
    expect(c.port).toBe(8080)
    expect(c.host).toBe('0.0.0.0')
    expect(c.authMode).toBe('local')
    expect(c.logLevel).toBe('info')
    expect(c.jwtAlg).toBe('HS256')
    expect(c.jwtIssuer).toBe('notes-api')
    expect(c.jwtAudience).toBe('notes-api')
    expect(c.jwtTtlSeconds).toBe(3600)
    expect(c.shutdownDelaySeconds).toBe(0)
  })

  it('overrides defaults from env', () => {
    const c = loadConfig({ JWT_SECRET: secret, PORT: '9000', LOG_LEVEL: 'debug', APP_ENV: 'staging' })
    expect(c.port).toBe(9000)
    expect(c.logLevel).toBe('debug')
    expect(c.appEnv).toBe('staging')
  })

  it('JWT_SECRET too short → ConfigError', () => {
    expect(() => loadConfig({ JWT_SECRET: 'tooshort' })).toThrow(ConfigError)
  })

  it('AUTH_MODE=local + HS256 + no JWT_SECRET → ConfigError', () => {
    expect(() => loadConfig({})).toThrow(ConfigError)
  })

  it('AUTH_MODE=local + RS256 + no keys → ConfigError', () => {
    expect(() => loadConfig({ JWT_ALG: 'RS256' })).toThrow(ConfigError)
  })

  it('invalid AUTH_MODE → ConfigError', () => {
    expect(() => loadConfig({ AUTH_MODE: 'oauth', JWT_SECRET: secret })).toThrow(ConfigError)
  })

  it('_FILE variant takes priority over direct env var', () => {
    const tmpFile = join(tmpdir(), `notes-test-secret-${Date.now()}.txt`)
    writeFileSync(tmpFile, 'file-secret-must-be-32-plus-characters!!')
    try {
      const c = loadConfig({ JWT_SECRET: 'direct-ignored', JWT_SECRET_FILE: tmpFile })
      expect(c.jwtSecret).toBe('file-secret-must-be-32-plus-characters!!')
    } finally {
      rmSync(tmpFile)
    }
  })
})

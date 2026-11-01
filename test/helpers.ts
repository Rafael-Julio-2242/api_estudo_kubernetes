import type { Config } from '../src/config.js'
import { openDatabase } from '../src/db/connection.js'
import { runMigrations } from '../src/db/migrate.js'
import { buildApp } from '../src/app.js'
import { createJwtSigner } from '../src/auth/jwt.js'
import { createOidcSigner } from '../src/auth/oidc.js'
import { join } from 'node:path'

export const TEST_SECRET = 'test-secret-must-be-at-least-32-chars!!'

export function makeConfig(overrides: Partial<Config> = {}): Config {
  const base: Config = {
    appEnv: 'test',
    appVersion: '0.0.0',
    gitSha: 'test-sha',
    port: 0,
    host: '127.0.0.1',
    logLevel: 'error' as const,
    databasePath: ':memory:',
    shutdownDelaySeconds: 0,
    authMode: 'local',
    jwtIssuer: 'test-issuer',
    jwtAudience: 'test-audience',
    jwtAlg: 'HS256',
    jwtSecret: TEST_SECRET,
    jwtTtlSeconds: 3600,
  }

  // If overrides contain RS256, remove jwtSecret unless explicitly set
  if (overrides.jwtAlg === 'RS256' && overrides.jwtSecret === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { jwtSecret: _jwtSecret, ...baseWithoutSecret } = base
    return { ...baseWithoutSecret, ...overrides } as Config
  }

  return { ...base, ...overrides }
}

export async function createTestApp(overrides: Partial<Config> = {}) {
  const config = makeConfig(overrides)
  const db = openDatabase(':memory:')
  runMigrations(db, join(process.cwd(), 'migrations'))
  const jwtSigner =
    config.authMode === 'oidc' && config.oidcJwksUrl
      ? createOidcSigner(config)
      : await createJwtSigner(config)
  const shuttingDown = { value: false }
  const startedAt = new Date().toISOString()
  const authenticate = async (_request: unknown, _reply: unknown) => {
    // default no-op authenticate for tests (tasks requiring auth will override)
  }
  const app = await buildApp(config, { db, shuttingDown, startedAt, jwtSigner, authenticate })
  return { app, db, config, shuttingDown, jwtSigner }
}

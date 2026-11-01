import { loadConfig, ConfigError } from './config.js'
import { openDatabase } from './db/connection.js'
import { runMigrations } from './db/migrate.js'
import { buildApp } from './app.js'
import { createJwtSigner } from './auth/jwt.js'
import { createOidcSigner } from './auth/oidc.js'
import { createUser, findUserByEmail } from './services/users.js'
import { hashPassword } from './auth/password.js'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
// In dev (src/main.ts): ../migrations = root/migrations
// In prod (dist/main.js): ../migrations = root/migrations (run from project root)
const migrationsDir = join(__dirname, '..', 'migrations')

async function main(): Promise<void> {
  // 1. Config
  let config
  try {
    config = loadConfig()
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(err.message)
      process.exit(1)
    }
    throw err
  }

  // 2. Database
  const dbDir = dirname(config.databasePath === ':memory:' ? '/tmp/x' : config.databasePath)
  if (config.databasePath !== ':memory:') {
    mkdirSync(dbDir, { recursive: true })
  }

  let db
  try {
    db = openDatabase(config.databasePath)
    runMigrations(db, migrationsDir)
  } catch (err) {
    console.error('Database startup failed:', err)
    process.exit(1)
  }

  // 3. Optional: seed admin
  if (config.seedAdminEmail && config.seedAdminPassword && config.authMode === 'local') {
    const existing = findUserByEmail(db, config.seedAdminEmail.toLowerCase())
    if (!existing) {
      const passwordHash = await hashPassword(config.seedAdminPassword)
      createUser(db, { email: config.seedAdminEmail.toLowerCase(), passwordHash, role: 'admin' })
    }
  }

  // 4. JWT signer
  const jwtSigner =
    config.authMode === 'oidc' ? createOidcSigner(config) : await createJwtSigner(config)

  // 5. App
  const shuttingDown = { value: false }
  const startedAt = new Date().toISOString()
  const app = await buildApp(config, {
    db,
    shuttingDown,
    startedAt,
    jwtSigner,
    authenticate: async () => {}, // replaced inside buildApp
  })

  // 6. Graceful shutdown
  let shuttingDownCount = 0
  const shutdown = async (signal: string): Promise<void> => {
    shuttingDownCount++
    if (shuttingDownCount > 1) {
      app.log.warn({ signal }, 'Forced shutdown')
      process.exit(1)
    }

    app.log.info({ signal, delaySeconds: config.shutdownDelaySeconds }, 'Graceful shutdown started')
    shuttingDown.value = true

    const safetyTimeout = setTimeout(() => {
      app.log.error('Shutdown safety timeout exceeded, forcing exit')
      process.exit(1)
    }, 25_000)
    safetyTimeout.unref()

    if (config.shutdownDelaySeconds > 0) {
      await new Promise((r) => setTimeout(r, config.shutdownDelaySeconds * 1000))
    }

    try {
      await app.close()
    } finally {
      db.close()
    }
    clearTimeout(safetyTimeout)
    app.log.info('Shutdown complete')
    process.exit(0)
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))

  // 7. Listen
  try {
    await app.listen({ port: config.port, host: config.host })
  } catch (err) {
    app.log.error({ err }, 'Failed to start server')
    process.exit(1)
  }
}

void main()

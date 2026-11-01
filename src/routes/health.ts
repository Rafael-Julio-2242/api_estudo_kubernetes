import type { FastifyInstance } from 'fastify'
import type { AppDeps } from '../app.js'

export function registerHealthRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.get('/health/live', { logLevel: 'debug' }, async (_req, reply) => {
    await reply.send({ status: 'ok' })
  })

  app.get('/health/ready', { logLevel: 'debug' }, async (_req, reply) => {
    if (deps.shuttingDown.value) {
      await reply.status(503).send({ status: 'unavailable', checks: { database: 'shutdown' } })
      return
    }
    try {
      deps.db.prepare('SELECT 1').get()
      await reply.send({ status: 'ok', checks: { database: 'ok' } })
    } catch (err) {
      _req.log.error({ err }, 'Database health check failed')
      await reply.status(503).send({ status: 'unavailable', checks: { database: 'error' } })
    }
  })
}

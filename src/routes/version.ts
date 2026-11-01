import type { FastifyInstance } from 'fastify'
import type { AppDeps } from '../app.js'
import type { Config } from '../config.js'

export function registerVersionRoute(app: FastifyInstance, config: Config, deps: AppDeps): void {
  app.get('/version', async (_req, reply) => {
    await reply.send({
      name: 'notes-api',
      version: config.appVersion,
      git_sha: config.gitSha,
      environment: config.appEnv,
      auth_mode: config.authMode,
      started_at: deps.startedAt,
    })
  })
}

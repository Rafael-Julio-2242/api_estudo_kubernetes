import type { FastifyInstance } from 'fastify'
import type { AppDeps } from '../app.js'

export function registerMeRoute(app: FastifyInstance, deps: AppDeps): void {
  app.get(
    '/me',
    { preHandler: [deps.authenticate] },
    async (request, reply) => {
      await reply.send(request.user)
    },
  )
}

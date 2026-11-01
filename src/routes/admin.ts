import type { FastifyInstance } from 'fastify'
import type { AppDeps } from '../app.js'
import type { Config } from '../config.js'
import { requireRole } from '../auth/hooks.js'
import { countUsers } from '../services/users.js'
import { countNotes } from '../services/notes.js'

export function registerAdminRoutes(app: FastifyInstance, config: Config, deps: AppDeps): void {
  app.get(
    '/admin/stats',
    { preHandler: [deps.authenticate, requireRole('admin')] },
    async (_request, reply) => {
      const users = config.authMode === 'oidc' ? null : countUsers(deps.db)
      const notes = countNotes(deps.db)
      await reply.send({ users, notes })
    },
  )
}

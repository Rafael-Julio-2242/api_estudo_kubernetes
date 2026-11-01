import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify'
import type Database from 'better-sqlite3'
import type { Config } from './config.js'
import type { JwtSigner } from './auth/jwt.js'
import { errorHandler } from './errors.js'
import { registerHealthRoutes } from './routes/health.js'
import { registerVersionRoute } from './routes/version.js'

export interface AppDeps {
  db: Database.Database
  shuttingDown: { value: boolean }
  startedAt: string
  jwtSigner: JwtSigner
  authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      sub: string
      email?: string
      role: 'user' | 'admin'
      scopes: string[]
      iss: string
      aud: string
      iat: number
      exp: number
    }
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

export async function buildApp(config: Config, deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      redact: ['req.headers.authorization', '*.password', '*.password_hash'],
    },
    trustProxy: true,
    bodyLimit: 64 * 1024,
  })

  app.setErrorHandler(errorHandler)

  app.setNotFoundHandler((_req, reply) => {
    void reply.status(404).send({ error: 'not_found', message: 'route not found' })
  })

  app.decorate('authenticate', deps.authenticate)

  registerHealthRoutes(app, deps)
  registerVersionRoute(app, config, deps)

  return app
}

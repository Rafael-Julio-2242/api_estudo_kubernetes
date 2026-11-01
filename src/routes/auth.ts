import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { AppDeps } from '../app.js'
import type { Config } from '../config.js'
import { AppError } from '../errors.js'
import { registerUser, loginUser, scopesForRole, initDummyHash } from '../auth/local.js'
import { requireScope } from '../auth/hooks.js'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
})

const tokenSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function registerAuthRoutes(
  app: FastifyInstance,
  config: Config,
  deps: AppDeps,
): Promise<void> {
  if (config.authMode === 'oidc') {
    app.post('/auth/register', async (_req, reply) => {
      await reply.status(404).send({ error: 'not_found', message: 'not available in OIDC mode' })
    })
    app.post('/auth/token', async (_req, reply) => {
      await reply.status(404).send({ error: 'not_found', message: 'not available in OIDC mode' })
    })
    app.get('/.well-known/jwks.json', async (_req, reply) => {
      await reply.status(404).send({ error: 'not_found', message: 'not available in OIDC mode' })
    })
    // Stub /notes for scope tests — still needs auth even in OIDC mode
    app.get('/notes', { preHandler: [deps.authenticate, requireScope('notes:read')] }, async (_req, reply) => {
      await reply.send({ items: [] })
    })
    return
  }

  // Init dummy hash for timing-safe login
  await initDummyHash()

  app.post('/auth/register', async (request, reply) => {
    const body = registerSchema.safeParse(request.body)
    if (!body.success) {
      throw new AppError(400, 'bad_request', body.error.issues[0]?.message ?? 'invalid body')
    }
    const user = await registerUser(deps.db, body.data.email, body.data.password)
    await reply.status(201).send(user)
  })

  app.post('/auth/token', async (request, reply) => {
    const body = tokenSchema.safeParse(request.body)
    if (!body.success) {
      throw new AppError(400, 'bad_request', 'invalid body')
    }
    const user = await loginUser(deps.db, body.data.email, body.data.password)
    const scopes = scopesForRole(user.role)
    const token = await deps.jwtSigner.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      scopes,
    })
    await reply.send({ access_token: token, token_type: 'Bearer', expires_in: config.jwtTtlSeconds })
  })

  if (config.jwtAlg === 'RS256' && deps.jwtSigner.jwks) {
    app.get('/.well-known/jwks.json', async (_req, reply) => {
      const jwks = await deps.jwtSigner.jwks!()
      await reply.send(jwks)
    })
  } else {
    app.get('/.well-known/jwks.json', async (_req, reply) => {
      await reply.status(404).send({ error: 'not_found', message: 'not available in HS256 mode' })
    })
  }

  // Stub GET /notes — requires notes:read scope. Task 9 will replace this with full implementation.
  app.get('/notes', { preHandler: [deps.authenticate, requireScope('notes:read')] }, async (_req, reply) => {
    await reply.send({ items: [] })
  })
}

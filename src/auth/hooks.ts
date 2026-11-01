import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify'
import type { AppDeps } from '../app.js'
import type { Config } from '../config.js'
import { AppError } from '../errors.js'

type AuthDeps = Pick<AppDeps, 'jwtSigner'>

export function makeAuthenticate(_config: Config, deps: AuthDeps) {
  return async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const authHeader = request.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      void reply.header('WWW-Authenticate', 'Bearer')
      throw new AppError(401, 'unauthorized', 'missing or invalid authorization header')
    }

    const token = authHeader.slice(7)
    if (!token) {
      void reply.header('WWW-Authenticate', 'Bearer')
      throw new AppError(401, 'unauthorized', 'missing token')
    }

    try {
      const payload = await deps.jwtSigner.verify(token)
      request.user = payload
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'token validation failed'
      // IdP unavailable (only in OIDC mode)
      if (message.includes('idp_unavailable')) {
        throw new AppError(503, 'idp_unavailable', 'identity provider unavailable')
      }
      void reply.header('WWW-Authenticate', 'Bearer')
      throw new AppError(401, 'unauthorized', 'invalid or expired token')
    }
  }
}

export function requireScope(scope: string): preHandlerHookHandler {
  return async function (request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    if (!request.user?.scopes.includes(scope)) {
      throw new AppError(403, 'forbidden', `missing required scope: ${scope}`)
    }
  }
}

export function requireRole(role: string): preHandlerHookHandler {
  return async function (request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    if (request.user?.role !== role) {
      throw new AppError(403, 'forbidden', `missing required role: ${role}`)
    }
  }
}

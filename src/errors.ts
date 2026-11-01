import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'

export type ErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'idp_unavailable'
  | 'internal_error'

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (error instanceof AppError) {
    void reply.status(error.statusCode).send({ error: error.code, message: error.message })
    return
  }

  // Fastify validation errors (body/params)
  const fastifyErr = error as FastifyError
  if (fastifyErr.statusCode === 400 || fastifyErr.validation) {
    void reply.status(400).send({ error: 'bad_request', message: fastifyErr.message })
    return
  }

  request.log.error({ err: error }, 'Unhandled error')
  void reply.status(500).send({ error: 'internal_error', message: 'internal error' })
}

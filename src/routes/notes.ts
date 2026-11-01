import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { AppDeps } from '../app.js'
import { AppError } from '../errors.js'
import { requireScope } from '../auth/hooks.js'
import { findNotesByOwner, findNoteById, createNote, deleteNote } from '../services/notes.js'

const createNoteSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(10000),
})

export function registerNotesRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.get(
    '/notes',
    { preHandler: [deps.authenticate, requireScope('notes:read')] },
    async (request, reply) => {
      const notes = findNotesByOwner(deps.db, request.user!.sub)
      await reply.send(notes)
    },
  )

  app.post(
    '/notes',
    { preHandler: [deps.authenticate, requireScope('notes:write')] },
    async (request, reply) => {
      const body = createNoteSchema.safeParse(request.body)
      if (!body.success) {
        throw new AppError(400, 'bad_request', body.error.issues[0]?.message ?? 'invalid body')
      }
      const note = createNote(deps.db, {
        ownerId: request.user!.sub,
        title: body.data.title,
        content: body.data.content,
      })
      await reply.status(201).send(note)
    },
  )

  app.get(
    '/notes/:id',
    { preHandler: [deps.authenticate, requireScope('notes:read')] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const note = findNoteById(deps.db, id)
      if (!note || note.owner_id !== request.user!.sub) {
        throw new AppError(404, 'not_found', 'note not found')
      }
      await reply.send(note)
    },
  )

  app.delete(
    '/notes/:id',
    { preHandler: [deps.authenticate, requireScope('notes:write')] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const note = findNoteById(deps.db, id)
      if (!note || note.owner_id !== request.user!.sub) {
        throw new AppError(404, 'not_found', 'note not found')
      }
      deleteNote(deps.db, id)
      await reply.status(204).send()
    },
  )
}

import type Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'

export interface NoteRow {
  id: string
  owner_id: string
  title: string
  content: string
  created_at: string
}

export function findNotesByOwner(db: Database.Database, ownerId: string): NoteRow[] {
  return db
    .prepare('SELECT * FROM notes WHERE owner_id = ? ORDER BY created_at DESC')
    .all(ownerId) as NoteRow[]
}

export function findNoteById(db: Database.Database, id: string): NoteRow | undefined {
  return db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as NoteRow | undefined
}

export function createNote(
  db: Database.Database,
  opts: { ownerId: string; title: string; content: string },
): NoteRow {
  const id = randomUUID()
  db.prepare('INSERT INTO notes (id, owner_id, title, content) VALUES (?, ?, ?, ?)').run(
    id,
    opts.ownerId,
    opts.title,
    opts.content,
  )
  return findNoteById(db, id)!
}

export function deleteNote(db: Database.Database, id: string): boolean {
  const result = db.prepare('DELETE FROM notes WHERE id = ?').run(id)
  return result.changes > 0
}

export function countNotes(db: Database.Database): number {
  const row = db.prepare('SELECT COUNT(*) as count FROM notes').get() as { count: number }
  return row.count
}

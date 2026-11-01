import type Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'

export interface UserRow {
  id: string
  email: string
  password_hash: string
  role: 'user' | 'admin'
  created_at: string
}

export function findUserByEmail(db: Database.Database, email: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined
}

export function findUserById(db: Database.Database, id: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
}

export function createUser(
  db: Database.Database,
  opts: { email: string; passwordHash: string; role?: 'user' | 'admin' },
): UserRow {
  const id = randomUUID()
  const role = opts.role ?? 'user'
  db.prepare('INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)').run(
    id,
    opts.email,
    opts.passwordHash,
    role,
  )
  return findUserById(db, id)!
}

export function countUsers(db: Database.Database): number {
  const row = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
  return row.count
}

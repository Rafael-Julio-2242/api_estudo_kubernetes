import type Database from 'better-sqlite3'
import { hashPassword, verifyPassword, getDummyHash } from './password.js'
import { findUserByEmail, createUser } from '../services/users.js'
import { AppError } from '../errors.js'

let _dummyHash: string | null = null

export async function initDummyHash(): Promise<void> {
  _dummyHash = await getDummyHash()
}

function getDummy(): string {
  return _dummyHash ?? '$argon2id$v=19$m=65536,t=3,p=4$dummy$dummy'
}

export async function registerUser(
  db: Database.Database,
  email: string,
  password: string,
): Promise<{ id: string; email: string; role: 'user' | 'admin' }> {
  const normalised = email.toLowerCase()
  const existing = findUserByEmail(db, normalised)
  if (existing) throw new AppError(409, 'conflict', 'email already registered')

  const passwordHash = await hashPassword(password)
  const user = createUser(db, { email: normalised, passwordHash })
  return { id: user.id, email: user.email, role: user.role }
}

export async function loginUser(
  db: Database.Database,
  email: string,
  password: string,
): Promise<{ id: string; email: string; role: 'user' | 'admin' }> {
  const normalised = email.toLowerCase()
  const user = findUserByEmail(db, normalised)

  if (!user) {
    // timing: verify against dummy hash so response time is similar regardless of email existence
    await verifyPassword(password, getDummy()).catch(() => {})
    throw new AppError(401, 'unauthorized', 'invalid credentials')
  }

  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) throw new AppError(401, 'unauthorized', 'invalid credentials')

  return { id: user.id, email: user.email, role: user.role }
}

export function scopesForRole(role: 'user' | 'admin'): string[] {
  return role === 'admin'
    ? ['notes:read', 'notes:write', 'admin:read']
    : ['notes:read', 'notes:write']
}

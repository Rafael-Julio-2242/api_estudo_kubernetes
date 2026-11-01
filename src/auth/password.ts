import { hash, verify } from '@node-rs/argon2'
import { randomBytes } from 'node:crypto'

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain)
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  return verify(hashed, plain)
}

// Pre-compute once at startup so timing attacks on unknown emails waste the same argon2 time
export async function getDummyHash(): Promise<string> {
  return hash(randomBytes(32).toString('hex'))
}

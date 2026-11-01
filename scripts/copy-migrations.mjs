import { cpSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'migrations')
const dst = join(root, 'dist', 'migrations')

mkdirSync(dst, { recursive: true })
cpSync(src, dst, { recursive: true })
console.log('Migrations copied to dist/migrations')

import { z } from 'zod'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

function readEnvOrFile(name: string, env: Record<string, string | undefined>): string | undefined {
  const fileVar = env[`${name}_FILE`]
  if (fileVar) return readFileSync(fileVar, 'utf-8').trim()
  return env[name]
}

const schema = z
  .object({
    appEnv: z.string().default('local'),
    appVersion: z.string().default('0.0.0'),
    gitSha: z.string().default('unknown'),
    port: z.coerce.number().int().min(1).max(65535).default(8080),
    host: z.string().default('0.0.0.0'),
    logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    databasePath: z.string().default('./data/notes.db'),
    shutdownDelaySeconds: z.coerce.number().int().min(0).default(0),
    authMode: z.enum(['local', 'oidc']).default('local'),
    jwtIssuer: z.string().default('notes-api'),
    jwtAudience: z.string().default('notes-api'),
    jwtAlg: z.enum(['HS256', 'RS256']).default('HS256'),
    jwtSecret: z.string().min(32).optional(),
    jwtPrivateKey: z.string().optional(),
    jwtPublicKey: z.string().optional(),
    jwtTtlSeconds: z.coerce.number().int().min(1).default(3600),
    oidcJwksUrl: z.string().url().optional(),
    seedAdminEmail: z.string().email().optional(),
    seedAdminPassword: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.authMode === 'local') {
      if (val.jwtAlg === 'HS256' && !val.jwtSecret) {
        ctx.addIssue({ code: 'custom', message: 'JWT_SECRET required when AUTH_MODE=local and JWT_ALG=HS256 (min 32 chars)' })
      }
      if (val.jwtAlg === 'RS256' && (!val.jwtPrivateKey || !val.jwtPublicKey)) {
        ctx.addIssue({ code: 'custom', message: 'JWT_PRIVATE_KEY and JWT_PUBLIC_KEY required when JWT_ALG=RS256' })
      }
    }
  })

export type Config = z.infer<typeof schema>

function readPackageVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8')) as { version?: string }
    return pkg.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const raw = {
    appEnv: env.APP_ENV,
    appVersion: env.APP_VERSION ?? readPackageVersion(),
    gitSha: env.GIT_SHA,
    port: env.PORT,
    host: env.HOST,
    logLevel: env.LOG_LEVEL,
    databasePath: env.DATABASE_PATH,
    shutdownDelaySeconds: env.SHUTDOWN_DELAY_SECONDS,
    authMode: env.AUTH_MODE,
    jwtIssuer: env.JWT_ISSUER,
    jwtAudience: env.JWT_AUDIENCE,
    jwtAlg: env.JWT_ALG,
    jwtSecret: readEnvOrFile('JWT_SECRET', env),
    jwtPrivateKey: readEnvOrFile('JWT_PRIVATE_KEY', env),
    jwtPublicKey: readEnvOrFile('JWT_PUBLIC_KEY', env),
    jwtTtlSeconds: env.JWT_TTL_SECONDS,
    oidcJwksUrl: env.OIDC_JWKS_URL,
    seedAdminEmail: env.SEED_ADMIN_EMAIL,
    seedAdminPassword: readEnvOrFile('SEED_ADMIN_PASSWORD', env),
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new ConfigError(`Invalid configuration:\n${issues}`)
  }
  return result.data
}

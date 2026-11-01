import { createSecretKey } from 'node:crypto'
import {
  SignJWT,
  jwtVerify,
  importPKCS8,
  importSPKI,
  exportJWK,
  calculateJwkThumbprint,
} from 'jose'
import type { Config } from '../config.js'

export interface JwtPayload {
  sub: string
  email?: string
  role: 'user' | 'admin'
  scopes: string[]
  iss: string
  aud: string
  iat: number
  exp: number
  nbf: number
}

export interface JwkKey {
  kty: string
  n?: string
  e?: string
  kid: string
  alg: string
  use: string
}

export interface JwtSigner {
  sign(claims: Omit<JwtPayload, 'iss' | 'aud' | 'iat' | 'exp' | 'nbf'>): Promise<string>
  verify(token: string): Promise<JwtPayload>
  jwks?(): Promise<{ keys: JwkKey[] }>
}

export async function createJwtSigner(config: Config): Promise<JwtSigner> {
  if (config.jwtAlg === 'HS256') {
    const key = createSecretKey(Buffer.from(config.jwtSecret!))
    return {
      async sign(claims) {
        const now = Math.floor(Date.now() / 1000)
        return new SignJWT({
          email: claims.email,
          role: claims.role,
          scope: claims.scopes.join(' '),
        })
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuer(config.jwtIssuer)
          .setAudience(config.jwtAudience)
          .setSubject(claims.sub)
          .setIssuedAt(now)
          .setNotBefore(now)
          .setExpirationTime(now + config.jwtTtlSeconds)
          .sign(key)
      },
      async verify(token) {
        const { payload } = await jwtVerify(token, key, {
          issuer: config.jwtIssuer,
          audience: config.jwtAudience,
          algorithms: ['HS256'],
        })
        return extractPayload(payload)
      },
    }
  }

  // RS256
  const privateKey = await importPKCS8(config.jwtPrivateKey!, 'RS256')
  const publicKey = await importSPKI(config.jwtPublicKey!, 'RS256')
  const jwkPublic = await exportJWK(publicKey)
  const kid = await calculateJwkThumbprint(jwkPublic)

  return {
    async sign(claims) {
      const now = Math.floor(Date.now() / 1000)
      return new SignJWT({
        email: claims.email,
        role: claims.role,
        scope: claims.scopes.join(' '),
      })
        .setProtectedHeader({ alg: 'RS256', kid })
        .setIssuer(config.jwtIssuer)
        .setAudience(config.jwtAudience)
        .setSubject(claims.sub)
        .setIssuedAt(now)
        .setNotBefore(now)
        .setExpirationTime(now + config.jwtTtlSeconds)
        .sign(privateKey)
    },
    async verify(token) {
      const { payload } = await jwtVerify(token, publicKey, {
        issuer: config.jwtIssuer,
        audience: config.jwtAudience,
        algorithms: ['RS256'],
      })
      return extractPayload(payload)
    },
    async jwks() {
      return {
        keys: [{ ...jwkPublic, kid, alg: 'RS256', use: 'sig' } as JwkKey],
      }
    },
  }
}

function extractPayload(payload: Record<string, unknown>): JwtPayload {
  const scope = typeof payload.scope === 'string' ? payload.scope : ''
  return {
    sub: payload.sub as string,
    email: payload.email as string | undefined,
    role: (payload.role as 'user' | 'admin') ?? 'user',
    scopes: scope ? scope.split(' ') : [],
    iss: payload.iss as string,
    aud: Array.isArray(payload.aud) ? payload.aud[0] : (payload.aud as string),
    iat: payload.iat as number,
    exp: payload.exp as number,
    nbf: (payload.nbf as number) ?? (payload.iat as number),
  }
}

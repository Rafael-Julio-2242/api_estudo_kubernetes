import { createRemoteJWKSet, jwtVerify, errors } from 'jose'
import type { Config } from '../config.js'
import type { JwtSigner, JwtPayload } from './jwt.js'

export function createOidcSigner(config: Config): JwtSigner {
  let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

  function getJwks(): ReturnType<typeof createRemoteJWKSet> {
    if (!jwks) {
      if (!config.oidcJwksUrl) {
        throw new Error('oidcJwksUrl is required when authMode is oidc')
      }
      jwks = createRemoteJWKSet(new URL(config.oidcJwksUrl))
    }
    return jwks
  }

  return {
    async sign(): Promise<string> {
      throw new Error('OIDC mode: token issuance not supported')
    },

    async verify(token: string): Promise<JwtPayload> {
      let payload: Record<string, unknown>
      try {
        const result = await jwtVerify(token, getJwks(), {
          issuer: config.jwtIssuer,
          audience: config.jwtAudience,
          algorithms: ['RS256'],
        })
        payload = result.payload as Record<string, unknown>
      } catch (err: unknown) {
        // JOSE token errors (invalid sig, bad claims, expired, etc.) → rethrow for 401
        if (err instanceof errors.JOSEError) {
          throw err
        }
        // Network / connectivity error fetching JWKS → IdP is unavailable → 503
        throw new Error('idp_unavailable')
      }

      const realmRoles =
        (payload.realm_access as { roles?: string[] } | undefined)?.roles ?? []
      const role: 'user' | 'admin' = realmRoles.includes('admin') ? 'admin' : 'user'
      const scope = typeof payload.scope === 'string' ? payload.scope : ''

      return {
        sub: payload.sub as string,
        email: payload.email as string | undefined,
        role,
        scopes: scope ? scope.split(' ') : [],
        iss: payload.iss as string,
        aud: Array.isArray(payload.aud) ? payload.aud[0] : (payload.aud as string),
        iat: payload.iat as number,
        exp: payload.exp as number,
        nbf: (payload.nbf as number) ?? (payload.iat as number),
      }
    },
  }
}

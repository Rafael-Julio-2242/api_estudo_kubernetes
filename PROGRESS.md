# Notes API — Implementation Progress

Spec: `docs/superpowers/specs/2026-11-01-notes-api-design.md`

## Pass 1: Core API (current)

### Infra / Config
- [ ] `.nvmrc`, `.gitignore`, `.dockerignore`, `.env.example`
- [ ] `package.json` (scripts, deps, engines)
- [ ] `tsconfig.json`
- [ ] `eslint.config.js` + `.prettierrc`
- [ ] `src/config.ts` — zod env validation, _FILE variants, fail-fast

### Database
- [ ] `migrations/0001_init.sql` — users + notes schema
- [ ] `src/db/connection.ts` — open SQLite (WAL, FK, busy_timeout)
- [ ] `src/db/migrate.ts` — runner with schema_migrations table

### Errors
- [ ] `src/errors.ts` — AppError + Fastify setErrorHandler

### Auth
- [ ] `src/auth/password.ts` — argon2id hash/verify + dummy hash
- [ ] `src/auth/jwt.ts` — sign/verify facade (HS256 + RS256)
- [ ] `src/auth/hooks.ts` — authenticate hook, requireScope, requireRole
- [ ] `src/auth/local.ts` — register + login business logic
- [ ] `src/auth/oidc.ts` — lazy JWKS discovery, 503 on IdP down

### Services
- [ ] `src/services/users.ts` — DB queries
- [ ] `src/services/notes.ts` — DB queries

### Routes
- [ ] `src/routes/health.ts` — /health/live + /health/ready
- [ ] `src/routes/version.ts` — /version
- [ ] `src/routes/auth.ts` — /auth/register, /auth/token, /.well-known/jwks.json
- [ ] `src/routes/me.ts` — /me
- [ ] `src/routes/notes.ts` — CRUD
- [ ] `src/routes/admin.ts` — /admin/stats

### App wiring
- [ ] `src/app.ts` — buildApp(config, deps)
- [ ] `src/main.ts` — startup sequence + graceful shutdown

### Ops
- [ ] `Dockerfile` — multi-stage, UID 10001, ARG APP_VERSION/GIT_SHA
- [ ] `docker-compose.yml` — api service (local mode, named volume)
- [ ] `scripts/smoke.mjs` — health + version + auth checks

### Tests
- [ ] `test/config.test.ts`
- [ ] `test/health.test.ts`
- [ ] `test/auth.local.test.ts`
- [ ] `test/auth.oidc.test.ts`
- [ ] `test/notes.test.ts`
- [ ] `test/admin.test.ts`

### Docs
- [ ] `README.md` — env vars, commands, curl examples, infra contract

---

## Pass 2: Keycloak / OIDC (deferred)

- [ ] `docker-compose.yml` oidc profile (Keycloak + api-oidc service)
- [ ] `keycloak/realm-notes.json` — realm import with clients, scopes, users
- [ ] README section: OIDC flows (Client Credentials + PKCE Postman)
- [ ] JWT_ISSUER hostname strategy documented

---

## Legend
- [ ] not started
- [~] in progress
- [x] done

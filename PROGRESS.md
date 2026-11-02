# Notes API — Implementation Progress

Spec: `docs/superpowers/specs/2026-11-01-notes-api-design.md`

## Pass 1: Core API ✅ complete

### Infra / Config
- [x] `.nvmrc`, `.gitignore`, `.dockerignore`, `.env.example`
- [x] `package.json` (scripts, deps, engines)
- [x] `tsconfig.json`
- [x] `eslint.config.js` + `.prettierrc`
- [x] `src/config.ts` — zod env validation, _FILE variants, fail-fast

### Database
- [x] `migrations/0001_init.sql` — users + notes schema
- [x] `src/db/connection.ts` — open SQLite (WAL, FK, busy_timeout)
- [x] `src/db/migrate.ts` — runner with schema_migrations table

### Errors
- [x] `src/errors.ts` — AppError + Fastify setErrorHandler

### Auth
- [x] `src/auth/password.ts` — argon2id hash/verify + dummy hash
- [x] `src/auth/jwt.ts` — sign/verify facade (HS256 + RS256)
- [x] `src/auth/hooks.ts` — authenticate hook, requireScope, requireRole
- [x] `src/auth/local.ts` — register + login business logic
- [x] `src/auth/oidc.ts` — lazy JWKS discovery, 503 on IdP down

### Services
- [x] `src/services/users.ts` — DB queries
- [x] `src/services/notes.ts` — DB queries

### Routes
- [x] `src/routes/health.ts` — /health/live + /health/ready
- [x] `src/routes/version.ts` — /version
- [x] `src/routes/auth.ts` — /auth/register, /auth/token, /.well-known/jwks.json
- [x] `src/routes/me.ts` — /me
- [x] `src/routes/notes.ts` — CRUD
- [x] `src/routes/admin.ts` — /admin/stats

### App wiring
- [x] `src/app.ts` — buildApp(config, deps)
- [x] `src/main.ts` — startup sequence + graceful shutdown

### Ops
- [x] `Dockerfile` — multi-stage, UID 10001, ARG APP_VERSION/GIT_SHA
- [x] `docker-compose.yml` — api service (local mode, named volume)
- [x] `scripts/smoke.mjs` — health + version + auth checks

### Tests
- [x] `test/config.test.ts`
- [x] `test/health.test.ts`
- [x] `test/auth.local.test.ts`
- [x] `test/auth.oidc.test.ts`
- [x] `test/notes.test.ts`
- [x] `test/admin.test.ts`

### Docs
- [x] `README.md` — env vars, commands, curl examples, infra contract

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

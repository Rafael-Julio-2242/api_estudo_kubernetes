# Notes API — Design Spec

**Date:** 2026-11-01  
**Status:** Approved  
**Scope (pass 1):** Core API + local auth + Docker (single service). Keycloak/OIDC compose profile deferred to pass 2.

---

## 1. Purpose

Study service. Pretext is a working API; real goal is practicing Kubernetes (dev/staging/prod) and CI/CD (GitHub Actions, GitLab CI, Jenkins). The API must be a good Kubernetes citizen: env-only config, correct health probes, graceful shutdown, non-root image, lean Docker build.

---

## 2. Stack

| Concern | Choice |
|---|---|
| Language | TypeScript (strict), ESM |
| Runtime | Node.js 22 LTS |
| HTTP | Fastify 5 |
| Validation | zod |
| Database | SQLite via better-sqlite3 (sync, no ORM) |
| Migrations | Numbered .sql files + minimal runner (schema_migrations table) |
| JWT | jose |
| Password hash | @node-rs/argon2 (Argon2id) |
| Logs | pino (Fastify built-in), JSON stdout |
| Tests | Vitest + app.inject() |
| Lint/format | ESLint flat config + typescript-eslint, Prettier |
| Package manager | npm (commit package-lock.json) |
| IDs | crypto.randomUUID() |

---

## 3. Module Layout

```
src/
  main.ts            entrypoint: config → DB → app → listen → signals
  app.ts             buildApp(config, deps) — testable factory
  config.ts          zod parse of process.env, fail-fast on invalid
  errors.ts          AppError class + Fastify setErrorHandler
  db/
    connection.ts    opens SQLite (WAL, FK, busy_timeout=5000)
    migrate.ts       runs pending .sql files, tracks schema_migrations
  auth/
    jwt.ts           sign + verify facade, algorithm fixed at startup
    local.ts         register + login handlers
    oidc.ts          remote JWKS via createRemoteJWKSet, lazy discovery
    hooks.ts         authenticate hook, requireScope, requireRole
    password.ts      argon2id hash/verify + constant-time dummy hash
  routes/
    health.ts        /health/live, /health/ready
    version.ts       /version
    auth.ts          /auth/register, /auth/token, /.well-known/jwks.json
    me.ts            /me
    notes.ts         GET/POST /notes, GET/DELETE /notes/:id
    admin.ts         /admin/stats
  services/
    users.ts         DB queries for users table
    notes.ts         DB queries for notes table
migrations/
  0001_init.sql
scripts/
  smoke.mjs
test/
  config.test.ts
  health.test.ts
  auth.local.test.ts
  auth.oidc.test.ts
  notes.test.ts
  admin.test.ts
```

---

## 4. Startup & Shutdown

**Startup order:**
1. Parse + validate config (zod) — exit(1) on failure
2. Create DATABASE_PATH directory if missing
3. Open SQLite with WAL + FK + busy_timeout
4. Run pending migrations (each in a transaction) — exit(1) on failure
5. buildApp(config, db)
6. app.listen — log "ready"

**Graceful shutdown (SIGTERM / SIGINT):**
1. Set `isShuttingDown = true` → /health/ready returns 503
2. Wait `SHUTDOWN_DELAY_SECONDS`
3. app.close() (drains in-flight requests)
4. db.close()
5. exit(0)

Second signal → exit(1) immediately. Safety timeout: 25s → exit(1).

---

## 5. Configuration

All config from environment variables, validated once at startup in `src/config.ts`. Variables with a `_FILE` variant: file content takes priority over direct variable. Secrets (`JWT_SECRET`, keys, passwords) never logged.

Key variables: `APP_ENV`, `APP_VERSION`, `GIT_SHA`, `PORT` (8080), `HOST` (0.0.0.0), `LOG_LEVEL` (info), `DATABASE_PATH` (./data/notes.db), `SHUTDOWN_DELAY_SECONDS` (0), `AUTH_MODE` (local|oidc), `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_ALG` (HS256|RS256), `JWT_SECRET`, `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `JWT_TTL_SECONDS` (3600), `OIDC_JWKS_URL`, `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.

---

## 6. Database Schema

Single migration `0001_init.sql`:

```sql
CREATE TABLE users (
  id            TEXT PRIMARY KEY NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE notes (
  id         TEXT PRIMARY KEY NOT NULL,
  owner_id   TEXT NOT NULL,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_notes_owner ON notes(owner_id, created_at DESC);
```

`notes.owner_id` is not a FK (OIDC mode: user lives in IdP, not in `users` table). All queries parameterized.

---

## 7. Authentication

### Local mode

- `POST /auth/token`: verify password (argon2id) → issue signed JWT
- Algorithm fixed from `JWT_ALG` config, never read from token header, never accept `alg: none`
- HS256: symmetric `JWT_SECRET` (min 32 chars)
- RS256: PEM pair; also expose `GET /.well-known/jwks.json` with public key + `kid`
- JWT claims: `iss`, `sub` (user.id), `aud`, `exp`, `iat`, `nbf`, `email`, `role`, `scope`
- Scopes: `user` → `notes:read notes:write`; `admin` → `notes:read notes:write admin:read`
- Timing attack prevention: when email not found, verify password against a dummy hash pre-computed **once at startup** (not per-request — avoids paying argon2 cost on every bad email)

### OIDC mode

- JWKS discovered lazily on first authenticated request (not at startup — K8s init order)
- `createRemoteJWKSet` (jose) handles cache + kid-triggered refetch
- Algorithm fixed to RS256; validate `iss`, `aud`, `exp`, `nbf`
- IdP unreachable → 503 `{ "error": "idp_unavailable" }` (not 401)
- Role mapping: `realm_access.roles` contains `admin` → admin; else user
- `POST /auth/register`, `POST /auth/token`, `GET /.well-known/jwks.json` → 404

### authenticate hook

Reads `Authorization: Bearer <token>`, validates, attaches `{ sub, email, role, scopes }` to request.

Error semantics:
- Missing header / wrong scheme / malformed / bad sig / expired / wrong iss|aud / alg mismatch → **401** + `WWW-Authenticate: Bearer`
- Valid token, missing scope/role → **403**

---

## 8. Endpoints

All JSON. Body limit 64 KB. IDs are UUIDs.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /health/live | none | never touches DB |
| GET | /health/ready | none | SELECT 1; 503 during shutdown |
| GET | /version | none | app metadata |
| POST | /auth/register | none | local only |
| POST | /auth/token | none | local only |
| GET | /.well-known/jwks.json | none | local+RS256 only |
| GET | /me | token | returns token claims |
| GET | /notes | notes:read | owner's notes, newest first |
| POST | /notes | notes:write | create note |
| GET | /notes/:id | notes:read | 404 if not owner |
| DELETE | /notes/:id | notes:write | 204; 404 if not owner |
| GET | /admin/stats | role:admin | users+notes counts |

---

## 9. Error Format

```json
{ "error": "forbidden", "message": "missing required scope: notes:write" }
```

Codes: `bad_request`, `unauthorized`, `forbidden`, `not_found`, `conflict`, `idp_unavailable`, `internal_error`.

Unexpected errors → 500 with `{ "error": "internal_error", "message": "internal error" }`; real error only in log.

---

## 10. Docker

**Multi-stage build:**
- Stage `builder`: `node:22-slim`, `npm ci`, `npm run build` (tsc + copy migrations to dist/)
- Stage `runtime`: `node:22-slim`, `npm ci --omit=dev`, copy dist/ from builder
- `better-sqlite3` and `@node-rs/argon2` use prebuilt binaries for linux/x64 — no native toolchain in runtime image
- UID/GID 10001, `/data` owned by 10001
- `DATABASE_PATH=/data/notes.db`, `NODE_ENV=production`
- `ARG APP_VERSION`, `ARG GIT_SHA` → `ENV` + OCI labels
- Works with `docker run --read-only -v notes-data:/data`
- Only write paths: `/data` (SQLite) and `/tmp` if any native lib needs it. `better-sqlite3` and `@node-rs/argon2` do not require `/tmp` — no extra tmpfs mount needed.

**docker-compose.yml (pass 1):** single `api` service in local mode with named volume for /data.

---

## 11. Smoke Test

`scripts/smoke.mjs` — no external dependencies (Node 22 fetch only).

Steps:
1. GET /health/live → 200
2. GET /health/ready → 200 (retry up to 30x every 2s)
3. GET /version → compare EXPECT_SHA / EXPECT_ENV / EXPECT_VERSION if set
4. GET /me without token → 401
5. GET /me with SMOKE_TOKEN (if set) → 200

Exit 0 only if all pass. 5s per-request timeout. `SMOKE_INSECURE=1` accepts self-signed certs.

---

## 12. Tests

Vitest + `app.inject()`. No network, no Docker, no external services.

- SQLite `:memory:` or temp file per suite
- Fake OIDC IdP: in-process Node http.createServer, real RS256 keys from jose
- Coverage reported (lcov + cobertura), ≥80% lines target — reported only, not a hard fail
- test:ci → JUnit at reports/junit.xml, coverage at reports/coverage/

---

## 13. Deferred (Pass 2)

- Keycloak compose profile (`docker-compose.yml` `oidc` profile)
- `keycloak/realm-notes.json` (realm import)
- `api-oidc` service in docker-compose
- JWT_ISSUER hostname strategy for internal vs external Keycloak URL documented

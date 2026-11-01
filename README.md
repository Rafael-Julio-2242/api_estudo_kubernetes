# Notes API

Study REST API. Pretext is a working API; real goal is practising Kubernetes (dev/staging/prod) and CI/CD pipelines.

## Quick start

```bash
cp .env.example .env        # edit JWT_SECRET (min 32 chars)
npm ci
npm run dev                  # tsx watch, reload on change
```

## All npm commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with reload (`tsx watch`) |
| `npm run build` | Compile TypeScript → `dist/`, copy migrations |
| `npm start` | `node dist/main.js` (production) |
| `npm run lint` | ESLint, fail on any warning |
| `npm run format:check` | Prettier check |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest single run |
| `npm run test:ci` | Vitest + coverage (JUnit + lcov/cobertura) |
| `npm run smoke` | Smoke test against a running instance |

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `APP_ENV` | no | `local` | Environment name |
| `APP_VERSION` | no | from `package.json` | App version |
| `GIT_SHA` | no | `unknown` | Build commit SHA |
| `PORT` | no | `8080` | HTTP port |
| `HOST` | no | `0.0.0.0` | Bind address |
| `LOG_LEVEL` | no | `info` | `trace/debug/info/warn/error/fatal` |
| `DATABASE_PATH` | no | `./data/notes.db` | SQLite file path |
| `SHUTDOWN_DELAY_SECONDS` | no | `0` | Wait time after SIGTERM before closing |
| `AUTH_MODE` | no | `local` | `local` or `oidc` |
| `JWT_ISSUER` | no | `notes-api` | Token issuer (`iss`) |
| `JWT_AUDIENCE` | no | `notes-api` | Token audience (`aud`) |
| `JWT_ALG` | no | `HS256` | `HS256` or `RS256` (local mode) |
| `JWT_SECRET` | local+HS256 | — | Symmetric secret (min 32 chars) |
| `JWT_PRIVATE_KEY` | local+RS256 | — | PEM private key |
| `JWT_PUBLIC_KEY` | local+RS256 | — | PEM public key |
| `JWT_TTL_SECONDS` | no | `3600` | Token lifetime (local mode) |
| `OIDC_JWKS_URL` | oidc mode | — | OIDC JWKS endpoint |
| `SEED_ADMIN_EMAIL` | no | — | Creates admin on startup if not exists |
| `SEED_ADMIN_PASSWORD` | no | — | Password for seeded admin |

All secret variables also accept a `_FILE` variant pointing to a file (takes priority). Example: `JWT_SECRET_FILE=/run/secrets/jwt_secret`.

## Docker

### Build

```bash
docker build \
  --build-arg APP_VERSION=1.0.0 \
  --build-arg GIT_SHA=$(git rev-parse --short HEAD) \
  -t notes-api:1.0.0 .
```

### Run (read-only filesystem)

```bash
docker volume create notes-data
docker run --rm \
  --read-only \
  -v notes-data:/data \
  -e JWT_SECRET=your-secret-at-least-32-chars \
  -p 8080:8080 \
  notes-api:1.0.0
```

### Local compose

```bash
docker compose up
```

## Example curl flow (local mode)

```bash
# Register
curl -s -X POST http://localhost:8080/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"password123"}' | jq

# Get token
TOKEN=$(curl -s -X POST http://localhost:8080/auth/token \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"password123"}' | jq -r .access_token)

# Create note
curl -s -X POST http://localhost:8080/notes \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Study Kubernetes","content":"pods, services, ingress"}' | jq

# List notes
curl -s http://localhost:8080/notes \
  -H "Authorization: Bearer $TOKEN" | jq

# Inspect claims
curl -s http://localhost:8080/me \
  -H "Authorization: Bearer $TOKEN" | jq
```

## Contract with infrastructure

| Item | Value |
|---|---|
| HTTP port | `8080` (configurable via `PORT`) |
| Liveness probe | `GET /health/live` → 200 |
| Readiness probe | `GET /health/ready` → 200 / 503 |
| Container user UID | `10001` |
| Data volume mount | `/data` (SQLite lives at `DATABASE_PATH=/data/notes.db`) |
| Minimum secrets | `JWT_SECRET` (HS256) or `JWT_PRIVATE_KEY` + `JWT_PUBLIC_KEY` (RS256) |
| Pipeline commands | `npm ci`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run build`, `npm run test:ci` |
| Smoke test | `BASE_URL=https://... EXPECT_SHA=<sha> npm run smoke` |
| Process signal | SIGTERM → graceful drain → exit 0 |

## Why SQLite limits replicas to 1

SQLite is a file-based database. WAL mode allows concurrent reads, but only one writer at a time — and the file must live on a single node's filesystem. Running 2+ replicas against the same volume would cause locking issues. The natural migration path is PostgreSQL (via `pg` or `postgres` npm packages with the same service layer).

## OIDC mode (Keycloak — Pass 2, coming soon)

OIDC compose profile and Keycloak realm import are deferred to Pass 2.

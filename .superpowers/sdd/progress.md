# SDD Progress Ledger
# Plan: docs/superpowers/plans/2026-11-01-notes-api.md
# Started: 2026-11-01

## Tasks
- Task 1: Project Scaffold — PENDING
- Task 2: Config + Errors — PENDING
- Task 3: Database Layer — PENDING
- Task 4: Password + JWT Utilities — PENDING
- Task 5: Services — PENDING
- Task 6: App Factory + Health + Version — PENDING
- Task 7: Auth Hooks — PENDING
- Task 8: Local Auth Routes + Tests — PENDING
- Task 9: Protected Routes — PENDING
- Task 10: OIDC Auth — PENDING
- Task 11: Main Entrypoint — PENDING
- Task 12: Docker — PENDING
- Task 13: Smoke Test — PENDING
- Task 14: README — PENDING
Task 1: complete (commits 136885e..8e13f69, review clean)
Task 2: complete (commits 8e13f69..f1d004d, review clean, minor: _FILE errors not wrapped as ConfigError)
Task 3: complete (commits f1d004d..3cb5f33, review clean)
Task 4: complete (commits 3cb5f33..f0eba53, review clean, plan bug fixed: createSecretKey from node:crypto not jose)
Task 5: complete (commits f0eba53..9857c57, review clean)
Task 6: complete (commits 9857c57..f67431f, review clean)
Task 7: complete (commits f67431f..0ec3051, review clean, minor: AppDeps.authenticate dead field; _config unused — OIDC signer must throw message containing 'idp_unavailable' for 503 path)
Task 8: complete (commits 0ec3051..f8a81fb, review clean, minor: /notes stub in auth.ts — Task 9 must move to notes.ts; initDummyHash called per createTestApp — minor test latency only)
Task 9: complete (commits f8a81fb..109b1e2, review clean, minor: created_at ordering test could flake if two inserts land same second — advisory only)
Task 10: complete (commits 109b1e2..d750af9, review clean, fix applied: removed bad JWKS fallback URL that pointed to discovery doc instead of JWKS endpoint)
Task 11: complete (commits d750af9..08ddae0, review clean, fix applied: db.close() now in finally block; NOTE: migrationsDir points to repo root migrations/ not dist/migrations/ — Docker task must copy migrations/ to image or fix path)
Task 12: complete (commits 08ddae0..8ce71cc, review clean, low: LABEL source URL is placeholder; ARG defaults differ from config defaults; JWT_SECRET plaintext in compose — all advisory)
Task 13: complete (commits 8ce71cc..aa0c3a1, fix applied: body reads now inside timeout scope; trailing slash stripped from BASE_URL)
Task 14: complete (commits aa0c3a1..11fc1a7, review clean)

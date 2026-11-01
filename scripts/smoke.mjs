#!/usr/bin/env node
// scripts/smoke.mjs — no external dependencies

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '')
const EXPECT_SHA = process.env.EXPECT_SHA
const EXPECT_ENV = process.env.EXPECT_ENV
const EXPECT_VERSION = process.env.EXPECT_VERSION
const SMOKE_TOKEN = process.env.SMOKE_TOKEN
const SMOKE_INSECURE = process.env.SMOKE_INSECURE === '1'
const TIMEOUT_MS = 5000
const READY_RETRIES = 30
const READY_INTERVAL_MS = 2000

let passed = 0
let failed = 0

function log(ok, label, detail = '') {
  const icon = ok ? '✓' : '✗'
  console.log(`${icon} ${label}${detail ? ` — ${detail}` : ''}`)
  if (ok) passed++
  else failed++
}

async function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal })
    const text = await res.text()
    return {
      status: res.status,
      headers: res.headers,
      text,
      json: () => JSON.parse(text),
    }
  } finally {
    clearTimeout(timer)
  }
}

async function checkLive() {
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/health/live`)
    const ok = res.status === 200
    log(ok, 'GET /health/live', `status=${res.status}`)
  } catch (err) {
    log(false, 'GET /health/live', err.message)
  }
}

async function checkReady() {
  for (let i = 0; i < READY_RETRIES; i++) {
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/health/ready`)
      if (res.status === 200) {
        log(true, 'GET /health/ready', `status=200 (attempt ${i + 1})`)
        return
      }
    } catch {}
    if (i < READY_RETRIES - 1) {
      await new Promise((r) => setTimeout(r, READY_INTERVAL_MS))
    }
  }
  log(false, 'GET /health/ready', `not ready after ${READY_RETRIES} attempts`)
}

async function checkVersion() {
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/version`)
    const body = await res.json()
    const ok = res.status === 200
    log(ok, 'GET /version', `status=${res.status}`)

    if (EXPECT_SHA) {
      const match = body.git_sha === EXPECT_SHA
      log(match, '  git_sha matches', `expected=${EXPECT_SHA} got=${body.git_sha}`)
    }
    if (EXPECT_ENV) {
      const match = body.environment === EXPECT_ENV
      log(match, '  environment matches', `expected=${EXPECT_ENV} got=${body.environment}`)
    }
    if (EXPECT_VERSION) {
      const match = body.version === EXPECT_VERSION
      log(match, '  version matches', `expected=${EXPECT_VERSION} got=${body.version}`)
    }
  } catch (err) {
    log(false, 'GET /version', err.message)
  }
}

async function checkMeNoToken() {
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/me`)
    const ok = res.status === 401
    log(ok, 'GET /me (no token) → 401', `status=${res.status}`)
  } catch (err) {
    log(false, 'GET /me (no token)', err.message)
  }
}

async function checkMeWithToken() {
  if (!SMOKE_TOKEN) return
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${SMOKE_TOKEN}` },
    })
    const ok = res.status === 200
    log(ok, 'GET /me (with SMOKE_TOKEN) → 200', `status=${res.status}`)
  } catch (err) {
    log(false, 'GET /me (with SMOKE_TOKEN)', err.message)
  }
}

async function main() {
  if (SMOKE_INSECURE) process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

  console.log(`Smoke test against ${BASE_URL}\n`)

  await checkLive()
  await checkReady()
  await checkVersion()
  await checkMeNoToken()
  await checkMeWithToken()

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Smoke test error:', err)
  process.exit(1)
})

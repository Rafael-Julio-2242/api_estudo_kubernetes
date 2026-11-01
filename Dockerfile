# syntax=docker/dockerfile:1

ARG NODE_VERSION=22

# ── builder ──────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ src/
COPY migrations/ migrations/
COPY scripts/ scripts/

RUN npm run build

# ── runtime ──────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-slim AS runtime
WORKDIR /app

# Create non-root user
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -s /sbin/nologin -M appuser

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations

RUN mkdir -p /data && chown 10001:10001 /data

ARG APP_VERSION=dev
ARG GIT_SHA=unknown

ENV NODE_ENV=production \
    DATABASE_PATH=/data/notes.db \
    APP_VERSION=${APP_VERSION} \
    GIT_SHA=${GIT_SHA}

LABEL org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.source="https://github.com/your-org/notes-api"

USER 10001

EXPOSE 8080

CMD ["node", "dist/main.js"]

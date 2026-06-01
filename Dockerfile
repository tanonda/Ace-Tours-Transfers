# ─────────────────────────────────────────────────────────────────────────────
# Build stage — compile the client (Vite) + server (esbuild) bundles.
# Prerender is intentionally SKIPPED here (PRERENDER=0): Render does not expose
# DATABASE_URL during `docker build`, and prerender needs the DB to read the
# sitemap. Prerender instead runs at container startup (see runtime stage CMD).
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --include=dev --legacy-peer-deps

COPY . .
RUN PRERENDER=0 npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Runtime stage — official Playwright image: Node 20 + Chromium + all the
# system libraries Chromium needs, version-matched to the `playwright` package
# (1.53.0). This is what makes build-time-browser rendering reliable on Render,
# where the native Node runtime can't apt-install Chromium's dependencies.
# ─────────────────────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/playwright:v1.53.0-noble

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install full deps (incl. dev) — the startup prerender runs via tsx, a dev dep,
# and imports the TypeScript helpers in server/. Fresh install (not copied from
# the builder) so native modules match this image's platform/Node.
COPY package*.json ./
RUN npm install --include=dev --legacy-peer-deps

# Built bundles + the sources the runtime prerender script needs.
COPY --from=builder /app/dist ./dist
COPY scripts ./scripts
COPY server ./server
COPY shared ./shared
COPY migrations ./migrations
COPY drizzle.config.ts ./
COPY tsconfig.json ./

EXPOSE 5000

# Start the real server in the foreground (Render health check hits /api/health
# and passes quickly). Concurrently, the prerender runner polls that same server
# (PRERENDER_SKIP_SPAWN=1 → it does NOT spawn its own server) and writes static
# snapshots into dist/public, which the running server serves per-request as each
# file appears. `|| true` keeps a prerender failure from killing the container.
# IMPORTANT: target the server on whatever PORT the host injects (Render uses
# 10000, not 5000) — a hardcoded port would make prerender poll the wrong place,
# time out, and skip every page. ${PORT:-5000} keeps it correct everywhere.
CMD ["sh", "-c", "(PRERENDER_SKIP_SPAWN=1 PRERENDER_BASE_URL=http://localhost:${PORT:-5000} npm run prerender || true) & exec npm start"]

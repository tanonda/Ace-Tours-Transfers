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
RUN chmod +x ./scripts/start-with-prerender.sh

EXPOSE 5000

# The supervisor starts the server so the prerender can crawl it, but treats the
# prerender as a required startup phase. A failed or incomplete sitemap pass
# terminates the server and exits non-zero instead of silently serving SPA-only
# HTML. It also forwards container termination signals to the Node process.
CMD ["/app/scripts/start-with-prerender.sh"]

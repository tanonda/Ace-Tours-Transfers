# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm install

# Chromium for the build-time SEO prerender step (scripts/prerender.ts).
RUN npx playwright install --with-deps chromium

# Copy source and build. DATABASE_URL is passed at build time (--build-arg or
# BuildKit secret) so prerender can start the server and read /sitemap.xml.
# Absent DB => prerender is skipped non-fatally and the SPA shell ships as before.
COPY . .
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm install --omit=dev

# Copy built assets and necessary files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/package.json ./package.json

# Set env
ENV NODE_ENV=production
ENV PORT=5000

# Expose port
EXPOSE 5000

# Run migrations and start
CMD ["sh", "-c", "npm run db:migrate && npm start"]

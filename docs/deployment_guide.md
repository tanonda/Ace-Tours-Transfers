# Deployment & Environment Guide — Ace Tours & Transfers

**Production:** Render (Docker web service) + Neon PostgreSQL.
**Last updated:** 8 November 2026 (supersedes the old Fly.io-first guide).

The old `fly.toml` is kept only as a historical artifact — do not deploy to
Fly.io. Render is the supported target: `render.yaml` declares the service, the
Dockerfile builds client + server, and the SEO prerender runs at container
startup. For security-sensitive setup (private repo, secret rotation, access
rules) read [`SECURITY_HANDOVER.md`](./SECURITY_HANDOVER.md) first.

---

## 1. Environments

| Environment | Where | Purpose |
|---|---|---|
| Local | your machine + `.env` | Development, tests, sandbox card testing |
| Staging | separate Render service + separate Neon branch/database | PayZen/MPGS TEST mode, migration rehearsal, BRED integration |
| Production | Render `ace-tours-vanuatu` + Neon production | Live site `https://acetoursvanuatu.com` |

Never share one database or one `.env` between staging and production, and never
put production gateway keys in staging.

---

## 2. Environment variables

Full descriptions live in [`.env.example`](../.env.example) (the active minimal
skeleton is `.env.active.example`). Set these in **Render → web service →
Environment** in production, or in `.env` locally. Names only here:

### Required for the site to run

| Variable | Notes |
|---|---|
| `NODE_ENV` | `production` on Render |
| `APP_URL` | Public https origin, e.g. `https://acetoursvanuatu.com` |
| `VITE_APP_URL` | Build-time browser copy; passed as a Docker build ARG |
| `DATABASE_URL` | Neon connection string (`?sslmode=require`) |
| `SESSION_SECRET` | ≥ 32 random characters |
| `PAYMENT_CREDENTIALS_KEY` | 32-byte Base64; encrypts bank gateway credentials (losing/rotating it invalidates them) |

### Required for core features

| Variable | Feature |
|---|---|
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_URL` | Image uploads |
| `ADMIN_EMAIL`, `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Booking/admin e-mail (Gmail SMTP) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | SMTP transport (Render sets port `2525` for Gmail) |
| `BUSINESS_PHONE`, `WHATSAPP_NUMBER`, `BUSINESS_EMAIL` | Contact details used in e-mails |

### Optional / feature-specific

| Variables | Feature |
|---|---|
| `DATA_ENCRYPTION_KEY` | Separate MFA encryption key (falls back to `PAYMENT_CREDENTIALS_KEY`) |
| `DATABASE_SSL_CA`, `DATABASE_SSL_REJECT_UNAUTHORIZED` | Neon TLS overrides (emergency only for the latter) |
| `GOOGLE_REVIEW_URL` | Review link in post-tour e-mail |
| `BANK_NAME`, `BANK_ACCOUNT_NAME`, `BANK_ACCOUNT_NUMBER` | Bank-transfer fallback only — the admin setting is the source of truth |
| `SENTRY_DSN` | Error monitoring |
| `BETTERSTACK_API_KEY`, `BETTERSTACK_MONITOR_ID` | Uptime dashboard |
| `LOG_LEVEL`, `LOG_API_BODIES` | Logging (`LOG_API_BODIES` is debug-only and contains PII) |
| `SMS_PROVIDER`, `SMS_ADMIN_PHONE` | SMS notifications (default `console`) |
| `SMS_CLOUD_URL`, `SMS_CLOUD_LOGIN`, `SMS_CLOUD_PASSWORD` | SMS Gateway for Android |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | Twilio SMS |
| `VITE_TRUSTPILOT_BU_ID`, `VITE_TRUSTPILOT_URL` | Trustpilot widget (build ARG) |
| `VITE_GOOGLE_MAPS_EMBED_KEY` | Map embeds (build ARG) |
| `GOOGLE_PLACES_API_KEY`, `GOOGLE_PLACE_ID` | Google reviews/places |
| `VITE_COMING_SOON` | Coming-soon toggle (build ARG) |
| `FORCE_PRICING_ENGINE`, `SITEMAP_STATIC_LASTMOD` | Pricing / SEO overrides — normally unset |
| `GLOBAL_PAYMENTS_PAUSE`, `PAUSE_CARD_PAYMENTS`, `PAYMENTS_EXTERNAL_DISABLED`, `PAUSE_BANK_TRANSFER`, `NEW_BOOKINGS_PAUSE` | Emergency kill switches — leave unset normally |
| `PAYMENTS_ENABLED`, `PAYMENTS_DEFAULT_PROVIDER`, `PAYMENTS_MANUAL_ENABLED`, `MANUAL_PAYMENT_BANK_TRANSFER`, `MANUAL_PAYMENT_CASH_ON_DELIVERY` | Payment configuration (see caveat below) |
| `DDD_DISABLE_CARD`, `PAYMENTS_ANZ_ENABLED`, `PAYMENTS_BSP_ENABLED`, `PAYMENTS_NBV_ENABLED`, `PAYMENTS_BRED_ENABLED` | Per-gateway card switches |
| `PAYMENTS_STRIPE_ENABLED`, `PAYMENTS_STRIPE_VISIBLE`, `STRIPE_ENABLED`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | **Stripe is not used** (not available to Vanuatu merchants); keep off/unset |
| `VAT_RATE`, `DDD_VAT_RATE` | Parsed but **currently unread** — VAT is an Admin → Pricing setting |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Local `npm run db:seed` only; the seed refuses to run without both and refuses `NODE_ENV=production`. Never set these on Render. |

**Payment caveat:** `PAYMENTS_ENABLED` is exposed on `/api/config` but is **not
enforced** as a master switch. Real control is: `DDD_DISABLE_CARD=false` + the
bank's `PAYMENTS_<BANK>_ENABLED=true` + the gateway active in Admin → Payments.
Bank credentials are **not** environment variables — they are entered in
Admin → Payments and encrypted with `PAYMENT_CREDENTIALS_KEY`. The
`PAYMENTS_*_VISIBLE` values are parsed only and do not show/hide gateways.

VITE_* values are baked into the browser bundle at build time and are therefore
public. On Render they must be declared as Docker build ARGs; the Dockerfile
declares `VITE_APP_URL`, `VITE_COMING_SOON`, `VITE_GOOGLE_MAPS_EMBED_KEY`,
`VITE_TRUSTPILOT_BU_ID` and `VITE_TRUSTPILOT_URL`. Never put a secret in a
VITE_* variable.

---

## 3. Render deployment

1. Create a **Web Service** from the **private** GitHub repo.
   `render.yaml` declares: `runtime: docker`, `dockerfilePath: ./Dockerfile`,
   plan `starter`, health check `/api/health`.
2. Add the environment variables from §2 (the secrets are `sync: false` so they
   are entered in the dashboard, not committed).
3. Deploy. Render builds the Docker image:
   - builder stage: `npm install` + `PRERENDER=0 npm run build` (client + server);
   - runtime stage: the official Playwright image (`v1.53.0-noble`) so Chromium
     and its libraries are present.
4. Startup: `scripts/start-with-prerender.sh` starts the server and runs the
   **Playwright SEO prerender** against it, then serves normally. A failed or
   incomplete prerender exits non-zero instead of silently serving SPA-only HTML.
   Prerender needs `DATABASE_URL`, which Render only provides at runtime — that is
   why it is not part of the Docker build.
5. Verify `https://acetoursvanuatu.com/api/health` →
   `{ "status": "ok", "database": "connected" }`, and that the site serves
   prerendered HTML (view source on a tour page).

---

## 4. Neon database setup

1. Create the Neon project and copy the pooled connection string with
   `?sslmode=require` into `DATABASE_URL`.
2. Verify connectivity locally:
   ```bash
   npm run db:test
   ```
3. Apply the schema and seed **only on a development/staging database**:
   ```bash
   npm run db:migrate                       # applies every migrations/*.sql file
   SEED_ADMIN_EMAIL=you@example.com \
   SEED_ADMIN_PASSWORD='<long random>' \
   npm run db:seed
   ```
   `server/migrate.ts` applies all `.sql` files in filename order, each in a
   transaction, with an advisory lock and its own `drizzle_migrations_applied`
   tracking table. **Do not use `npm run db:push`** — it bypasses that tracking
   and the safety checks, and will drift production.
4. On Render, migrations also run automatically at boot
   (`server/index.ts` → `runIdempotentMigrations`). **Caveat:** a failure at boot
   is logged as a warning and the server keeps starting. After a deploy with new
   migrations, check for `[MIGRATIONS] Migration execution warning` in the logs;
   if present, fix it and run `npm run db:migrate` from a shell.
5. TLS: certificate verification is on by default. Set `DATABASE_SSL_CA` only
   when the runtime does not trust Neon's CA. `DATABASE_SSL_REJECT_UNAUTHORIZED=false`
   is emergency-only.

---

## 5. Cloudinary, e-mail and payments

- **Cloudinary:** set all four `CLOUDINARY_*` variables (the legacy upload path
  reads the three separate keys; `CLOUDINARY_URL` is used by the main service).
  Upload a test image from Admin → Tours to verify.
- **E-mail:** Gmail requires an App Password (not the account password). Render
  cannot reach port 587 in all cases; `render.yaml` sets `SMTP_PORT=2525`.
  Revoke/rotate the App Password when a person with access leaves.
- **Payments:** the live site is manual (cash / bank transfer placeholder) until
  BRED PayZen is enabled. Follow [`BRED_PAYZEN_GO_LIVE.md`](./BRED_PAYZEN_GO_LIVE.md)
  for TEST → PRODUCTION. Bank transfer account details are entered in
  Admin → Settings → Payments.

---

## 6. Verification and go-live

```bash
npm run check              # TypeScript (client + server projects)
npm test                   # Vitest
npm run check-architecture # ADR/DDD invariants
npm run go-live-verify     # production readiness script
```

Then work through [`PRODUCTION_VERIFICATION_CHECKLIST.md`](./PRODUCTION_VERIFICATION_CHECKLIST.md)
(including the card-gateway section) and the final sign-off at the end of that
file.

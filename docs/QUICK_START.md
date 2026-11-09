# Quick Start — Developer Onboarding

Ace Tours & Transfers is a full-stack booking site: **React + Vite** client,
**Node/Express + TypeScript** server, **Drizzle + Neon PostgreSQL**, and
**Cloudinary** for images. Read [`SECURITY_HANDOVER.md`](./SECURITY_HANDOVER.md)
before touching a real environment.

## 1. Requirements

- **Node 20** and npm 10 (`node -v`).
- A **Neon** PostgreSQL database for development (or a local Postgres — the app
  expects a `DATABASE_URL` with SSL options; Neon is what production uses).
- Optional: Cloudinary account (image uploads), SMTP/Gmail app password (e-mails),
  Playwright browser (only needed to run the prerender locally).
- No global tooling is required — everything runs through npm scripts.

## 2. Install

```bash
git clone <private-repo-url> Ace-Tours-Transfers
cd Ace-Tours-Transfers
npm install          # .npmrc already sets legacy-peer-deps=true
```

## 3. Environment

```bash
cp .env.active.example .env
```

Fill in the blanks (full variable reference: [`.env.example`](../.env.example)):

| Variable | Needed for |
|---|---|
| `DATABASE_URL` | Neon connection string, `?sslmode=require` |
| `SESSION_SECRET` | ≥ 32 chars: `openssl rand -base64 32` |
| `PAYMENT_CREDENTIALS_KEY` | 32-byte Base64; required to save/open bank gateway credentials |
| `APP_URL`, `VITE_APP_URL` | `http://localhost:5000` locally |
| `CLOUDINARY_*` | Image uploads (optional for booking-flow work) |
| `ADMIN_EMAIL`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `SMTP_*` | E-mails (optional locally) |

Do not set `SEED_ADMIN_*` on a server; they are only for the local seed. Never
commit `.env` or copy a production `.env` into development.

## 4. Database

```bash
npm run db:migrate        # applies every migrations/*.sql (transactional, tracked)
npm run db:test           # verify the Neon connection
SEED_ADMIN_EMAIL=dev@example.com \
SEED_ADMIN_PASSWORD='<long random password>' \
npm run db:seed           # admin + demo products + gateway rows
```

- `server/migrate.ts` applies all `.sql` files in order, each in a transaction,
  tracked in `drizzle_migrations_applied`. **Use it, not `npm run db:push`.**
- The seed refuses to run in production and refuses to run without both
  `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`. There is no default password.
- On boot (`server/index.ts`) the server also runs migrations, but only **warns**
  on failure — check the logs after a deploy.

## 5. Run, build, test

```bash
npm run dev          # Express + Vite middleware on http://localhost:5000
npm run dev:client   # optional: standalone Vite on :5001 (client-only work)
npm run check        # TypeScript: tsconfig.json + server/tsconfig.json
npm test             # Vitest (server/shared/client-lib tests, no DB needed)
npm run build        # compile client + server bundles into dist/
npm start            # run the built server (NODE_ENV=production)
```

Useful checks:

```bash
npm run check-architecture   # ADR/DDD invariants
npm run verify-ddd           # inventory invariants
npm run go-live-verify       # production readiness
npm run load-test            # concurrent booking load test (needs a DB)
```

## 6. Architecture map

| Path | What lives there |
|---|---|
| `client/` | React SPA: pages, components, `client/src/lib` (cart, payment helpers, tests). |
| `server/routes/` | HTTP endpoints only — no business rules. |
| `server/application/` | Use-case orchestration, payment routes/services, sagas, event handlers. |
| `server/domain/` | Aggregates and invariants: availability/holds, booking confirmation, pricing (`PricingService`/`PricingEngine`), payment state machine. |
| `server/infrastructure/` | Adapters: payments (PayZen, MPGS, Stripe stubs), storage, audit, jobs, projections, e-mail. |
| `server/storage.ts` | Drizzle-backed persistence/read queries. |
| `shared/` | `schema.ts` (Drizzle tables + Zod schemas), pricing rules, pure helpers/tests. |
| `migrations/` | Ordered `.sql` migrations (`server/migrate.ts` runner). |
| `scripts/` | Prerender, verification, maintenance and one-off scripts. |
| `docs/` | Runbooks, ADRs, architecture and handover documentation. |
| `Dockerfile`, `render.yaml` | Production build/deploy (Render Docker + Playwright prerender). |

Rules of the road: business logic belongs in `server/domain`, orchestration in
`server/application`, and money math only through `PricingService` (see
[`CONTRIBUTING.md`](../CONTRIBUTING.md) and [`docs/adr/`](./adr/)).

## 7. Where payments live

- Adapters: `server/infrastructure/payments/` (`payzen.adapter.ts`,
  `mpgs.adapter.ts`, `factory.ts`).
- Payment endpoints / checkout / IPN:
  `server/application/payment.routes.ts` (`/api/payments/*`, webhook
  `/api/payments/webhook/:gateway`).
- State transitions, refunds, manual review:
  `server/application/payment.application-service.ts`.
- Missed-IPN recovery: `server/application/payment-reconciliation.service.ts`.
- Hosted-payment form + guest UI: `client/src/pages/payment.tsx`,
  `client/src/lib/hosted-payment-form.ts`.
- Admin gateway credentials: `client/src/pages/admin/payments.tsx`
  (`shared/schema.ts` → `BredBankCredentialsSchema`).
- Card payments are **off** until BRED PayZen is enabled; see
  [`BRED_PAYZEN_GO_LIVE.md`](./BRED_PAYZEN_GO_LIVE.md) and
  [`PAYMENT_SANDBOX_TESTING.md`](./PAYMENT_SANDBOX_TESTING.md).

## 8. More docs

- [`SECURITY_HANDOVER.md`](./SECURITY_HANDOVER.md) — security findings, owner
  actions, safe access for external integrators.
- [`deployment_guide.md`](./deployment_guide.md) — Render + Neon deployment.
- [`BRED_PAYZEN_GO_LIVE.md`](./BRED_PAYZEN_GO_LIVE.md) — card go-live runbook.
- [`BOOKING_ENGINE_ARCHITECTURE.md`](./BOOKING_ENGINE_ARCHITECTURE.md),
  [`OPERATIONAL_RUNBOOK.md`](./OPERATIONAL_RUNBOOK.md),
  [`PRODUCTION_VERIFICATION_CHECKLIST.md`](./PRODUCTION_VERIFICATION_CHECKLIST.md).
- [`CODE_REVIEW.md`](../CODE_REVIEW.md) — review findings and fix status.

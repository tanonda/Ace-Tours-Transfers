# Client Handover Guide — Ace Tours & Transfers

This document covers everything needed to take ownership of the Ace Tours & Transfers website.

> **Read this first:** [`docs/SECURITY_HANDOVER.md`](./SECURITY_HANDOVER.md). The
> GitHub repository **must be private**, the repository history contains old
> credentials, and the working folder (`.env`, logs, `.kilo/`) must never be
> shared. Rotate secrets before giving anyone access.

---

## 1. What You're Receiving

| Component | Details |
|-----------|---------|
| **Website** | Full-stack booking platform (island tours and airport/wharf transfers; self-drive vehicle hire is retired) |
| **Source code** | **Private** GitHub repository at `github.com/tanonda/Ace-Tours-Transfers` (it must stay private) |
| **Database** | Neon PostgreSQL (serverless, managed) |
| **Image storage** | Cloudinary |
| **Error monitoring** | Sentry |
| **Uptime monitoring** | BetterStack |
| **Hosting** | **Render** (Docker web service, plan `starter`; `render.yaml` in the repo) |
| **Domain** | `acetoursvanuatu.com` (Hostinger) |

---

## 2. Accounts to Transfer

The following accounts need to be transferred to the client's email or the client needs their own accounts created.

| Service | What to do | URL |
|---------|------------|-----|
| **GitHub** | Keep the repository **private**; add the client as owner/collaborator (never make it public) | github.com |
| **Render** | Transfer the web service or create a new one under the client's email | render.com |
| **Neon** | Transfer project or create new project + migrate data | console.neon.tech |
| **Cloudinary** | Transfer account or create new (re-upload images) | console.cloudinary.com |
| **Sentry** | Transfer project or create new + update DSN | sentry.io |
| **BetterStack** | Transfer monitor or create new + update API key | betterstack.com |
| **Hostinger** | Transfer domain ownership to client | hostinger.com |
| **Gmail SMTP** | Client creates their own business mailbox + App Password | myaccount.google.com/apppasswords |
| **BRED / PayZen** | Merchant account + Back Office users (card go-live; see [`BRED_PAYZEN_GO_LIVE.md`](./BRED_PAYZEN_GO_LIVE.md)) | BRED Bank Vanuatu |

### After transfer, rotate all secrets

Follow the full checklist in [`SECURITY_HANDOVER.md`](./SECURITY_HANDOVER.md):
at minimum the Neon database password, `SESSION_SECRET`, `PAYMENT_CREDENTIALS_KEY`
(this one invalidates the stored gateway credentials — re-enter them in
Admin → Payments), `DATA_ENCRYPTION_KEY` (invalidates MFA enrolments), Cloudinary
API secret, Gmail App Password, SMS credentials, and every admin password. Create
a new admin on the business mailbox and remove the old personal-Gmail admin.

---

## 3. Hosting & Deployment

**Production runs on Render**, as a **Docker** web service (`render.yaml`:
`runtime: docker`, `dockerfilePath: ./Dockerfile`, health check `/api/health`).
The Dockerfile builds the Vite client and the server bundle, then starts the app
through `scripts/start-with-prerender.sh`, which runs the Playwright SEO prerender
at container startup (Render only exposes `DATABASE_URL` at runtime). Do not use
the old `fly.toml` — Fly.io is no longer the recommended target; it is kept only
as a historical artifact.

### Render (production)

1. Create a **Web Service** from the private GitHub repo; Render detects
   `render.yaml` (or set runtime **Docker**, Dockerfile path `./Dockerfile`).
2. Plan: **Starter** or above — the app runs background workers (hold expiry,
   reconciliation) and the startup prerender, so a free instance is not suitable.
3. Add every environment variable from `.env.example` in **Dashboard → the web
   service → Environment** (see [`deployment_guide.md`](./deployment_guide.md)
   for the list). `render.yaml` declares most of them; secrets are `sync: false`.
4. Deploy. Verify `https://acetoursvanuatu.com/api/health` returns
   `status: ok`, `database: connected`.
5. Keep the Neon database and the Render service in the same region if possible.

### Migrations on deploy

- **They run automatically at boot** (`server/index.ts` calls
  `runIdempotentMigrations`), and `server/migrate.ts` applies every `.sql` file in
  `migrations/` in filename order, each in a transaction, tracked in
  `drizzle_migrations_applied`.
- **Caveat:** if the boot migration fails the server **only warns and keeps
  starting** (the error is logged as `[MIGRATIONS] Migration execution warning`).
  Do not rely on it silently; after a deploy with new migrations check the logs,
  and run `npm run db:migrate` manually if the warning appears. Apply migrations
  to a Neon branch/staging database first.
- Never use `npm run db:push` against production; it skips the tracking table and
  the safety checks.

### Neon TLS

`DATABASE_URL` must include `?sslmode=require`. Certificate verification is on by
default; set `DATABASE_SSL_CA` only if the runtime does not trust Neon's CA.
`DATABASE_SSL_REJECT_UNAUTHORIZED=false` is an emergency escape hatch only — see
the warnings in `.env.example`.

---

## 4. Domain & DNS Setup

Domain `acetoursvanuatu.com` is on Hostinger. After deploying to a host:

1. Get the Render service hostname from the Render dashboard (Custom Domain)
2. In Hostinger DNS zone editor, update:
   - **A record** → Render's IP, or
   - **CNAME** for `www` → Render's provided hostname
3. Render issues and renews the SSL certificate automatically once DNS points at it.

### Email DNS Records (add in Hostinger DNS)
These improve email deliverability:

| Type | Host | Value |
|------|------|-------|
| TXT | `@` | `v=spf1 include:_spf.google.com ~all` |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:your-email@gmail.com` |

---

## 5. Admin Dashboard

Access at: `https://acetoursvanuatu.com/admin`

### Admin login
There is **no default admin password**. Create the production admin from
**Admin → Staff** (as an existing admin), or seed a *local development* admin by
setting `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` before `npm run db:seed`
(the seed refuses to run without them and refuses to run in production). Use a
business e-mail address, a long unique password, and enable MFA; remove any old
personal-Gmail admin.

### What the admin can do
- **Tours / Transfers**: Create, edit, pricing, availability, images (self-drive
  vehicle hire is retired)
- **Bookings**: View, confirm, cancel, and flag refunds
- **Payments**: View transactions and reconcile; card refunds are executed in the
  bank's (PayZen) Back Office first — see [`BRED_PAYZEN_GO_LIVE.md`](./BRED_PAYZEN_GO_LIVE.md)
- **CMS**: Edit page content, FAQ, site settings
- **Settings**: Business phone, WhatsApp, email, GTM, coming soon mode
- **Analytics**: Revenue, booking trends, capacity utilisation

---

## 6. Daily Operations

### Checking bookings
1. Login to admin dashboard → **Bookings**
2. New bookings arrive as "pending" (manual transfer/cash) or "confirmed" (auto)
3. For bank transfers: verify payment received → click **Confirm**. **Before
   relying on bank transfer, enter the real account details** in Admin → Settings
   → Payments: the seeded values are placeholders ("To be configured").
4. Card payments are **not live yet**. Once BRED/PayZen is enabled
   ([go-live runbook](./BRED_PAYZEN_GO_LIVE.md)), refunds are made in the PayZen
   Back Office and then recorded on the payment in the admin dashboard; a missed
   bank notification puts the payment in `manual_review_required` and e-mails the
   admin.

### Managing tours & availability
- **Add blackout dates**: Admin → Products → select tour → Blackout Dates
- **Change pricing**: Admin → Products → select tour → Pricing
- **Adjust capacity**: Admin → Products → select tour → Capacity

### Monitoring
- **Errors**: Check Sentry dashboard for any application errors
- **Uptime**: BetterStack sends alerts if the site goes down
- **Health check**: `https://acetoursvanuatu.com/api/health`

---

## 7. Ongoing Costs

| Service | Cost | Notes |
|---------|------|-------|
| **Neon** (database) | Free tier available (0.5 GB) | Paid from ~$19/mo for more storage |
| **Cloudinary** (images) | Free tier (25 GB bandwidth) | Sufficient for most use |
| **Render** | Starter ~$7/mo | **Required for production**: always-on workers + startup prerender; free tier cold-starts and idles. |
| **Sentry** | Free tier (5K errors/mo) | Sufficient for this scale |
| **BetterStack** | Free tier available | Basic uptime monitoring |
| **Hostinger** (domain) | ~$10-15/year | Domain renewal |
| **Gmail SMTP / business mailbox** | Free–low | Gmail App Password limits (~500 emails/day); prefer a business mailbox |
| **BRED PayZen** | Per agreement | Card fees only once enabled; see the go-live doc |

**Estimated monthly cost: ~$7–30/mo** (Render Starter + free tiers) before card fees.

---

## 8. Common Tasks

### Update site content
Admin dashboard → **CMS** → edit content blocks. Changes are live immediately.

### Enable/disable coming soon page
Admin dashboard → **Settings** → toggle "Coming Soon"

### Add a new payment method
See `docs/HOW_TO_ADD_PAYMENT_METHOD.md` — requires developer assistance.

### Backup the database
Neon provides automatic daily backups. For manual backup:
```bash
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
```

### Update the website code
```bash
git pull origin main
npm install
npm run build        # compile client + server bundles
npm run db:migrate   # apply any new .sql migrations (boot does this too, but see caveat in §3)
# Then let Render auto-deploy (push) or redeploy from the Render dashboard
```

### Payments
Card payments (BRED PayZen) have a separate go-live runbook:
[`BRED_PAYZEN_GO_LIVE.md`](./BRED_PAYZEN_GO_LIVE.md). Do not enable
`PAYMENTS_BRED_ENABLED` / `DDD_DISABLE_CARD` in production until the TEST phase
and the cutover in that document are complete.

---

## 9. Emergency Contacts & Procedures

### Site is down
1. Check BetterStack for alert details
2. Check the Render status page and the Render service logs
3. Check Neon's status page (database)
4. Redeploy or restart the service from the Render dashboard

### Database issue
1. Login to Neon console
2. Check connection count and storage usage
3. Neon has automatic recovery — most issues self-resolve

### Need a developer
The codebase includes comprehensive documentation in the `docs/` folder:
- `SECURITY_HANDOVER.md` — security findings, owner actions, safe access rules
- `QUICK_START.md` — Developer onboarding
- `BOOKING_ENGINE_ARCHITECTURE.md` — System design
- `OPERATIONAL_RUNBOOK.md` — Troubleshooting guide
- `deployment_guide.md` — Render/Neon deployment instructions
- `BRED_PAYZEN_GO_LIVE.md` — card-payment go-live runbook and BRED e-mail draft
- `.env.example` — All environment variables documented

---

## 10. Handover Checklist

- [ ] **GitHub repository made private** and access reviewed (see `SECURITY_HANDOVER.md`)
- [ ] Old credentials rotated (database, session, payment/MFA keys, Cloudinary, SMTP, SMS, gateway keys, admin passwords)
- [ ] Personal-Gmail admin removed; business-mailbox admin created with MFA
- [ ] Neon database ownership transferred
- [ ] Cloudinary account transferred
- [ ] Sentry project transferred
- [ ] BetterStack monitor transferred
- [ ] Hostinger domain transferred
- [ ] Render account/service moved to the client's email
- [ ] All environment variables set on Render (`npm run db:migrate` / boot migration logs checked)
- [ ] Site deployed and accessible; `/api/health` ok
- [ ] Bank-transfer account details entered in Admin → Settings → Payments
- [ ] SPF and DMARC DNS records added
- [ ] Client trained on admin dashboard
- [ ] GTM container ID set (if using Google Analytics)
- [ ] BRED PayZen card go-live completed (or explicitly deferred)
- [ ] Email SMTP switched to the client's business mailbox
- [ ] PayZen Back Office users are limited to the owner and the developer (Mark); no website-file access is granted for the BRED setup, and any extra user is revoked at the end

## 11. Hero video

Admin → CMS → Home Page (English tab) → **Hero video**.

- **Background video**: upload a landscape clip (MP4, WebM or MOV, up to 100 MB). The site
  plays the first 15 seconds, muted and looped, behind the headline on tablets and computers.
  Phones always show the photo, to save visitors' mobile data. **Remove video** goes back to the photo.
- **Short**: paste a YouTube Short, Instagram Reel or Facebook video link. It appears as a
  phone-shaped card beside the headline (a "Watch our video" button on phones) and plays when
  clicked. For Facebook, open the video and copy the full facebook.com address (not an fb.watch link).
- **Short cover image**: optional. YouTube supplies one. For Instagram and Facebook, upload a
  portrait image or a branded card is shown.
- **Also show on**: tick Tours, Transfers and/or About to show the same video there too.

Changes show on the site straight away. No redeploy is needed for the video itself.

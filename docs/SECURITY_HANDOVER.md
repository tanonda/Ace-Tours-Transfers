# Security & Handover — Ace Tours & Transfers

**Date:** 8 November 2026
**Status:** internal — do not share this file, the repository, or the working folder until the owner actions in §3 are done.
**Applies to:** `936b48a` (live commit) plus the handover changes in this branch.

This document records the security issues found before giving an external
integrator (Global Bedbank / BRED PayZen) access to the website, what has been
fixed in the code, and what only the owner can do. It also defines the access
rules for any future developer or bank-side integrator.

---

## 1. Current exposure findings

### 1.1 The GitHub repository was public

The remote is `git@github.com:tanonda/Ace-Tours-Transfers.git` and the
repository was **public** when this review was done. Anyone could read the full
source, the migrations, the docs and **the entire git history**. Until the
repository is private, treat every value ever committed as public.

### 1.2 Hardcoded credentials in tracked files

| Where | What was exposed | Status in this change |
|---|---|---|
| `script/update-admin-user.ts` | Admin e-mail and a **plaintext password**; the script rewrote the admin login to a personal Gmail address. The values are in the git history and were visible to anyone who read the public repo. | **File deleted.** Nothing imported it. |
| `server/seed.ts` | A default admin e-mail plus a literal password | **Rewritten.** The seed now requires `SEED_ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD` and refuses to run if either is unset. |
| `docs/archive/ADVISORY_IMPLEMENTATION_REPORT.md` | Placeholder Stripe secret/publishable keys (`sk_live_...`, `pk_live_...`) | **Removed**; Stripe is not used (not available to Vanuatu merchants). |
| `docs/CLIENT_HANDOVER.md` | Published the seeded default-admin password | **Removed**; the doc now points here and to Admin → Staff. |

The seed also keeps its existing guard: it refuses to run when
`NODE_ENV=production`.

### 1.3 Git history still contains the removed credentials

Deleting a file or changing a line does **not** remove it from history. Known
examples: commit **`240f98a`** added one-off admin scripts with plaintext
passwords (`create_saviera_admin.ts`, `check_user_exists.ts`, `list_users.ts`,
`update_live_settings.ts`); the seed password and the old update-admin script
appear in earlier commits as well. Anyone with read access to the repository can
`git log -S` them out.

Consequences:

- The repo **must be private** before access is granted.
- A handover copy should be produced with `git archive` of the *current* commit
  (see §4), not by copying the working folder or cloning full history.
- If history must ever be published, the owner has to decide on a history
  rewrite (`git filter-repo`) and force-push **after** rotating every secret
  below. Do not rewrite history on a shared remote without owner approval.

### 1.4 The working directory holds live secrets — never ZIP or share it

| Item | Why it is sensitive |
|---|---|
| `.env` | 53 values, including the live `DATABASE_URL`, `SESSION_SECRET`, `PAYMENT_CREDENTIALS_KEY`, Cloudinary keys, Gmail/SMTP app password, SMS credentials and monitoring keys. |
| `env.txt` | `PGUSER` / `PGPASSWORD` for the Neon database. |
| `server.log`, `server_debug.log`, `logs/`, `build_output.log`, `validation.log` | Contain guest PII (names, e-mails, booking data) and admin account records; the pre-handover audit flagged an admin bcrypt hash in local log state (the current `server.log` shows `[SCRUBBED]` for that field — assume any log copy may contain it). `server_debug.log` also contains site settings including the personal-Gmail admin address. |
| `.kilo/` | Agent/worktree state that contains full copies of the repository, including the deleted admin script and the old seed password. |
| `.remember/`, `.superpowers/` | Agent session state that can quote the same values. |
| `.git/` | Full history (§1.3). |

`.env`, `env.txt`, `*.log`, `.kilo` and `.remember` are gitignored and excluded
from the Docker build (`.dockerignore`), but they are still on disk in the
working folder. They are **not** part of a repository handover and must never be
sent to the integrator.

### 1.5 Personal Gmail used as the admin identity

The admin account created by the old script used a **personal Gmail address**, and
that address appears in `.env` (`ADMIN_EMAIL`, `GMAIL_USER`, `SMTP_USER`), in
`server_debug.log` and in the BRED e-mail draft. A personal Gmail account is not
an acceptable permanent administrator or SMTP identity for a business handover:
the owner must create a business mailbox/app password, move the admin account to
the business address, and disable the personal-Gmail admin (see §3).

### 1.6 Stale deployment assumptions

`fly.toml` is still tracked, and older docs call Fly.io "recommended", but the
live service runs on **Render** (Docker runtime, Neon database). This is not a
credential leak, but it misleads anyone setting up a staging environment — they
must use Render + Neon, not Fly. The docs in `docs/` have been corrected.

---

## 2. What this change fixes

- `script/update-admin-user.ts` deleted (no importers).
- `server/seed.ts` admin creation now requires environment variables; there is no
  password literal in the repository.
- Dummy Stripe keys removed from the archived advisory report.
- Handover, deployment, quick-start, PayZen sandbox and go-live docs rewritten /
  corrected; ADR-007 documents the PayZen decision; the June 2026 VPC/MIGS spec
  is marked superseded.
- A security/handover section is added to the production checklist and the code
  review.

It does **not** rotate any credential, make the repository private, or remove
secrets from git history. Those are owner actions.

---

## 3. Owner action checklist

Work in this order. Rotate a credential only after its replacement is stored in
the Render environment (or the appropriate console) so the site does not go
down; then deploy and verify (§3.2).

### 3.1 Access

1. [ ] **Make the GitHub repository private** (Settings → General → Danger Zone →
   *Change visibility*), or move it into a private organisation. This is the
   single highest-priority action.
2. [ ] Review collaborators, deploy keys, GitHub Apps, tokens and Actions
   secrets; remove anyone/anything no longer needed. If the repo was public,
   assume any token that ever touched it may have leaked.
3. [ ] Make sure GitHub 2FA is on for owner and any collaborator.
4. [ ] Rotate the Render deploy hook / API key and the GitHub token used by
   automation if either has ever been shared.

### 3.2 Secrets to rotate (all live values are in `.env` / Render today)

| # | Secret | Environment variables | Notes |
|---|---|---|---|
| 1 | Session signing key | `SESSION_SECRET` | ≥ 32 chars, e.g. `openssl rand -base64 32`. Rotating logs everyone out — safe. |
| 2 | Neon database password | `DATABASE_URL` | Create a new password/role in Neon, put the new URL in Render, keep SSL (`?sslmode=require`). The old URL must stop working. |
| 3 | Gmail / SMTP app password | `GMAIL_APP_PASSWORD`, `SMTP_PASS` (and `SMTP_USER`, `GMAIL_USER`, `ADMIN_EMAIL`) | Move to a business mailbox first if possible; revoke the old app password in the Google account. |
| 4 | Cloudinary API key/secret | `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_URL` | Regenerate in the Cloudinary console; the old key must be deleted. |
| 5 | SMS gateway credentials | `SMS_CLOUD_LOGIN`, `SMS_CLOUD_PASSWORD` (or `TWILIO_AUTH_TOKEN`) | Only if SMS is actually used; `SMS_PROVIDER=console` in production today. |
| 6 | Payment credentials encryption key | `PAYMENT_CREDENTIALS_KEY` | **Read the warning below before rotating.** |
| 7 | MFA encryption key | `DATA_ENCRYPTION_KEY` | Optional; falls back to `PAYMENT_CREDENTIALS_KEY`. Rotating it invalidates stored TOTP enrolments. |
| 8 | Bank gateway credentials | Admin → Payments (encrypted in DB) | BRED PayZen `testKey` / `productionKey`; ANZ/BSP/NBV MPGS passwords. Rotate in the bank's portal and re-enter in admin if they were ever exposed. |
| 9 | Admin passwords and MFA | `users` table / Admin → Staff | Change every admin password; remove the personal-Gmail admin; require MFA for admins. |
| 10 | Monitoring tokens | `SENTRY_DSN`, `BETTERSTACK_API_KEY` | Rotate if they were ever visible; low impact otherwise. |

**Local seeding only:** `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` replace the
old hardcoded seed admin. Set them for `npm run db:seed` on a development database
(long random password, business e-mail) and **never on Render/production** — the
seed refuses to run with `NODE_ENV=production`. Use Admin → Staff for the real
production admin account.

#### `PAYMENT_CREDENTIALS_KEY` and `DATA_ENCRYPTION_KEY` — important

The bank gateway credentials (Shop ID, PayZen TEST/PRODUCTION keys, MPGS
passwords) are **not** stored in plain text in the database: they are sealed with
AES-256-GCM using `PAYMENT_CREDENTIALS_KEY`.

- Rotating `PAYMENT_CREDENTIALS_KEY` **makes every stored gateway credential
  unreadable**. After rotation the admin must re-enter the PayZen/MPGS
  credentials in **Admin → Payments** before card payments can work again.
- Plan the rotation together with a gateway re-entry (and keep a temporary
  `PAYMENTS_BRED_ENABLED=false` / `DDD_DISABLE_CARD=true` while doing it).
- `DATA_ENCRYPTION_KEY` (when set) encrypts MFA/TOTP secrets. Rotating it
  **invalidates MFA enrolments**: admins must re-enrol. If it is left unset, MFA
  uses `PAYMENT_CREDENTIALS_KEY`, so rotating that key has the same effect.
- Neither key is recoverable. Store both in a password manager before changing
  them.

### 3.3 After rotating — verify

1. [ ] Deploy on Render and check `/api/health` returns `status: ok`,
   `database: connected`.
2. [ ] Log in as an admin; open **Admin → Payments** and confirm the BRED/MPGS
   credentials still load (re-enter them if the encryption key was rotated).
3. [ ] Make a test booking and confirm the guest + admin e-mails arrive.
4. [ ] Upload an image in **Admin → Tours** and confirm it appears in Cloudinary.
5. [ ] Confirm no old credential works any more (old DB URL fails, old app
   password fails, old session is rejected).
6. [ ] Check the Neon and PayZen Back Office logs for activity you cannot explain.
7. [ ] Record the rotation date and who rotated each secret.

### 3.4 If a secret may already have been used by someone else

Assume compromise and follow §3 in order — do not wait to prove it. In addition:
check **Admin → Audit Log** for unexpected admin changes, review the PayZen/MPGS
Back Office transaction list for unknown payments/refunds, and review Render
deploy/access logs.

---

## 4. Safe handover rules for an external integrator

BRED's team (John Lew / Global Bedbank) needs to see how the PayZen integration
is wired, but **does not need the production website files, database, `.env`,
logs, domain or credentials.** Use this access path:

### 4.1 What the integrator may get

1. **A private repository, read-only collaborator** — invite the integrator's
   GitHub account to the private repo with the **Read** role (not Write, not
   Admin), or give them a sanitised snapshot:
   ```bash
   # Only after the repo is private and this branch is committed:
   git archive --format=zip --prefix=ace-tours/ HEAD -o ace-tours-handover.zip
   ```
   `git archive` contains only the files at that commit — not `.env`, not logs,
   not `.git` history, not the deleted admin scripts. Never send a ZIP of the
   working folder, and never include `.git/`.
2. **A staging deployment** — a separate Render web service + a separate Neon
   branch/database with non-production data, its own `PAYMENT_CREDENTIALS_KEY`,
   and **TEST-mode** credentials only. Connect it to the PayZen **test** shop.
   Production database, production admin account and production PayZen keys stay
   with the owner.
3. **A separate PayZen Back Office user** for the integrator (not the owner's
   login), scoped to what the bank allows. The owner keeps the merchant
   account/settlement authority.
4. **A reviewed PR + CI path**: the integrator works on a branch/PR; CI
   (`.github/workflows/verify.yml`) must pass (`npm run check`, `npm test`) and
   the owner (or owner's developer) reviews and merges. No direct pushes to
   `main`; no force-pushes.

### 4.2 What must never be handed over

- The production `.env`, any copy of it, `env.txt`, server logs, `.kilo/`,
  `.remember/`, `.superpowers/` or a working-folder ZIP.
- Production database credentials or a dump unless a separate, explicit data
  transfer is agreed (not needed for the PayZen integration).
- Production PayZen `productionKey`, the owner's PayZen login, Render account,
  Neon account, domain/DNS credentials, or access to the live database.
- The production admin account or a production admin password.

### 4.3 End of engagement

- [ ] Remove the GitHub collaborator and the staging environment.
- [ ] Revoke the integrator's PayZen Back Office user.
- [ ] Rotate any credential they were given (staging-only keys included) and
      review audit logs.
- [ ] If the repo was ever made public again, repeat §1–§3.

---

## 5. Related documents

- [`docs/BRED_PAYZEN_GO_LIVE.md`](./BRED_PAYZEN_GO_LIVE.md) — PayZen go-live
  runbook and the ready-to-send reply to BRED.
- [`docs/CLIENT_HANDOVER.md`](./CLIENT_HANDOVER.md) — business handover guide.
- [`docs/deployment_guide.md`](./deployment_guide.md) — Render/Neon deployment.
- [`docs/PRODUCTION_VERIFICATION_CHECKLIST.md`](./PRODUCTION_VERIFICATION_CHECKLIST.md)
  — go-live checks, including the card-gateway section.
- [`CODE_REVIEW.md`](../CODE_REVIEW.md) — security review and residual items.

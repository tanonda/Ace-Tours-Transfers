# Ace Tours & Transfers — PayZen Integration Technical Overview

**Prepared for:** BRED Bank (Vanuatu) / Global Bedbank technical review
**Prepared by:** Mark, developer, Ace Tours & Transfers (`markmal64@gmail.com`)
**Date:** 9 November 2026
**Repository state:** source code as deployed in `8cdd99a`; this document is shareable and contains no credentials, customer data or production configuration.

---

## 1. Purpose and scope

Ace Tours & Transfers (`https://acetoursvanuatu.com`) is a booking platform for tours and airport transfers in Port Vila, Vanuatu. This document describes the **card-payment integration built for BRED Bank Vanuatu's Lyra PayZen hosted payment page**, so that BRED's and Global Bedbank's technical teams can review the design before the TEST/PRODUCTION cutover.

It covers:

- the checkout → PayZen → IPN → booking flow;
- signatures, status handling, refunds and reconciliation;
- the security controls around card payments;
- what remains to be configured by BRED;
- the code map and verification evidence.

It does **not** contain production credentials, the production database, customer records or the working-directory `.env`.

---

## 2. System context

| Component | Technology |
|---|---|
| Storefront | React 19 + Vite + Tailwind, TypeScript, server-side rendered where appropriate (prerender for public pages) |
| API / booking engine | Node.js 20, Express 5, TypeScript, Drizzle ORM |
| Database | Neon PostgreSQL (serverless) |
| Media | Cloudinary |
| Hosting | Render (Docker runtime, Playwright-based prerender at startup) |
| Card payments | BRED Bank Vanuatu — Lyra PayZen Hosted Payment Page (VADS V2 form API) |
| Other payments | Bank transfer and cash (manual, admin-confirmed); other gateway adapters exist but are inactive |

Card data never reaches the Ace Tours server. The customer enters card details on the PayZen page; the site only receives the signed result notification.

---

## 3. Payment flow

### 3.1 Checkout creation

1. The guest creates a booking. The booking starts as `pending` and reserves inventory through an availability hold.
2. The server creates a `payments` row: internal payment ID, booking ID, amount (whole VUV), currency `VUV`, status `pending`.
3. The PayZen adapter builds a signed form and returns it to the browser. The browser POSTs the form to the PayZen hosted payment page.
4. The payment row moves to `processing` and is given a short checkout expiry.

### 3.2 Signed form fields

The adapter sends the VADS V2 hosted-payment fields:

| Field | Value |
|---|---|
| `vads_action_mode` | `INTERACTIVE` |
| `vads_amount` | whole-vatu amount — VT 5,000 is sent as `5000` (VUV is a zero-decimal currency) |
| `vads_capture_delay` | `0` (same-day capture) |
| `vads_ctx_mode` | `TEST` or `PRODUCTION`, from the gateway credentials |
| `vads_currency` | `548` (ISO 4217 VUV) |
| `vads_order_id` | internal payment ID, so the IPN can resolve the exact payment |
| `vads_page_action` | `PAYMENT` |
| `vads_payment_config` | `SINGLE` |
| `vads_site_id` | 8-digit PayZen Shop ID |
| `vads_trans_date` | UTC, `YYYYMMDDHHMMSS` |
| `vads_trans_id` | random 6-character transaction number |
| `vads_url_cancel`, `vads_url_refused`, `vads_url_return`, `vads_url_success` | browser return URLs (UX only) |
| `vads_validation_mode` | `0` (automatic validation) |
| `vads_version` | `V2` |
| `signature` | HMAC-SHA-256, Base64, over the `vads_*` values sorted by field name and joined with `+`, then `+key` |

No guest-typed value (for example, the customer email) is included in the signed form. This is deliberate: PayZen signs field **values**, so values containing `+` could otherwise be re-split under different field names into a validly signed forged notification. Values containing `+` are refused before signing, and signed checkout forms are rejected if replayed as IPNs.

### 3.3 Browser return and server notification

The browser return URLs (`/payment/success`, `/payment/cancel`) are for the customer experience only.

The authoritative result is the server-to-server **Instant Payment Notification (IPN)**:

- Endpoint: `POST https://acetoursvanuatu.com/api/payments/webhook/bred-bank`
- Body: form-encoded `vads_*` fields.
- The route is CSRF-exempt because PayZen cannot send a CSRF token; the HMAC signature is the authentication.
- The route answers in plain text (`200` accepted, `400` rejected), which PayZen records and retries on non-200.

### 3.4 IPN verification

An IPN is accepted only if all of the following hold:

1. `vads_site_id` equals the configured 8-digit Shop ID.
2. `vads_ctx_mode` equals the configured mode (`TEST` or `PRODUCTION`).
3. The HMAC-SHA-256 signature verifies with the matching key.
4. The notification markers are present: `vads_hash`, `vads_trans_status`, `vads_trans_uuid` — a signed checkout form cannot be replayed as a notification.
5. The payment exists, belongs to the `bred-bank` gateway, and the amount/currency match the stored payment. A mismatch sets the payment to `manual_review_required` and alerts the admin; it is never marked paid.

### 3.5 Status mapping

| PayZen `vads_trans_status` | Site status |
|---|---|
| `AUTHORISED`, `CAPTURED` | `completed` |
| `REFUSED`, `CAPTURE_FAILED` | `failed` |
| `ABANDONED`, `CANCELLED` | `cancelled` |
| `EXPIRED` | `expired` |
| `AUTHORISED_TO_VALIDATE` | `manual_review_required` |
| `INITIAL`, `UNDER_VERIFICATION`, `WAITING_AUTHORISATION`, `WAITING_AUTHORISATION_TO_VALIDATE`, `WAITING_FOR_PAYMENT`, `SUSPENDED` | unchanged — a later IPN is expected |
| Any unknown status | `manual_review_required` — never guessed paid |

A `completed` payment emits the site's `PaymentConfirmed` domain event, which confirms the booking and sends the guest/admin emails. Duplicate IPNs are idempotent: a callback for an already-terminal payment does not confirm twice, and a replayed debit cannot resurrect a refunded payment.

---

## 4. Refunds

Refunds are **executed in the PayZen Back Office**, not by the website. The site never holds full card numbers and has no refund API for PayZen.

When a refund is made, PayZen sends a `CREDIT` notification. The site records it against the payment:

- `refunded_amount` — total refunded, whole VUV;
- `refunded_at` — time of the latest refund notification;
- `refund_reference` — PayZen transaction reference;
- a full refund sets the payment to `refunded`;
- a partial refund leaves the payment `completed` with the refunded amount tracked;
- a refund for a payment that was not completed is held for `manual_review_required`;
- duplicate notification references are ignored; over-refunds are capped and flagged;
- if a `CREDIT` IPN is missed, an admin can record the refund through the reconciliation screen (required note; writes the same fields and an audit entry).

The terminal states for automated callbacks are `completed`, `failed`, `cancelled`, `expired` and `refunded`. A person, not a callback, must undo a refund.

---

## 5. Missed notifications and reconciliation

PayZen is configured here as **notification-only**: the integration has no status-query API, so the IPN is the only authoritative result.

If an IPN never arrives (for example, the customer closes the browser after paying), the reconciliation worker:

1. waits until the payment's checkout window has passed;
2. moves the payment to `manual_review_required` with `failureReason = ipn_not_received`;
3. emails the admin with the payment/booking/gateway references;
4. holds the review for 72 hours before the normal expiry path applies.

The payment is never silently cancelled or guessed paid. The admin checks the PayZen Back Office and then either confirms the booking, expires the payment, or refunds and records the refund.

A separate manual reconciliation screen lets an admin sync/force a payment state or record a refund, with an audit entry.

---

## 6. Security controls

- **No card data on our servers.** Hosted payment page only; no PAN/CVV storage, no cardholder data environment.
- **HMAC-SHA-256 signatures** on both the outgoing form and incoming IPN; timing-safe comparison.
- **Signature-confusion and replay guards** (see §3.2/§3.4); a signed form cannot be replayed as an IPN.
- **Shop ID and mode binding.** A notification for another shop or for TEST while the shop is PRODUCTION is rejected.
- **TEST isolation.** A gateway in TEST mode is hidden from guests and refused for non-admin checkout, so published test card numbers cannot confirm a real booking. Only admins can run test payments.
- **Amount and currency verification.** A mismatch is held for manual review and alerts the admin.
- **Credentials encrypted at rest.** Gateway credentials are sealed with AES-256-GCM using a key held only in the hosting environment; a missing key means the gateway cannot run.
- **Kill switches.** Global payments pause, card-payments pause, external-gateway disconnect and per-gateway environment switches block new payments; a kill switch never blocks resolution of money already in flight.
- **Admin controls.** Role checks re-read from the database per request, CSRF double-submit protection, audit logging of payment/reconciliation actions, optional TOTP MFA.
- **Transport.** HTTPS everywhere; Secure/HttpOnly/SameSite session cookies; `form-action` CSP restricted to the site and `https://secure.payzen.eu` (updated if BRED supplies a different payment page host).
- **Logging.** Signatures, keys and card data are never logged.

---

## 7. What is still required from BRED

The integration is built and deployed. The remaining work is BRED-side shop configuration:

1. Online merchant account for card payments in the business name, settling to our BRED account.
2. PayZen Back Office access for the owner (Savi) and a separate user for the developer (Mark). BRED's records should list **Mark** as the technical contact for the website/payment integration; Savi remains the merchant-account holder.
3. The 8-digit Shop ID.
4. The TEST key, and the process for issuing the PRODUCTION key after testing.
5. **VUV enabled on the shop** — VUV is not in PayZen's default currency table.
6. Confirmation that VUV amounts are accepted in whole vatu (`vads_amount=5000`, not `500000`).
7. The payment page URL: the standard `https://secure.payzen.eu/vads-payment/` or a BRED-specific address.
8. Signature algorithm set to **HMAC-SHA-256**.
9. Same-day automatic capture, no per-payment manual validation.
10. **3-D Secure** enabled (the site does not control this; it is shop configuration).
11. IPN URL for test and production set to `https://acetoursvanuatu.com/api/payments/webhook/bred-bank`, with automatic retry on failure.
12. Test card numbers and the number of test payments required before the production key is issued.
13. Fees (per transaction and monthly), settlement timing, and the refund process.

---

## 8. Environments, deployment and verification

- **Production:** `https://acetoursvanuatu.com`, currently running commit `8cdd99a`; database connected; migrations applied at container start.
- **TEST:** to be run against a staging deployment and the PayZen TEST shop with TEST credentials. A gateway in TEST mode is visible only to admins.
- **Database migration for refunds:** `0034_payment_refunds.sql` applied in production on 9 November 2026.
- **Automated verification:** TypeScript checks pass for both client and server projects; **979 tests across 130 files** pass, including PayZen adapter/signature/IPN tests, refund tests, missed-notification tests and admin refund helpers; architecture/DDD checks pass; a production build completes.
- **Go-live sequence:** configure the TEST shop → admin-only TEST booking (success, decline, replay, refund, missed IPN) → enter PRODUCTION key and switch mode → one controlled live payment and refund → enable the card option for guests.

---

## 9. Code map for reviewers

| Path | Purpose |
|---|---|
| `server/infrastructure/payments/payzen.adapter.ts` | VADS V2 form construction, IPN verification/status mapping, refund notification reporting |
| `server/infrastructure/payments/payzen-signature.ts` | HMAC-SHA-256 form/IPN signature and timing-safe verification |
| `server/application/payment.routes.ts` | Checkout endpoint, IPN route, admin reconciliation endpoint |
| `server/application/payment.application-service.ts` | Payment state machine, amount/currency checks, refund recording, emails |
| `server/application/payment-reconciliation.service.ts` | Stale-payment and missed-IPN handling, manual reconciliation |
| `server/application/webhook-body.ts` | Per-gateway webhook body normalisation (PayZen form fields vs JSON vs raw) |
| `server/domain/payments/interfaces.ts` | Gateway adapter contract, including notification-only capability |
| `shared/schema.ts` → `BredBankCredentialsSchema` | Shop ID/mode/keys/payment URL validation |
| `client/src/pages/admin/reconciliation.tsx` | Admin refund recording/status UI |
| `docs/PAYMENT_SANDBOX_TESTING.md` | TEST-mode setup and acceptance checklist |
| `docs/adr/ADR-007-BRED-PAYZEN.md` | Architecture decision record |

Tests: `payzen-signature.test.ts`, `payzen.adapter.test.ts`, `payment.routes.payzen.test.ts`, `payment.routes.webhook-body.test.ts`, `payment.application-service.refund.test.ts`, `payment-reconciliation.service.test.ts`.

---

## 10. Known limitations / out of scope

- **VUV only.** The booking flow and adapter charge VUV; other currencies are display-only. Accepting AUD/USD would require pricing/FX and adapter changes.
- **Notification-only.** There is no PayZen status-query API configured; a missed IPN is an operational review task (see §5), not an automatic sync.
- **Refunds are portal-driven.** The site records refunds; it does not initiate them.
- **No merchant-fee/settlement ledger.** The site records gross amounts; BRED's fee and settlement are reconciled outside the app for now.
- **Tax-invoice snapshot** is a follow-up; the current payment record is not a tax invoice.
- **Other gateway adapters** (ANZ/BSP/NBV MPGS, Stripe, PayPal, mobile money/wallets) exist but are inactive; the live site currently offers cash on delivery only until the BRED setup is complete.

---

## 11. Read-only snapshot (if provided separately)

A read-only snapshot may accompany this overview. It contains the repository at the deployed source commit, limited to the code needed to review the integration:

- `server/`, `shared/`, `client/src/`, `migrations/`, `scripts/`, test files and build/type configuration;
- this overview, the PayZen sandbox guide and the ADR;
- a `SNAPSHOT_README.md` with the commit hash and checksum.

It excludes the Git history, `.env`/environment files, logs, the working folder, customer data, internal security/handover notes and the production database. It is read-only: no production code or credentials are changed by sharing it.

---

## 12. Contact

**Mark** — developer, Ace Tours & Transfers  
`markmal64@gmail.com` · `https://acetoursvanuatu.com`

**Saviera (Savi) Alexis** — owner, Ace Tours & Transfers  
`acetoursvanuatu@outlook.com`

**Michael Dan** — E-Banking Merchant Officer, BRED (Vanuatu) Limited  
`mdan@bred.vu`

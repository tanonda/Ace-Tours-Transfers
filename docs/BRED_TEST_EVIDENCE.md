# BRED PayZen — TEST Evidence & Endpoint Checks

**For:** owner/operator and the developer doing the BRED go-live
**Prepared by:** Mark, developer · 10 November 2026
**Related:** `BRED_PAYZEN_GO_LIVE.md` §4–§5 · `PAYMENT_SANDBOX_TESTING.md`
**Safe to share with BRED:** no secret keys on this page. Record references and results, never the Test/Production key or full card numbers.

> **Purpose:** prove the website ↔ PayZen connection works and record the TEST
> evidence BRED needs before issuing the production key.

---

## 1. Before you start

**1.1 Environment** (staging Render service, separate database, key set):

```dotenv
PAYMENT_CREDENTIALS_KEY=<staging key>
DDD_DISABLE_CARD=false
PAYMENTS_BRED_ENABLED=true
# GLOBAL_PAYMENTS_PAUSE / PAUSE_CARD_PAYMENTS / PAYMENTS_EXTERNAL_DISABLED unset
```

**1.2 Admin → Payments → BRED Bank → Configure**

| Field | TEST value |
|---|---|
| Shop Id | 8-digit Shop ID from the Back Office |
| Mode | **TEST** (dropdown) |
| Test Key | the TEST key (paste) |
| Production Key | leave empty |
| Payment Url | empty unless BRED gives a special page |

Save, then switch the BRED gateway **active**. Do not make it the guest default yet.

**1.3 PayZen Back Office (test shop)**

- Notification (IPN) URL = `https://<test-host>/api/payments/webhook/bred-bank`
- Signature = **HMAC-SHA-256**
- Currency **VUV** enabled, whole vatu
- Same-day automatic capture, **3-D Secure** on
- Test cards supplied by BRED / PayZen

---

## 2. Endpoint checks (run first, no payment needed)

The checker calls the public API, the CSP header, and the IPN route, then sends one
**correctly signed probe** for a random order reference — so it proves the key and
signature handling without charging anything or changing a payment.

```bash
BRED_SHOP_ID=12345678 BRED_TEST_KEY='<test key>' \
  npm run check:bred-endpoint -- --base-url https://<test-host>
```

Expected output (4 passes):

```text
[PASS] Public gateway list — HTTP 200, 1 visible (cash) — bred-bank hidden from guests (expected while inactive or in TEST mode)
[PASS] CSP form-action — 'self' https://secure.payzen.eu
[PASS] Unsigned webhook rejected — 400 text/plain "Invalid PayZen IPN signature."
[PASS] Signed webhook accepted — 400 text/plain "Payment not found for the notification order reference." — signature verified, unknown order left untouched.
```

How to read a failure:

| Check output | Meaning / fix |
|---|---|
| `Public gateway list` FAIL | Site unreachable, TLS problem, or `/api` not served on that host |
| `CSP form-action` FAIL | Deployment is old, or the page can't POST to PayZen — redeploy; if BRED gave a custom page, save it in **Payment Url** |
| `Unsigned webhook` 404 / 405 | Wrong host/path, or the webhook route is not mounted |
| `Signed webhook … Invalid PayZen IPN signature` | **Test Key** in Admin → Payments does not match BRED's test key |
| `Signed webhook … different PayZen shop` | Shop ID mismatch — check the 8 digits |
| `Signed webhook … does not match shop mode` | Credential Mode is not the one the probe used (`--ctx-mode`) |
| `Signed webhook … Gateway is not active` | Switch the BRED gateway active (Admin → Payments) |
| `Signed webhook` HTTP 500 | Deployment predates the unknown-order guard — redeploy |

> Optional: pass `--payment-url https://<BRED page>/vads-payment/` to confirm the CSP
> allows a BRED-specific payment page.

---

## 3. Round-trip check from the PayZen Back Office

This is the signed, real notification path.

1. In the Back Office, open a TEST transaction (from step 4 below) — or make one test
   payment first.
2. Use the transaction's **notification / resend IPN** action (label varies with the
   PayZen version) to send the notification to the URL configured in §1.3.
3. In the Render logs, confirm:
   - `POST /api/payments/webhook/bred-bank 200`
   - `[WEBHOOK][bred-bank]` line with the transaction status
4. The Back Office log shows the reply text; a 200 means the site accepted and
   processed it.
5. In the site, confirm the payment is `completed` and the booking is `confirmed`
   (see §5 "Where to look").
6. Repeat the resend — it must **not** confirm twice.

A 400 reply means the notification was rejected; the Render log gives the reason
(wrong shop, wrong mode, bad signature). Re-run §2 to locate it.

---

## 4. TEST scenario evidence log

Fill one row per scenario. Attach screenshots or log lines. **Never write keys or
card numbers here** (last 4 digits only).

| # | Scenario | Date / time | Order / payment ref | Amount (VUV) | Result seen on site | Evidence (Render log / Back Office ref) | Pass? |
|---|---|---|---|---|---|---|---|
| 1 | Successful test-card payment (3-D Secure if prompted) | | | | `completed`, booking `confirmed`, guest + admin e-mail once | | ☐ |
| 2 | Declined card | | | | `failed`; booking stays `pending`; hold expires | | ☐ |
| 3 | Cancelled / abandoned payment | | | | `cancelled` | | ☐ |
| 4 | Replay the same IPN | | | | No second confirmation / no double-charge | | ☐ |
| 5 | Unsigned or forged IPN | | | | `400` rejected, nothing changed | | ☐ |
| 6 | Wrong amount or currency | | | | `manual_review_required` + admin alert e-mail | | ☐ |
| 7 | Full refund in the Back Office | | | | `refunded`, refund reference recorded | | ☐ |
| 8 | Partial refund in the Back Office | | | | `completed` with `refunded_amount` set | | ☐ |
| 9 | Missed IPN (no notification delivered) | | | | `manual_review_required` + admin e-mail after the window | | ☐ |
| 10 | TEST gateway is admin-only | | | | Guest sees no card option; admin can pay | | ☐ |
| 11 | **Production:** one controlled live payment | | | | `completed`, booking `confirmed`, IPN logged 200 | | ☐ |
| 12 | **Production:** refund that payment | | | | `refunded` / refund recorded | | ☐ |

Keep the count: BRED may ask how many TEST payments were made before issuing the
production key.

### Where to look

| To confirm… | Look at |
|---|---|
| Booking paid / confirmed | **Admin → Bookings** (status `confirmed`) |
| Guest sees the result | `/payment/success?booking=…` — flips to Confirmed when the IPN lands |
| Payment status / refund recorded | Payment record (admin API `GET /api/admin/payments`) or the PayZen Back Office |
| Stuck or held payment | **Admin → Management & Reconciliation → Stale Online** |
| Notification received and its reply | Render logs: `POST /api/payments/webhook/bred-bank`, `[WEBHOOK][bred-bank]` |
| Bank-side transaction | PayZen Back Office transaction list (order ID = site payment ID) |

---

## 5. Sign-off

| Milestone | Name | Date | Reference |
|---|---|---|---|
| TEST complete (all rows 1–10 pass) | | | |
| Evidence attached / shared with BRED | | | |
| Production key issued by BRED | | | |
| Production payment (row 11) verified | | | |
| Production refund (row 12) recorded | | | |
| Card option enabled for guests | | | |
| Rollback plan acknowledged (`PAYMENTS_BRED_ENABLED=false` / `DDD_DISABLE_CARD=true`) | | | |

**Go-live is not complete until rows 1–12 pass and this sheet is signed.**

---

## 6. Where the detail is

| Document | Use |
|---|---|
| `BRED_PAYZEN_GO_LIVE.md` | Full runbook: configuration, cutover, refunds, e-mail drafts |
| `PAYMENT_SANDBOX_TESTING.md` | Field-level TEST-mode reference |
| `BRED_PAYZEN_BANK_SETUP_SHEET.md` | Plain-language settings to give BRED |
| `scripts/check-bred-endpoint.mjs` | The endpoint checker used in §2 |

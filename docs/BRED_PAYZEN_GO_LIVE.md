# BRED PayZen Card Payments — Go-Live Runbook

**Date:** 8 November 2026
**Status:** integration code complete in this repository — the PayZen adapter,
IPN, admin form and tests shipped in the live commit `936b48a`; the refund ledger
(`refunded_amount` / `refunded_at` / `refund_reference`) and the missed-IPN
manual-review recovery are in the current branch (not yet deployed at the time of
writing). **Card charging is not live yet** — it is waiting on the BRED
merchant/PayZen setup below.
**Audience:** owner/operator, and any developer doing the BRED go-live.
**Related:** [`ADR-007`](./adr/ADR-007-BRED-PAYZEN.md),
[`SECURITY_HANDOVER`](./SECURITY_HANDOVER.md),
[`PAYMENT_SANDBOX_TESTING`](./PAYMENT_SANDBOX_TESTING.md).

---

## 1. Current state

| Item | State on 2026-11-08 |
|---|---|
| PayZen integration in the code | **Complete** — adapter, signature, IPN route, admin credentials form, tests. Refund recording and missed-IPN review are in the current branch. |
| Live site (`https://acetoursvanuatu.com`) | **Cash on delivery only** (verified 8 Nov 2026: `/api/payment-gateways` returns just `cash`). `DDD_DISABLE_CARD=true` and `PAYMENTS_BRED_ENABLED=false` in `render.yaml`; the BRED gateway is inactive. |
| Bank transfer | **Not currently offered to guests** even though `render.yaml` sets `PAYMENTS_MANUAL_ENABLED=true` — the production gateway row/feature flag is disabled. Its account-number setting is also still the placeholder `To be configured` (Admin → Settings → Payments → `bank_transfer_account_number`). Fix both when enabling it. |
| BRED merchant account / PayZen shop | **Not finished** — that is the 13-point list in §3. |
| Card charging | **Off.** Do not turn it on until §4 (TEST) and §5 (cutover) are complete. |

What already exists in the repository:

| File | Purpose |
|---|---|
| `server/infrastructure/payments/payzen.adapter.ts` | Builds the signed VADS V2 hosted-payment form and validates the IPN. |
| `server/infrastructure/payments/payzen-signature.ts` | HMAC-SHA-256, Base64, values sorted by field name and joined with `+`. |
| `server/application/payment.routes.ts` | `POST /api/payments/webhook/bred-bank` (IPN) and checkout initiation. |
| `server/application/payment.application-service.ts` | Status transitions, amount/currency checks, refund recording. |
| `server/application/payment-reconciliation.service.ts` | Missed-IPN recovery to `manual_review_required` + admin alert. |
| `shared/schema.ts` → `BredBankCredentialsSchema` | Admin fields: `shopId`, `mode`, `testKey`, `productionKey`, `paymentUrl`. |
| `client/src/pages/admin/payments.tsx` | Admin credentials form for the BRED (PayZen) gateway. |
| `server/application/payment.routes.payzen.test.ts`, `payzen-signature.test.ts`, `payzen.adapter.test.ts` | Tests for signature, form and IPN. |

---

## 2. How the integration behaves (so BRED can verify it)

1. At checkout the server creates a payment row and a **signed form POST** to the
   PayZen hosted page (`paymentUrl`, blank = `https://secure.payzen.eu/vads-payment/`).
   The browser POSTs it; card data never touches our server.
2. `vads_ctx_mode` is `TEST` or `PRODUCTION` from the admin credentials; the
   matching key signs the form.
3. Only **VUV** is charged today. The amount is **whole vatu**: VT 5,000 is sent
   as `vads_amount=5000`, `vads_currency=548` (`CURRENCY_CODES` in the adapter has
   only VUV). The adapter refuses a currency it does not know.
4. The browser return (`vads_url_success` / `_cancel` / `_refused` / `_return`) is
   **UX only**. The authoritative result is the server-to-server **IPN** to
   `https://acetoursvanuatu.com/api/payments/webhook/bred-bank`.
5. The IPN is accepted only if all of these match: the 8-digit `vads_site_id`,
   the shop `mode`, a valid HMAC-SHA-256 signature, and the notification markers
   `vads_hash` / `vads_trans_status` / `vads_trans_uuid`.
6. Status mapping: `AUTHORISED`/`CAPTURED` → completed; `REFUSED`/
   `CAPTURE_FAILED` → failed; `ABANDONED`/`CANCELLED` → cancelled; `EXPIRED` →
   expired; `AUTHORISED_TO_VALIDATE` and unknown statuses → `manual_review_required`.
7. **Refunds are executed in the PayZen Back Office**, not by this site. PayZen's
   `CREDIT` IPN is recorded against the payment (`refunded_amount`,
   `refunded_at`, `refund_reference`; full refund → refunded, partial → completed
   with the refunded amount). A refund without a completed payment is held for
   manual review.
8. **No status polling.** PayZen here is notification-only. If the IPN never
   arrives, the reconciliation worker waits until the payment window closes, then
   moves the payment to `manual_review_required`, e-mails the admin and holds the
   review for 72 hours. It is **not** silently cancelled.
9. TEST-mode credentials hide the gateway from guests (only an admin can test
   with it), so a published test card can never confirm a real guest booking.

---

## 3. What we need from BRED — the 13 points

These are the same 13 points as the existing draft at
`~/Documents/Ace Tours Handover/BRED email draft.txt` (outside this repo).

| # | Item | Why it is needed |
|---|---|---|
| 1 | Online merchant account for card payments, in the business name, settling to the BRED account | Payment destination and settlement |
| 2 | PayZen **Back Office** access for the owner, plus a separate user for the integrator/developer | Configure and test the shop without sharing a login |
| 3 | The **8-digit Shop ID** | Goes in Admin → Payments `shopId`; the IPN must match it |
| 4 | Confirm the **TEST key** is visible, and say how the **PRODUCTION key** is issued | Signs forms/IPNs (`testKey` / `productionKey`) |
| 5 | Enable **VUV** on the shop | VUV is not in PayZen's default currency table |
| 6 | Confirm VUV amounts are **whole vatu** (`vads_amount=5000`, not `500000`) | Adapter sends the stored whole-vatu amount directly |
| 7 | Whether to use `https://secure.payzen.eu/vads-payment/` or a BRED-specific payment URL | `paymentUrl` field; wrong URL = no payment page |
| 8 | Confirm the shop's signature algorithm is **HMAC-SHA-256** | Adapter implements exactly this |
| 9 | Confirm **same-day automatic capture**, no per-payment manual approval | `vads_capture_delay=0`, `vads_validation_mode=0`; manual validation would leave payments in review |
| 10 | Confirm **3-D Secure** is enabled | Cardholder authentication |
| 11 | Set the **IPN URL** for test **and** production to `https://acetoursvanuatu.com/api/payments/webhook/bred-bank`, with **automatic retry** on failure | The only authoritative result source |
| 12 | Send the **test card numbers**, and say how many test payments are needed before the production key is issued | TEST phase exit criteria |
| 13 | Send the **fees** (per transaction and monthly), the **settlement time**, and how **refunds** work | Pricing/accounting and the refund runbook |

Notes for the bank conversation:

- We do not need to hand over production website files. Ask for the shop
  configuration and TEST credentials; production credentials are entered by the
  owner directly in Admin → Payments.
- The IPN endpoint must be reachable over public HTTPS (it is, on Render).
  PayZen retries non-200 replies; the route answers `text/plain` 200/400.

---

## 4. Configure and test on staging (TEST mode)

Do this on a **staging** Render service with a separate Neon branch/database —
never on production first.

1. **Staging environment** (`PAYMENT_CREDENTIALS_KEY` must be set, with a
   different value from production):
   ```dotenv
   DDD_DISABLE_CARD=false
   PAYMENTS_BRED_ENABLED=true
   # leave GLOBAL_PAYMENTS_PAUSE / PAUSE_CARD_PAYMENTS / PAYMENTS_EXTERNAL_DISABLED unset
   ```
   Deploy/restart so the new env is loaded.
2. **Admin → Payments → BRED Bank (PayZen)** — enter:
   - `shopId`: the 8-digit shop ID from the Back Office
   - `mode`: `TEST`
   - `testKey`: the TEST key
   - `paymentUrl`: blank (default page) or the BRED-specific URL from point 7
   Save, then make the gateway **active**. Do **not** make it the default for
   guests yet.
3. In the PayZen **Back Office** (test shop) set the notification/IPN URL for the
   test context to the staging host (or, if BRED only allows one URL, to
   `https://acetoursvanuatu.com/api/payments/webhook/bred-bank` — the adapter
   rejects a test IPN whose shop/mode do not match anyway).
4. Confirm signature = HMAC-SHA-256 and VUV enabled on the test shop.
5. Log in as an **admin** and run a booking through the gateway (TEST gateways are
   hidden from guests). Use the test cards from BRED.
6. Verify:
   - [ ] The guest is redirected to the PayZen page and back to
         `/payment/success?booking=…&receipt=…`.
   - [ ] The IPN arrives (Render logs: `POST /api/payments/webhook/bred-bank 200`);
         payment becomes `completed`, booking `confirmed`, guest + admin e-mails
         sent once.
   - [ ] Replaying the same IPN does not confirm twice.
   - [ ] A declined card leaves the booking pending; the hold expires normally.
   - [ ] A wrong-mode/wrong-shop or unsigned IPN is rejected (400) and changes
         nothing.
   - [ ] A refund created in the test Back Office produces a `CREDIT` IPN and is
         recorded on the payment.
   - [ ] Stopping the IPN (or closing the browser before it arrives) ends in
         `manual_review_required` with an admin e-mail after the payment window —
         not a silent cancellation.
7. Keep a record of the test payments (date, order ID, amount, result) — BRED may
   ask for the count before issuing the production key.

---

## 5. TEST → PRODUCTION cutover

Preconditions: TEST evidence is complete, BRED has issued the production key,
the merchant account is live, and the production IPN URL is confirmed.

1. In the PayZen Back Office, confirm the **production** notification URL is
   `https://acetoursvanuatu.com/api/payments/webhook/bred-bank`, signature
   HMAC-SHA-256, VUV enabled, automatic capture and 3-D Secure on.
2. On Render (production) set `PAYMENT_CREDENTIALS_KEY` (already set) and
   `PAYMENTS_BRED_ENABLED=true`; keep `DDD_DISABLE_CARD=true` for the moment.
   Deploy.
3. Admin → Payments → BRED: change `mode` to `PRODUCTION`; enter the production
   key (leave the TEST key as-is); save and activate.
4. Set `DDD_DISABLE_CARD=false`, deploy, and run **one controlled live payment**
   (small amount, real card, e.g. an owner booking). Verify: payment `completed`,
   booking `confirmed`, e-mails sent, IPN logged 200.
5. Refund that test payment in the PayZen Back Office. Confirm either the
   `CREDIT` IPN records the refund or record it manually via reconciliation
   (§6), then confirm the payment shows `refunded`.
6. Enable the gateway for guests: Admin → Payments → BRED **active**, set it as
   the card/default option as agreed; keep `PAYMENTS_BRED_ENABLED=true`,
   `DDD_DISABLE_CARD=false`. Confirm a guest sees the card option.
7. Monitor the first day: Render logs for `[WEBHOOK][bred-bank]`, PayZen Back
   Office transactions vs site `payments`, admin e-mails for
   `manual_review_required`.

**Rollback** (if something is wrong): set `PAYMENTS_BRED_ENABLED=false` and/or
`DDD_DISABLE_CARD=true` on Render and redeploy — this blocks **new** card
payments only; already-started payments still resolve through their IPN. Do not
deactivate the gateway row while a payment is in flight; blocks through the env
flags are cleaner.

---

## 6. Refunds runbook

Refunds are **not** initiated by this website. The site never holds card numbers
and has no refund API.

1. Find the payment in **Admin → Payments** (or the PayZen Back Office by order
   ID / `vads_trans_uuid`).
2. In the **PayZen Back Office**, refund the transaction (full or partial).
3. PayZen sends a `CREDIT` IPN. The site records it automatically:
   - full refund → payment `refunded`, `refunded_amount` = original amount;
   - partial refund → payment stays `completed`, `refunded_amount` increases;
   - refund with no completed payment → `manual_review_required`.
   Duplicate IPNs are ignored (the refund reference is de-duplicated).
4. If the IPN does not arrive, record it manually with the reconciliation action
   (Admin payment reconciliation, or `POST /api/admin/payments/:id/reconcile`
   with `{ "note": "<refund reference and reason>", "forceStatus": "refunded" }`);
   this writes `refunded_amount` / `refunded_at` / `refund_reference` and an audit
   entry.
5. Keep the PayZen refund reference in the admin note. A refund does not
   automatically reverse the merchant fee — check the settlement report.

---

## 7. Fees, settlement and accounting notes

These figures were quoted in the BRED/PayZen onboarding discussion — **verify
them against the signed merchant agreement before relying on them**:

- **3.5%** merchant fee per Visa/Mastercard transaction.
- **1%** merchant fee per BRED Smart Card transaction.
- **VT 2,000** monthly inactivity fee, applicable only where no payments are
  processed through the gateway during the month.
- **Currencies:** BRED lists EUR, GBP, NZD, USD, AUD, XPF and VUV; this integration
  charges VUV only (§8).
- **Settlement:** confirm the payout schedule (how many days after the
  transaction the funds reach the BRED account) and whether fees are deducted at
  settlement.

Accounting implications today:

- The site records the **gross** amount the guest paid (`payments.amount`, whole
  VUV). Fees are deducted by BRED in settlement; there is **no fee or settlement
  ledger in the app yet** (follow-up in `CODE_REVIEW.md`).
- VAT/transaction snapshots on receipts are also a follow-up; do not treat the
  current payment record as a tax invoice.
- Reconcile monthly: PayZen settlement report ↔ site payments/refunds ↔ bank
  statement. Differences go through Admin reconciliation with a note.

---

## 8. Product decision: VUV-only charging

The booking flow and the PayZen adapter charge **VUV only**. Consequences:

- The PayZen shop must have VUV enabled (point 5); without it every payment is
  refused before the card page.
- Amounts are whole vatu; `vads_amount` carries the integer, not cents/minor
  units. Never multiply by 100 for VUV.
- Multi-currency charging (AUD/USD) is **out of scope** for this go-live. It would
  need currency-specific pricing, an FX policy and adapter changes; the adapter
  currently rejects any currency other than VUV. See `CODE_REVIEW.md` follow-ups.

---

## 9. Security and handover conditions

Follow [`SECURITY_HANDOVER.md`](./SECURITY_HANDOVER.md) before giving BRED/Global
Bedbank access. In short:

- Make the GitHub repo **private** first; the old history contains credentials.
- Give the integrator a **private read-only repo collaborator or a `git archive`
  snapshot**, a **staging** environment, and **TEST credentials only**. Never send
  the working folder, `.env`, logs or the production `DATABASE_URL`.
- Production PayZen `productionKey`, the merchant account, the domain/DNS and the
  production database stay with the owner.
- A separate PayZen Back Office user for the integrator; revoke it at the end.
- Rotate exposed secrets (see the checklist) and remember that rotating
  `PAYMENT_CREDENTIALS_KEY` invalidates the stored gateway credentials, which must
  be re-entered in Admin → Payments.

---

## 10. Ready-to-send reply e-mail draft

Use this as the reply to BRED / John Lew (Global Bedbank). Replace the bracketed
placeholders. The technical facts are true today: the integration is implemented
and deployed, but card charging waits on the bank setup below.

> **Subject:** Re: Online card payments (PayZen) for Ace Tours & Transfers —
> integration is built; here is what we need
>
> Dear [BRED contact name],
>
> Thank you for the offer to help set up online card payments. We want to be
> clear about where things stand so we do not duplicate work: **our website
> already has a complete PayZen integration built and deployed.** It creates the
> signed VADS V2 payment form, sends customers to the PayZen hosted payment page,
> and receives and verifies the bank's IPN (HMAC-SHA-256) at
> `https://acetoursvanuatu.com/api/payments/webhook/bred-bank`. It supports
> TEST/PRODUCTION shops, charges in VUV only, records refunds from the PayZen
> Back Office, and moves a payment to manual review if an IPN is missed. The
> remaining step is the bank-side setup. We do **not** need to hand over our
> production website files, database or credentials to finish it.
>
> Could you please confirm the following 13 points so we can run the TEST phase
> and then switch on production?
>
> **Account and access**
> 1. Please set up (or confirm) our online merchant account for card payments in
>    the name of [registered business name], settling to our account
>    [BRED account number].
> 2. Please give PayZen Back Office access to the business owner,
>    [owner name, email], and a separate user for our developer,
>    [developer name, email].
> 3. Please confirm our Shop ID, the 8-digit number.
> 4. Please confirm we can see the TEST key in the Back Office, and tell us how we
>    get the PRODUCTION key once testing is done.
>
> **Shop settings**
> 5. Please enable VUV (Vanuatu vatu) on our shop. We will charge in VUV only.
> 6. Please confirm VUV amounts are accepted in whole vatu — a VT 5,000 payment
>    is sent as `vads_amount=5000`, not `500000`.
> 7. Should we use the standard payment page
>    `https://secure.payzen.eu/vads-payment/`, or does BRED have its own? If so,
>    please send the exact address.
> 8. Please confirm our shop's signature algorithm is set to HMAC-SHA-256.
> 9. Please confirm payments are captured automatically on the same day, with no
>    manual approval needed per payment.
> 10. Please confirm 3-D Secure is turned on.
>
> **Notifications**
> 11. Please set the Instant Payment Notification (IPN) URL for **both test and
>     production** to `https://acetoursvanuatu.com/api/payments/webhook/bred-bank`,
>     with automatic retry turned on if a notification fails.
>
> **Testing and costs**
> 12. Please send the test card numbers for test mode, and tell us how many test
>     payments PayZen needs before the production key is issued.
> 13. Please send our fees (per transaction and monthly), the settlement time
>     (how long until funds reach our account), and how refunds work.
>
> On access: to keep things safe for both sides, we can give your technical team
> a **read-only collaborator seat on our private GitHub repository** (or a
> snapshot of the current commit), a **staging test site**, and the **TEST
> credentials** only. We cannot share production files, the production database
> or production keys, but that is not needed — the integration is already in place
> and the TEST shop is all we need to prove it end to end.
>
> Thank you. [Developer name] can answer any technical questions.
>
> Kind regards,
> [Owner name]
> Ace Tours & Transfers
> [Phone] · https://acetoursvanuatu.com

---

## 11. Final go-live checklist

- [ ] Repo private; owner actions in `SECURITY_HANDOVER.md` started.
- [ ] 13 points answered by BRED.
- [ ] TEST shop configured: VUV, HMAC-SHA-256, auto capture, 3DS, IPN + retries.
- [ ] TEST payments pass §4 (including replay, decline, refund, missed IPN).
- [ ] Production key issued and entered by the owner; mode = PRODUCTION.
- [ ] One controlled live payment + refund completed (§5).
- [ ] `DDD_DISABLE_CARD=false`, `PAYMENTS_BRED_ENABLED=true`, gateway active.
- [ ] Guest-facing card option verified; kill switches documented.
- [ ] First-day webhook/back-office monitoring done.

# BRED PayZen Card Payments — Go-Live Runbook

**Date:** 9 November 2026
**Status:** integration code complete and **deployed** — the live site runs
`8cdd99a` (PayZen adapter, IPN, admin form, tests, refund ledger and missed-IPN
manual-review recovery). Migration `0034_payment_refunds.sql` applied in
production on 9 Nov 2026. **Card charging is not live yet** — it is waiting on
the BRED merchant/PayZen setup below.
**Audience:** owner/operator, and any developer doing the BRED go-live.
**Related:** [`ADR-007`](./adr/ADR-007-BRED-PAYZEN.md),
[`SECURITY_HANDOVER`](./SECURITY_HANDOVER.md),
[`PAYMENT_SANDBOX_TESTING`](./PAYMENT_SANDBOX_TESTING.md).

---

## 0. People and roles

| Person | Role in this setup |
|---|---|
| **Saviera "Savi" Alexis** — `acetoursvanuatu@outlook.com` | Owner of Ace Tours & Transfers; applicant and merchant-account holder; cc on the developer's reply to John and recipient of the PayZen Back Office access. |
| **Mark** — `markmal64@gmail.com` | Developer of the website/PayZen integration; the correct technical contact for the application and the PayZen Back Office. The pending chain reply is his, to John (reply-all, Savi and Jaynol cc'd). |
| **Michael Dan** — `mdan@bred.vu`, BRED (Vanuatu) Ltd, E-Banking | BRED e-Banking Merchant Officer; the PayZen/e-commerce contact who sent the fees and application. |
| **John Lew** — `john@pacificbedbank.com`, Global Bedbank Pte Ltd (Fiji) | Bedbank contact copied into the thread on 2 Nov 2026. **Not the website developer or PayZen integrator.** He asked Savi on 5 Nov for "access to your website files"; that is not needed — the integration is already built. |
| **Jaynol Tari** — Palladium Group | Submitted the completed e-commerce application on 2 Nov 2026 and copied John in, describing him as "the developer assisting with integration"; that description is inaccurate (the developer is Mark). |

The "Technical Contact Details" on BRED's E-Commerce application should name
**Mark (developer)**, not John. If the submitted form says otherwise, ask BRED
(Michael Dan) to correct it so the PayZen Back Office and production-key handover
go to the owner and the developer.

---

## 1. Current state

| Item | State on 2026-11-09 |
|---|---|
| PayZen integration in the code | **Complete and deployed** — adapter, signature, IPN route, admin credentials form, tests, refund recording and missed-IPN review. |
| Live site (`https://acetoursvanuatu.com`) | **Cash on delivery only** (verified 9 Nov 2026: `/api/payment-gateways` returns just `cash`). `DDD_DISABLE_CARD=true` and `PAYMENTS_BRED_ENABLED=false` in `render.yaml`; the BRED gateway is inactive. |
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
| `shared/gateway-schemas.ts` | That schema (and the other gateways' schemas) shared by the admin form, its client-side check and the server save route. |
| `server/lib/csp-form-action.ts` | `form-action` CSP allowlist; follows the saved PayZen `paymentUrl` automatically. |
| `client/src/pages/admin/payments.tsx` | Admin credentials form for the BRED (PayZen) gateway; `mode` is a TEST/PRODUCTION dropdown. |
| `server/application/payment.routes.payzen.test.ts`, `payzen-signature.test.ts`, `payzen.adapter.test.ts` | Tests for signature, form and IPN. |

---

## 2. How the integration behaves (so BRED can verify it)

1. At checkout the server creates a payment row and a **signed form POST** to the
   PayZen hosted page (`paymentUrl`, blank = `https://secure.payzen.eu/vads-payment/`).
   The `form-action` CSP allowlist follows the saved `paymentUrl` automatically, so
   switching to a BRED-specific page needs no code change.
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
| 2 | PayZen **Back Office** access for the owner (Savi), plus a separate user for the developer (Mark) | Configure and test the shop without sharing a login |
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
  owner directly in Admin → Payments. John Lew's 5 Nov request for website files
  should be answered with that clarification — the integration already exists;
  no repo/folder access is needed for the bank setup.
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
   - `paymentUrl`: blank (default page) or the BRED-specific URL from point 7. The
     CSP allowlist picks it up on save; no code change or redeploy is needed.
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

Follow [`SECURITY_HANDOVER.md`](./SECURITY_HANDOVER.md) before granting any
external access. In short:

- Make the GitHub repo **private** first; the old history contains credentials.
- **No one needs website files for this go-live.** The integration is already
  deployed. The only external system access needed is the PayZen **Back Office**:
  the owner (Savi) and a separate user for the developer (Mark). If BRED's
  technical team asks to review the integration, the ceiling is a sanitised
  `git archive`/read-only snapshot or a staging site with TEST credentials —
  never the working folder, `.env`, logs or the production `DATABASE_URL`.
- Production PayZen `productionKey`, the merchant account, the domain/DNS and the
  production database stay with the owner.
- Revoke any external PayZen user at the end of the setup.
- Rotate exposed secrets (see the checklist) and remember that rotating
  `PAYMENT_CREDENTIALS_KEY` invalidates the stored gateway credentials, which must
  be re-entered in Admin → Payments.

---

## 10. Ready-to-send e-mail drafts

### Current state (10 November 2026)

Mark sent the check-in email to Savi on 9 November 2026 at 22:07 (below). Savi
replied on 10 November: she understands the security concern, does not want to
spend more on development at the moment, asks Mark to email John to obtain more
information, and reports two separate issues — her admin login is not working,
and she wants an Airbnb announcement added to the site.

The next actions, in order:

1. **Mark emails John** to clarify John's role, scope and what he actually needs
   before any access is discussed (10.4). Savi asked for this explicitly.
2. **Mark replies to Savi** with the John update, login-reset steps and the
   questions needed for the Airbnb announcement (10.5).
3. Once John or BRED clarifies, Mark sends the full technical reply to John
   (10.2) and/or the 13 setup points to Michael Dan (10.6).

### 10.1 Initial check-in email to Savi (sent 9 Nov)

Keep this businesslike and brief: it is a check-in with the owner, not a request
for her to take the John reply back.

**From:** Mark `<markmal64@gmail.com>`
**To:** Saviera Alexis `<acetoursvanuatu@outlook.com>`
**Subject:** John Lew / PayZen — website files and my planned response

> Dear Savi,
>
> Following your note to John on Thursday (copying me), I would like to confirm
> two points before I respond to him, so my reply is accurate and does not cut
> across any arrangement you have with Global Bedbank.
>
> John has asked for access to our website files to set up the PayZen
> integration. I do not recommend sending the production website folder: it
> contains the live database credentials, customer data, server logs and payment
> configuration, and sharing it outside our team would create a security and
> privacy risk. It is also not required — the PayZen integration is already
> implemented and deployed in production (hosted payment page, signed requests,
> bank IPN at `/api/payments/webhook/bred-bank`, refunds recorded). The
> outstanding items are on BRED's side — PayZen shop configuration, keys and VUV
> enablement — which I am coordinating with Michael Dan.
>
> Before I reply to John, could you clarify:
>
> 1. The nature of your arrangement with John / Global Bedbank — is he advising
>    on payments, has he been engaged to work on the integration, or is he copied
>    in for visibility? Is there a scope or agreement in place? This determines
>    what, if anything, he needs from us.
> 2. Who was recorded as the "technical contact" on the BRED e-commerce
>    application Jaynol submitted? If it is John, we should ask Michael Dan to
>    correct it to me, so BRED sends Back Office access and production
>    credentials to the right people.
>
> Subject to your guidance, I will reply to John — keeping you and Jaynol cc'd
> and adding Michael for the BRED items — explaining that the integration is
> already in place, that no website files are required, and that I am handling
> the technical setup with BRED. If John genuinely needs visibility of the code,
> I can provide a short technical overview or a read-only snapshot of the
> relevant files, not the production site, database or credentials.
>
> Please let me know if you would prefer a different approach.
>
> Kind regards,
> Mark
> Developer, Ace Tours & Transfers
> markmal64@gmail.com

### 10.2 Full technical reply to John (send after his clarification)

Send this only after John has explained his role and confirmed he is working on
the BRED/PayZen setup; Mark sends it, keeping Savi and Jaynol cc'd and adding
Michael Dan for the BRED questions. The shorter information-gathering email in
10.4 comes first.

**From:** Mark `<markmal64@gmail.com>`
**To:** John Lew `<john@pacificbedbank.com>`
**Cc:** Saviera Alexis `<acetoursvanuatu@outlook.com>`; Jaynol Tari
`<jaynol.tari-mdf@thepalladiumgroup.com>`; Michael Dan `<mdan@bred.vu>`
**Subject:** Re: Ace Tours & Transfer Business Account Set-up

> Hi John,
>
> Thanks for your email — and Savi, thanks for the introduction.
>
> I'm Mark, the developer who built and maintains the Ace Tours website and its
> PayZen integration. On your request for access to our website files: none are
> needed, and nothing on the website has to change for the PayZen setup. The
> integration is already built and running in production: the site creates the
> signed VADS V2 form for the PayZen hosted payment page, receives and verifies
> BRED's IPN (HMAC-SHA-256) at
> `https://acetoursvanuatu.com/api/payments/webhook/bred-bank`, and records
> refunds made in the PayZen Back Office.
>
> What is still outstanding is the BRED-side shop configuration. Michael, could
> you please confirm the following so we can run the TEST phase and then switch
> to production?
>
> 1. The online merchant account for card payments in the business name,
>    settling to our BRED account.
> 2. PayZen Back Office access for Savi (owner) and a separate user for me
>    (developer). For BRED's records, please list me as the technical contact for
>    the website/payment integration; Savi remains the merchant-account holder.
> 3. The 8-digit Shop ID.
> 4. The TEST key, and how the PRODUCTION key is issued after testing.
> 5. VUV enabled on the shop (we charge in VUV only).
> 6. Confirmation that VUV amounts are whole vatu — a VT 5,000 payment is sent as
>    `vads_amount=5000`, not `500000`.
> 7. The payment page URL: the standard
>    `https://secure.payzen.eu/vads-payment/`, or a BRED-specific one.
> 8. The shop's signature algorithm set to HMAC-SHA-256.
> 9. Same-day automatic capture, with no manual validation per payment.
> 10. 3-D Secure enabled.
> 11. The IPN URL for both test and production set to
>     `https://acetoursvanuatu.com/api/payments/webhook/bred-bank`, with
>     automatic retry on failure.
> 12. Test card numbers, and how many test payments are needed before the
>     production key is issued.
> 13. Our fees (per transaction and monthly), settlement timing, and how refunds
>     work.
>
> John, if you need a technical overview for the bedbank side, I'm happy to share
> a short integration summary or a read-only snapshot of the relevant code — we
> just won't be handing over production website files, the database or
> credentials.
>
> Thanks,
> Mark
> Developer, Ace Tours & Transfers
> markmal64@gmail.com · https://acetoursvanuatu.com

### 10.3 Technical overview / read-only snapshot

A shareable technical overview is at [`PAYZEN_TECHNICAL_OVERVIEW.md`](./PAYZEN_TECHNICAL_OVERVIEW.md) (also provided as a PDF). If John or BRED's technical team needs more than the overview, give them a **read-only snapshot** (a sanitised archive of the deployed source, no Git history, `.env`, logs, customer data or internal runbooks) rather than website files. The snapshot is read-only and can be shared under the conditions in `SECURITY_HANDOVER.md`.

### 10.4 Email to John after Savi's 10 Nov reply

Savi has now explicitly asked Mark to email John to obtain more information, and
confirmed she does not want to spend more on development. Send this business
email from Mark to John, cc Savi and Jaynol (do not cc Michael — this is about
John's role, not the BRED shop setup):

**From:** Mark `<markmal64@gmail.com>`
**To:** John Lew `<john@pacificbedbank.com>`
**Cc:** Saviera Alexis `<acetoursvanuatu@outlook.com>`; Jaynol Tari
`<jaynol.tari-mdf@thepalladiumgroup.com>`
**Subject:** Re: Ace Tours & Transfer Business Account Set-up

> Hi John,
>
> I'm Mark, the developer for Ace Tours & Transfers. Savi has asked me to follow
> up with you directly.
>
> Before we go further, I'd like to understand your involvement so we can respond
> properly and avoid duplicating work. Could you clarify:
>
> 1. What is your role and arrangement with Ace Tours and Global Bedbank? Are you
>    advising Savi, has Global Bedbank engaged you to work on the website or
>    integration, or are you copied in for visibility? Is there a scope,
>    agreement or cost arrangement in place?
> 2. What exactly do you need website file access for? The PayZen payment
>    integration with BRED is already built and deployed by me — hosted payment
>    page, signed requests, bank IPN and refund recording. If your work is on the
>    BRED/PayZen setup, the remaining items sit with BRED (Michael Dan) and do not
>    require website files.
> 3. If your interest is bedbank distribution or connecting inventory/booking
>    flow, what information or access do you need, and who at Global Bedbank is
>    driving it?
>
> To be clear, I'm happy to share a technical overview or a read-only snapshot of
> the relevant code for review. What I can't do is hand over the production
> website folder, database, credentials or customer data — that's a security and
> privacy requirement, not a reflection on you.
>
> Savi is keen to start taking bookings online and is watching costs, so a short
> call or a written scope would help us move quickly. Are you free for 20 minutes
> this week?
>
> Thanks,
> Mark
> Developer, Ace Tours & Transfers
> markmal64@gmail.com

### 10.5 Reply to Savi on John, login and the Airbnb announcement

Savi also reported that the admin login Mark provided does not work and that she
wants an Airbnb announcement added. Reply to Savi with:

**From:** Mark `<markmal64@gmail.com>`
**To:** Saviera Alexis `<acetoursvanuatu@outlook.com>`
**Subject:** Re: John / PayZen — login, Airbnb and next steps

> Dear Savi,
>
> Thanks for the reply. I understand on the budget — the PayZen integration is
> already built and deployed, so there is no further development cost for cards;
> the only new cost would be BRED's merchant fees. We can also start taking
> bookings online sooner by switching on bank transfer (the site currently only
> offers cash and the bank-transfer account number is still a placeholder).
>
> **John:** I have emailed him as you asked, copying you and Jaynol, to clarify
> his role and exactly what he needs before we share anything. I'll keep you
> posted and will not send production files, the database or credentials.
>
> **Login:** Your admin account exists and is active (`saviera_alexis`,
> `acetoursvanuatu@outlook.com`). The login field expects the **email address**,
> not the username. Please try `acetoursvanuatu@outlook.com` with your password;
> if it still fails, open `https://acetoursvanuatu.com/reset-password`, request a
> reset link for that email, and check the inbox and spam folder — the link is
> valid for one hour. If the email does not arrive, I can set a temporary
> password for you. Once you are in, pricing is under Admin → Products → Pricing.
>
> **Airbnb:** Happy to add this. The cleanest approach is a small announcement
> banner (on the home page or site-wide) saying something like: "Our Port Vila
> house will be available on Airbnb from February 2027" with a link to the
> listing. Please send the Airbnb listing URL, the exact wording you want, and
> whether it should show on all pages or just the home page. If the listing is
> not live yet, we can say "Coming February 2027 — enquire via WhatsApp" and add
> the link later. It will be easy to remove or update after the launch.
>
> **To start bookings:** please send me the BRED account name and number from the
> account confirmation letter (or confirm the details), and I will switch bank
> transfer on and test a booking. I'll coordinate the PayZen shop setup with
> Michael Dan in parallel.
>
> Kind regards,
> Mark
> Developer, Ace Tours & Transfers
> markmal64@gmail.com

### 10.6 Optional separate BRED thread

If BRED prefers a separate thread, send the same 13 points to Michael Dan with
Savi cc'd, and keep the John reply short: explain that the integration is already
built so no website files are needed, and that Mark will coordinate the shop
setup with Michael. Do not send production files or credentials in any email.

## 11. Final go-live checklist

- [ ] Repo private; owner actions in `SECURITY_HANDOVER.md` started.
- [ ] BRED's application lists Mark (not John) as technical contact.
- [ ] 13 points answered by BRED.
- [ ] TEST shop configured: VUV, HMAC-SHA-256, auto capture, 3DS, IPN + retries.
- [ ] TEST payments pass §4 (including replay, decline, refund, missed IPN).
- [ ] Production key issued and entered by the owner; mode = PRODUCTION.
- [ ] One controlled live payment + refund completed (§5).
- [ ] `DDD_DISABLE_CARD=false`, `PAYMENTS_BRED_ENABLED=true`, gateway active.
- [ ] Guest-facing card option verified; kill switches documented.
- [ ] First-day webhook/back-office monitoring done.

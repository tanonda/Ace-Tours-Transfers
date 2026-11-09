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

### Who replies next

The last message in the thread is **Saviera's 5 November 2026, 10:18 email to
John Lew** — "Copying Marc to assist. He will be your main contact person for
this part" — cc Mark and Jaynol Tari. Saviera has handed the technical part to
Mark, but Mark is not yet clear on the arrangement between Savi and John, and
does not want to appear to be blocking John's access. The right first step is
therefore a **private email to Savi**, not an immediate reply to John:

1. Ask Savi what John's role/arrangement is (adviser, partner, integration
   contractor?) and who was listed as the technical contact on BRED's
   e-commerce application.
2. Recommend that **Savi replies to John** as the owner and the person John
   contacted, explaining that the integration is already built and that Mark is
   coordinating the BRED/PayZen setup with Michael Dan — so no website files are
   needed. Mark is cc'd and answers technical questions.
3. If Savi prefers, Mark can reply to John with Savi cc'd instead. Either way,
   no production files, database or credentials are shared; if John genuinely
   needs a technical review, offer a short overview or a read-only snapshot of
   the relevant code.

### 10.1 Email to Savi first (send now)

This is an internal check-in with the owner, not a client email — keep it short,
warm and direct rather than formal. The text below is deliberately conversational.

**From:** Mark `<markmal64@gmail.com>`
**To:** Saviera Alexis `<acetoursvanuatu@outlook.com>`
**Subject:** John / PayZen — quick one before I reply

> Hey Savi,
>
> Before I get back to John, wanted to check with you first — I don't want to
> make things awkward or look like I'm blocking him.
>
> He's asked for the website files to set up the PayZen integration. I'm happy to
> share stuff if that's what you want, but I wouldn't send the whole live site
> folder: it's got the database connection, passwords, customer info and logs in
> there. That's not something we should hand out, and honestly it isn't needed —
> the PayZen integration is already built and live. The only thing left is BRED's
> side (Michael Dan, the shop ID, keys, VUV etc.), and I've got that list ready.
>
> Two things I need from you:
>
> 1. What's the deal with John? Is he helping with payments, did he offer to sort
>    the integration, or is he just copied in? Do we have anything in writing
>    with him? That'll tell me what he actually needs.
> 2. Do you know who was put down as the "technical contact" on the BRED form
>    Jaynol sent? If it's John, we should ask Michael to change it to me, so the
>    bank sends the access and keys to us.
>
> My honest suggestion: you reply to John, since he emailed you and you know him
> — just say the integration is already built and I'm handling the BRED setup
> with Michael, so no files are needed. I'll be cc'd and can jump in if he has
> technical questions. If it's easier, I'll draft it for you. If he really does
> need to see the code, I can send him an overview or a read-only snapshot — just
> not the live site, database or credentials.
>
> Not trying to be a pain about it — I just don't want to hand over customer data
> or live credentials to someone before we know what he's actually after. Happy
> to go with whatever you think.
>
> Thanks,
> Mark

### 10.2 Reply to John (after Savi agrees; from Savi or Mark)

If Savi replies, use her voice; if she asks Mark to reply, use the version below
with Savi and Jaynol kept on cc and Michael Dan added for the BRED questions.

**From:** Savi `<acetoursvanuatu@outlook.com>`
**To:** John Lew `<john@pacificbedbank.com>`
**Cc:** Mark `<markmal64@gmail.com>`; Jaynol Tari
`<jaynol.tari-mdf@thepalladiumgroup.com>`; Michael Dan `<mdan@bred.vu>`
**Subject:** Re: Ace Tours & Transfer Business Account Set-up

*(If Savi asks Mark to send instead, change the opening to "I'm Mark, the
developer who built and maintains the Ace Tours website and its PayZen
integration", keep Savi on cc, and sign as Mark.)*

> Hi John,
>
> Thanks for your email. I've asked Mark, our developer, to pick up the technical
> side.
>
> The website already has a complete PayZen integration built and running in
> production — the signed PayZen hosted payment page, the bank's IPN
> (HMAC-SHA-256) at `https://acetoursvanuatu.com/api/payments/webhook/bred-bank`,
> and refunds recorded from the PayZen Back Office — so no website files need to
> be shared or changed for the integration. What is still outstanding is BRED's
> side of the setup.
>
> Michael, could you please confirm the following so we can run the TEST phase
> and then switch to production?
>
> 1. The online merchant account for card payments in the business name,
>    settling to our BRED account.
> 2. PayZen Back Office access for Savi (owner) and a separate user for Mark
>    (developer). For BRED's records, please list Mark as the technical contact
>    for the website/payment integration; Savi remains the merchant-account
>    holder.
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
> John, if you need a technical overview for the bedbank side, Mark is happy to
> share a short integration summary or a read-only snapshot of the relevant
> code; we won't be handing over production website files, the database or
> credentials.
>
> Thanks,
> Savi
> Ace Tours & Transfers
> [Phone] · https://acetoursvanuatu.com
>
> *Mark (cc'd) can answer any technical questions.*

### 10.3 Optional separate BRED thread

If BRED prefers a separate thread, send the same 13 points to Michael Dan with
Savi cc'd, and keep the John reply short: acknowledge the handoff, explain that
the integration is already built so no website files are needed, and say Mark
will coordinate the shop setup with Michael. Do not send production files or
credentials in any email.

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

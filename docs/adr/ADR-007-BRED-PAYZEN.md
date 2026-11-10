# ADR-007: BRED Card Payments via Lyra PayZen Hosted Page + IPN

* **Status**: Accepted
* **Date**: 2026-11-08
* **Author**: Ace Tours & Transfers (owner + Claude)
* **Supersedes**: the June 2026 VPC/MIGS design in
  [`docs/superpowers/specs/2026-06-03-bred-vpc-payment-gateway-hardening-design.md`](../superpowers/specs/2026-06-03-bred-vpc-payment-gateway-hardening-design.md)

## Context

Ace Tours needs to accept card payments through its BRED Bank Vanuatu merchant
account. The originally-planned June 2026 design assumed BRED would provide a
classic **MIGS/VPC redirect** merchant (merchant ID + access code + secure-hash
secret, `vpc_*` query strings, shared `MastercardGatewayAdapter` for ANZ/BSP/BRED).
That design was never implemented: BRED's hosted card page is **Lyra PayZen**, a
different protocol. The code now ships a PayZen adapter, PayZen signatures, the
IPN route and admin credentials form, and the live commit (`936b48a`) contains
all of it.

Constraints that shape the decision:

- Vanuatu merchant, VUV is the operating currency; card charging must be in VUV.
- The site must never see or store card data, so a hosted payment page is
  required (no direct API collected card numbers).
- PayZen on this shop exposes no status-query API; the IPN is the only
  authoritative result, and notifications can be missed.
- The site records payments and bookings, but refunds are executed in the bank's
  Back Office, not through a website API.

## Decision

Accept **BRED card payments via Lyra PayZen**:

1. **Protocol:** PayZen Hosted Payment Page, VADS **V2** form API. The server
   signs the form (HMAC-SHA-256, Base64, `vads_*` values sorted by field name and
   joined with `+`, then `+key`) and the browser POSTs it to the PayZen page.
2. **Modes:** credentials carry `mode: TEST | PRODUCTION` plus `shopId` (8
   digits), `testKey`, optional `productionKey`, optional `paymentUrl` (blank =
   `https://secure.payzen.eu/vads-payment/`). The mode selects the key **and** is
   sent as `vads_ctx_mode`; the IPN must match the shop ID and the mode. The
   `form-action` CSP allowlist follows the saved `paymentUrl`, so a BRED-specific
   payment page needs no code change.
3. **Result:** server-to-server IPN at
   `https://acetoursvanuatu.com/api/payments/webhook/bred-bank`. The adapter
   verifies the shop, mode, HMAC signature and notification markers
   (`vads_hash`, `vads_trans_status`, `vads_trans_uuid`) before any state change.
4. **Currency:** **VUV only**, whole vatu (`vads_amount` is the integer amount,
   `vads_currency=548`). Other currencies are rejected by the adapter. This is a
   deliberate product decision, not a temporary limitation.
5. **TEST isolation:** a gateway whose credentials are `mode: TEST` is hidden from
   guests and refused for non-admin checkout, so published test cards cannot
   confirm a real booking.
6. **Refunds:** executed manually in the **PayZen Back Office**, then recorded in
   the site from the `CREDIT` IPN (`refunded_amount`, `refunded_at`,
   `refund_reference`; full → `refunded`, partial → `completed` plus refunded
   amount). A refund without a completed payment goes to manual review. The site
   never calls a refund API.
7. **Missed IPN:** PayZen is notification-only (`supportsStatusQuery() === false`).
   The reconciliation worker waits while the payment window is open, then moves
   the payment to **`manual_review_required`**, e-mails the admin and holds the
   review for 72 hours. A missed IPN is never silently cancelled or guessed as
   paid.
8. **Unknown statuses** (and `AUTHORISED_TO_VALIDATE`) go to manual review rather
   than being treated as paid.
9. **Go-live flags:** card charging requires `DDD_DISABLE_CARD=false` **and**
   `PAYMENTS_BRED_ENABLED=true` **and** the gateway row active in
   Admin → Payments. The admin toggle alone is not enough.

## Consequences

* **Positive**
  - Card data stays on the bank's page; the site's PCI surface is minimal.
  - No new dependency on a payment SDK: plain form POST + HMAC verification.
  - Reuses the existing payment/booking state machine, kill switches, audit log
    and reconciliation worker.
  - VUV-only keeps pricing and accounting unambiguous.
* **Negative**
  - No programmatic status query: a lost IPN becomes an operational task (manual
    review + Back Office check) instead of an automatic sync.
  - Refunds are a two-step human process (Back Office, then the site records it);
    the site cannot initiate a refund.
  - No multi-currency charging.
  - PayZen's signing convention is unusual (values only, `+`-joined, and `+` may
    not appear in values); the adapter guards against value injection.

## Invariants protected

- The only result that can complete a payment is a signature-verified IPN for the
  configured shop and mode; a browser redirect cannot confirm a payment.
- A closed/failed payment that the bank later reports as paid is flagged
  `manual_review_required` (`paid_after_close`), never auto-completed.
- The amount/currency reported by the bank must match the stored payment; a
  mismatch goes to manual review.
- A refund notification never completes a payment and is de-duplicated by
  reference.
- TEST credentials cannot be used to confirm a guest booking.

## Rejected alternatives

- **June 2026 VPC/MIGS `MastercardGatewayAdapter` design** — superseded; BRED's
  product is PayZen and the shared MIGS adapter does not exist in the current
  tree. Kept as historical documentation only.
- **Status polling / query API** — PayZen exposes no status-query API for this
  shop; the reconciliation worker handles it as notification-only instead.
- **Storing card data or a direct API integration** — rejected (PCI scope, and
  the bank offers a hosted page).
- **Multi-currency charging now** — rejected for this go-live; VUV is the
  operating currency and the pricing/accounting model is VUV-only. Revisit only
  with a currency/FX policy.
- **Stripe** — not available to Vanuatu merchants; kept disabled.
- **Refunding from the website** — rejected; refunds stay in the bank's Back
  Office and are mirrored into the site's ledger.

## Components documented

- `server/infrastructure/payments/payzen.adapter.ts`
- `server/infrastructure/payments/payzen-signature.ts`
- `server/application/payment.routes.ts` (checkout, IPN)
- `server/application/payment.application-service.ts` (status mapping, refunds)
- `server/application/payment-reconciliation.service.ts` (missed IPN)
- `shared/schema.ts` → `BredBankCredentialsSchema`
- `client/src/pages/admin/payments.tsx`
- [`docs/BRED_PAYZEN_GO_LIVE.md`](../BRED_PAYZEN_GO_LIVE.md),
  [`docs/PAYMENT_SANDBOX_TESTING.md`](../PAYMENT_SANDBOX_TESTING.md)

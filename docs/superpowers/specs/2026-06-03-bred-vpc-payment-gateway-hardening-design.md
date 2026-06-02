# BRED Bank Card Payments — VPC/MIGS Gateway Hardening

**Date:** 2026-06-03
**Status:** Approved design — pending spec review → implementation plan
**Author:** Mark (with Claude)

## Context

Ace Tours is obtaining a BRED Bank merchant account to accept card payments via
BRED's **hosted checkout** using the **classic MIGS/VPC redirect** model
(merchantId + accessCode + secureHashSecret → build `vpc_*` query string →
redirect browser to the bank's hosted page → bank returns `vpc_*` params to our
ReturnURL).

The codebase already implements this model through a shared adapter:

- `BredEGateAdapter` → delegates to `MastercardGatewayAdapter` (server/infrastructure/payments/)
- `AnzEGateAdapter` and `BspEGateAdapter` delegate to the **same** shared adapter
- Factory wiring, feature flags, kill switches, ownership checks, hold-TTL,
  payment expiry, domain events, reconciliation worker, and GET/POST callback
  routes already exist and are sound.

Because all three banks share `MastercardGatewayAdapter`, every fix here hardens
ANZ, BSP, and BRED simultaneously.

### Decisions captured during brainstorming

- **Protocol:** Classic MIGS/VPC redirect (not the newer MPGS session/Checkout.js).
- **Deliverable:** Implement go-live fixes now with strict TDD.
- **BRED docs:** Not in hand yet. Code against documented MIGS/VPC behavior and
  **isolate protocol-uncertain seams** so they can be confirmed/flipped without a
  rewrite when BRED's integration guide arrives.
- **Refunds:** In scope for this work.

### Already verified (not a problem)

- **VUV zero-decimal handling is correct.** `bookings.totalAmountCents` stores
  whole vatu for VUV (confirmed by the zero-decimal branch in
  `paypal.adapter.ts`), and the application service hardcodes currency `'VUV'`.
  Passing the stored integer straight into `vpc_Amount` is correct for VUV. We
  will add a defensive guard/comment only (item 7), not a behavioral change.

## Goals

Make the VPC/MIGS card-payment path production-ready and test-covered so it can be
pointed at the live BRED endpoint with only credential + confirmed-seam config
changes.

## Non-goals

- MPGS session-based Hosted Checkout (Checkout.js) — different protocol, not used.
- Changes to the reconciliation worker (already correct).
- Changes to the `/api/payments/webhook/:gateway` 405-for-non-stripe behavior
  (banks use the callback route, not this webhook route).

## Architecture

Keep the deliberate shared-adapter design. Extract the secure-hash logic into a
dedicated, fully-tested module so the one genuinely uncertain piece of the
protocol is isolated behind a single seam.

```
payment.routes.ts  (callback GET/POST, success/cancel redirects)
    └─ payment.application-service.ts  (resolution, amount verification, state transitions)
         └─ PaymentFactory → BredEGateAdapter ─┐
                              AnzEGateAdapter ──┼─→ MastercardGatewayAdapter
                              BspEGateAdapter ──┘        └─ vpc-secure-hash.ts  (NEW, isolated)
```

## Changes (by severity)

### 1. Secure-hash correctness — BLOCKER (protocol)
**New file:** `server/infrastructure/payments/vpc-secure-hash.ts`

Current `generateSecureHash`/`verifySecureHash` concatenate **values only** and
exclude only `vpc_SecureHash`. Standard MIGS HMAC-SHA256 excludes **both**
`vpc_SecureHash` and `vpc_SecureHashType`, sorts fields by key, and (SHA-256
variant) joins as `key=value&…`.

Extract into one module exposing `generate(params, secret, format)` and
`verify(params, receivedHash, secret, format)` with:
- Both `vpc_SecureHash` **and** `vpc_SecureHashType` excluded from the digest.
- A single `hashFormat` seam: `'KEY_VALUE'` (HMAC-SHA256 over sorted
  `key=value&…`) as the default, `'VALUE_CONCAT'` (legacy values-only) retained
  for fallback.
- Uppercase hex output; timing-safe verify (preserve existing
  `crypto.timingSafeEqual` use).
- `// CONFIRM-WITH-BRED` markers on the format choice and on whether the secret
  is used as a UTF-8 string or hex-decoded key.
- **Known-answer-vector unit tests** so the chosen format is locked and
  regression-proof.

Both adapter call sites delegate to this module. `hashFormat` resolves from
gateway config with a documented default.

### 2. Verify callback amount + currency — HIGH (security)
**File:** `server/application/payment.application-service.ts` (`handlePaymentWebhook`)

Today a payment becomes `Completed` on `vpc_TxnResponseCode === '0'` + valid
hash, with no check that the bank-reported amount matches ours. Add: after hash
+ code pass, compare bank `vpc_Amount` (and currency) against the stored
`payment.amount`/currency. On mismatch → set `ManualReviewRequired`, emit an
admin alert, and do **not** transition to `Completed`. The adapter's
`handleWebhook` will surface the bank-reported amount/currency in its
`WebhookResponse` so the service can compare.

### 3. Resolve payment by `vpc_MerchTxnRef` — MEDIUM
**Files:** adapter `handleWebhook` + `handlePaymentWebhook`

We store our generated `transactionId` as the payment's `gatewayReference`; the
bank echoes it back as `vpc_MerchTxnRef`. Resolve the exact payment by that ref
first; fall back to the existing bookingId/first-active lookup only when the ref
is absent. Prevents mis-resolution across multiple attempts on one booking.

### 4. Real `refundPayment` — HIGH (in scope)
**File:** `mastercard-gateway.adapter.ts`

Replace the mock with a signed `vpc_Command=refund` server-to-server POST to the
data-port endpoint, reusing the queryDR plumbing (sign → POST → parse
url-encoded response → verify response hash → map `vpc_TxnResponseCode`). Honors
partial amounts. Returns a real `PaymentStatusResponse` (Refunded / failure with
reason).

### 5. Tests on the money path — HIGH (none exist today)
**New:** vitest suites alongside the adapter, application service, and routes.

Written first (TDD), covering:
- Hash known-answer vectors (generate + verify, both formats, exclusion rules).
- `initiatePayment`: VPC param construction, unsupported-currency rejection,
  redirect-URL assembly, 3DS threshold branch.
- `handleWebhook`: valid hash success, invalid hash rejection, response-code
  mapping, **amount-mismatch → review**.
- `queryDR`: response parsing, `vpc_DRExists`/code mapping, hash verify, network
  error handling.
- `refundPayment`: signed request, response mapping, partial amount.
- Callback routes: success/cancel redirect targets, unknown-gateway 404,
  terminal-state idempotency (duplicate callback after completion is a no-op).

### 6. Separate pay vs. data-port endpoint — MEDIUM (protocol)
**Files:** schema config + adapter

MIGS typically uses a `vpcpay` redirect URL for initiate and a separate `vpcdps`
data port for queryDR/refund. The adapter currently uses one `apiEndpoint` for
both. Add an optional second endpoint (e.g. `dataPortEndpoint`) defaulting to
`apiEndpoint` when unset, isolated and marked `// CONFIRM-WITH-BRED`.

### 7. Zero-decimal guard — LOW
**File:** `mastercard-gateway.adapter.ts`

Add an explicit currency-exponent guard/comment so the (currently correct for
VUV) amount handling is documented and safe if reused for a minor-unit currency.
No behavioral change for VUV.

### 8. Logging hygiene — LOW
Replace ad-hoc `console.*` in the adapter with the existing `createLogger`;
ensure secrets, secure-hash secrets, and full hashes are never logged.

## Data flow (happy path, unchanged shape)

1. `POST /api/payments/checkout` → app service creates `Pending` payment,
   `initiatePayment` builds signed `vpc_*` redirect URL, payment → `Processing`,
   `gatewayReference = transactionId`.
2. Customer pays on BRED's hosted page.
3. BRED redirects to `/api/payments/callback/bred-bank?vpc_…`.
4. App service: verify hash → resolve by `vpc_MerchTxnRef` → **verify amount** →
   map code → transition (`Completed` / `Failed` / `ManualReviewRequired`).
5. Browser redirected to `/payment/success` or `/payment/cancel`.
6. Dropped callbacks recovered later by the reconciliation worker via `queryDR`.

## Error handling

- Invalid/missing hash → reject, no state change.
- Amount/currency mismatch → `ManualReviewRequired` + admin alert.
- Unknown gateway slug on callback → 404.
- Terminal-state payment + new callback → no-op (idempotent).
- queryDR / refund network errors → `Pending` (retryable), never a false terminal.

## Risks & open items (confirm against BRED's guide before go-live)

- **Hash format** (`KEY_VALUE` vs `VALUE_CONCAT`; secret as string vs hex key).
- **Endpoints** (single vs separate pay/data-port URLs).
- **Response codes** beyond `'0'`/`'300'` that BRED returns.
- **Currency code** representation expected by BRED (alpha `VUV` assumed).

All four are isolated behind config/seams with `// CONFIRM-WITH-BRED` markers and
covered by tests, so confirming them is a config change, not a rewrite.

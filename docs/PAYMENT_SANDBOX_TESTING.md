# Card-payment sandbox testing

This project does **not** ship its own payment simulator. "Sandbox" here means
the **bank's test environment**, reached with the bank's test merchant
credentials. There is no separate application environment you can flip on with
one variable.

## What is already in the code

- Each gateway row has a `mode` field in its `credentials` (`TEST` for MPGS,
  `TEST`/`PRODUCTION` for PayZen). The adapter uses that field — not the
  `PAYMENTS_*_MODE` environment variables (those were unused and have been
  removed from the sample config).
- A gateway whose credentials are in `TEST` mode is hidden from guests and
  refused for non-admin checkout (`isTestModeGateway`,
  `public-gateway.ts` / `payment.application-service.ts`). This prevents a guest
  from paying with a published test card and getting a booking confirmed unpaid.
- Admins can see and use TEST-mode gateways, so an end-to-end test can be run
  from the admin account.

## Credentials you need from the bank

### ANZ / BSP / NBV (MPGS Hosted Checkout)

In Admin → Payments → the bank gateway, enter the **test** values:

| Field | What it is |
|---|---|
| `mode` | `TEST` |
| `gatewayUrl` | the bank's MPGS test host (for example the ANZ/BSP/NBV test gateway URL) |
| `testMerchantId` | the test merchant ID the bank issues |
| `testApiPassword` | the test API password for that merchant |
| `testNotificationSecret` | optional; the `X-Notification-Secret` the bank sends |

The bank supplies its own test card numbers. Do not use production card numbers
in test mode.

### BRED (Lyra PayZen)

| Field | What it is |
|---|---|
| `shopId` | the 8-digit PayZen shop ID (must match `vads_site_id` in the IPN) |
| `mode` | `TEST` or `PRODUCTION` (selects the key and is sent as `vads_ctx_mode`) |
| `testKey` | the TEST signature key |
| `productionKey` | the PRODUCTION key, issued by BRED after testing |
| `paymentUrl` | `https://secure.payzen.eu/vads-payment/` (default) or the BRED-specific URL. Entering it here is enough: the `form-action` CSP allowlist follows the saved value automatically. |

PayZen's test cards and 3-D Secure test profiles come from the Lyra/PayZen
documentation and are enabled by BRED on the test shop.

#### PayZen shop settings that must match the code

These are configured in the PayZen **Back Office** (ask BRED to set them):

- **IPN / notification URL** (test and production):
  `https://acetoursvanuatu.com/api/payments/webhook/bred-bank`, with automatic
  retry on failure. The route replies `text/plain` 200 (accepted) or 400
  (rejected); PayZen retries non-200 replies.
- **Signature algorithm:** HMAC-SHA-256. The adapter signs `vads_*` field
  *values* sorted by field name, joined with `+`, then `+<key>`, Base64-encoded
  (`server/infrastructure/payments/payzen-signature.ts`).
- **Currency:** VUV enabled on the shop. VUV is a **zero-decimal** currency: the
  site stores whole vatu and sends `vads_amount=5000` for VT 5,000 — **not**
  `500000` (no minor-unit multiplication). The adapter refuses any other currency.
- **Capture / 3-D Secure:** same-day automatic capture and 3-D Secure on, so a
  normal payment settles without manual validation in the Back Office.

#### PayZen is notification-only

The adapter has no status-query API (`supportsStatusQuery() === false`), so the
IPN is the only authoritative result. If it never arrives:

- the payment is **not** guessed paid and **not** silently cancelled;
- the reconciliation worker waits until the payment window closes, then moves the
  payment to `manual_review_required`, e-mails an admin, and holds the review for
  72 hours;
- the admin then checks the PayZen Back Office: expire the payment if the card was
  not charged, confirm it if it was, or refund in the Back Office.

#### Refunds are manual in the PayZen Back Office

The site cannot refund a card. Refund the transaction in the Back Office; PayZen
sends a `CREDIT` IPN and the site records it (`refunded_amount`, `refunded_at`,
`refund_reference`): full refund → `refunded`, partial → `completed` with the
refunded amount, refund without a completed payment → `manual_review_required`.
If the `CREDIT` IPN is lost, record the refund through the admin reconciliation
action with a note.


## Recommended setup

1. **Use a staging deployment, not production.** Point a Render service at a
   separate Neon branch (or database) and send test email to an internal inbox.
2. Set `PAYMENT_CREDENTIALS_KEY` (and optionally `DATA_ENCRYPTION_KEY`) in that
   service's environment. Gateway credentials cannot be saved/opened without it.
3. Set the gateway's server switch on in the environment
   (`PAYMENTS_ANZ_ENABLED=true`, `PAYMENTS_BSP_ENABLED=true`,
   `PAYMENTS_NBV_ENABLED=true`, or `PAYMENTS_BRED_ENABLED=true`) and set
   `DDD_DISABLE_CARD=false` (it defaults to "cards disabled"). Also make sure
   `PAUSE_CARD_PAYMENTS` and `GLOBAL_PAYMENTS_PAUSE` are not `true`. The admin
   `active` toggle alone is not enough.
4. In Admin → Payments, open the gateway, enter the **test** credentials with
   `mode: TEST`, and activate it. Do not make it the default gateway for guests.
5. For server-to-server notifications (PayZen IPN, MPGS notification), the bank
   must be able to reach your test host over HTTPS. A local `npm run dev`
   instance needs a tunnel such as ngrok/cloudflared; a staging Render URL
   works without one.
6. Log in as an **admin** (TEST gateways are hidden from guests) and run a
   booking through the gateway.

## Checklist for each bank

- [ ] Admin sees the test gateway; a logged-out guest does not.
- [ ] A test card completes the bank page and returns to
      `/payment/success?booking=…&receipt=…`; the receipt page loads without a
      guest session (signed receipt token).
- [ ] The booking becomes `confirmed`; the payment becomes `completed`; the guest
      and admin emails are sent once.
- [ ] Replaying the bank notification does not create a second confirmation
      (idempotency) and does not double-charge.
- [ ] A declined/cancelled card leaves the booking `pending`; the hold is
      released by the expiry job.
- [ ] A callback with the wrong amount/currency lands in
      `manual_review_required`, not `completed`.
- [ ] Replaying the same IPN does not double-confirm; a duplicate refund IPN does
      not count the refund twice.
- [ ] A refund created in the PayZen Back Office is recorded from the `CREDIT`
      IPN (full → `refunded`, partial → `completed` with `refunded_amount`).
- [ ] With the IPN deliberately not delivered, the reconciliation worker moves the
      payment to `manual_review_required` after its window and e-mails the admin
      (it is not silently cancelled or marked paid).
- [ ] The admin cancellation of a confirmed test booking frees its seats.
- [ ] Switching `mode` to `PRODUCTION` with production credentials is a separate,
      reviewed change; TEST and PRODUCTION credentials are never mixed.

## Not sandbox-ready

`paypal`, `wantok-money`, `digicel-mobile-money`, `kwikpay`, `google-pay` and
`apple-pay` are stub or semi-stub adapters. They are inactive by default and
their webhooks now fail closed. Do not treat them as testable gateways until a
real integration (with credentials and a documented sandbox) is added.

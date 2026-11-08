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
| `shopId` | the PayZen test shop ID |
| `mode` | `TEST` |
| `testKey` | the test signature key |
| `paymentUrl` | `https://secure.payzen.eu/vads-payment/` (default) |

PayZen's test cards and 3-D Secure test profiles come from the Lyra/PayZen
documentation and are enabled by BRED on the test shop.

## Recommended setup

1. **Use a staging deployment, not production.** Point a Render/Fly service at a
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
   instance needs a tunnel such as ngrok/cloudflared; a staging Render/Fly URL
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
- [ ] The admin cancellation of a confirmed test booking frees its seats.
- [ ] Switching `mode` to `PRODUCTION` with production credentials is a separate,
      reviewed change; TEST and PRODUCTION credentials are never mixed.

## Not sandbox-ready

`paypal`, `wantok-money`, `digicel-mobile-money`, `kwikpay`, `google-pay` and
`apple-pay` are stub or semi-stub adapters. They are inactive by default and
their webhooks now fail closed. Do not treat them as testable gateways until a
real integration (with credentials and a documented sandbox) is added.

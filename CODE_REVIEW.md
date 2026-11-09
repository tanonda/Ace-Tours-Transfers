# Code Review — Ace Tours & Transfers

**Date:** 8 November 2026
**Scope:** whole repository (~87k LoC TypeScript): `client/`, `server/`, `shared/`, `scripts/`, `migrations/`, build/deploy config.
**Method:** static review with targeted execution. No source files were modified and no production database was connected to. See [Verification](#verification) for what was run.

> **Update 2026-11-08:** The issues in this review have been worked through. All Critical and High findings, and the Medium items marked below, are fixed; see [Fix status](#fix-status-2026-11-08), [`docs/FIXES_CHANGELOG.md`](docs/FIXES_CHANGELOG.md) and migrations `0027`–`0033`. Residual items are listed at the end.

---

## Overall assessment

This is a substantially above-average production codebase. The domain model is real (holds, confirmation, reconciliation), the security posture is deliberate (CSRF, session regeneration, role re-reads, response allow-lists, AES-GCM at rest, CSP), and the test suite is large and passing (909 tests). The recent commits show careful work on the hard parts: multi-item holds, manual confirmation, paid-after-close, statement matching.

The problems are not "this is sloppy". They are **integration seams**: components that are individually good but wired together incorrectly, or not wired at all. The most serious case is the payment webhook pipeline, where every gateway adapter except Stripe receives a raw `Buffer` at runtime while every test mounts its own parser and passes an object. That is exactly the class of bug a green test suite can hide.

**Verdict:** safe to run the current manual/cash/bank-transfer business, with a short list of fixes first. **Not safe to enable card payments** until the webhook pipeline (C1/C2) and the optional-signature adapters (H6) are fixed.

---

## Top risks at a glance

| ID | Severity | Finding | Live today? |
|----|----------|---------|-------------|
| C1 | Critical | All non-Stripe gateway webhooks receive a `Buffer`; IPNs always rejected | Latent (card gateways off by default) |
| C2 | Critical | A completed payment whose seats can't be confirmed is a dead end — no retry, no alert | Latent |
| H1 | High | Unauthenticated `POST /api/holds` accepts negative quantity → capacity manipulation | Yes |
| H2 | High | Peak-season surcharge and date-versioned pricing are silently dropped at checkout | Yes (Jan/Dec, default 20%) |
| H3 | High | Cancelling/deleting a confirmed booking never frees its seats; "inventory repair" resets counts to ~0 | Yes |
| H4 | High | `tour_instances` unique index is defeated by `NULL` columns → duplicate capacity pools | Yes (full-day products) |
| H5 | High | Booking creation silently drops guest phone, notes and locale | Yes |
| H6 | High | Google Pay / Apple Pay / PayPal webhook signatures are optional | Latent |
| H7 | High | Customer portal is hard-coded demo data; "password updated" is a lie | Yes |
| H8 | High | Retrying a booking with its idempotency key leaks seat holds | Yes |
| H9 | High | `bookings.locale` is in `schema.ts` but not in any migration | Recovery risk |
| H10 | High | Database TLS certificate verification is disabled | Yes |

---

## Critical

### C1. Every non-Stripe gateway webhook is rejected at runtime

**Where:** [server/index.ts:254–266](server/index.ts#L254-L266), [server/application/payment.routes.ts:268–320](server/application/payment.routes.ts#L268-L320), [server/infrastructure/payments/payzen.adapter.ts:143–148](server/infrastructure/payments/payzen.adapter.ts#L143-L148), [server/infrastructure/payments/mpgs.adapter.ts:304–315](server/infrastructure/payments/mpgs.adapter.ts#L304-L315).

The global body parser routes every `/api/payments/webhook/*` request through `express.raw({ type: '*/*' })`, so `req.body` is a `Buffer`. The routes then pass that `Buffer` to adapters that expect a parsed object:

- **PayZen/BRED** does `ipn.vads_site_id` on a `Buffer` → `undefined`, returns `"IPN is for a different PayZen shop."`, HTTP 400.
- **MPGS** (ANZ/BSP/NBV) does `typeof raw.order === 'object'` → false for a `Buffer`, so notification order IDs are never read.
- **WanTok/Digicel/KwikPay/PayPal** never reach their adapters at all: the router returns `405 Method Not Allowed` for every gateway that is not BRED, MPGS or Stripe ([payment.routes.ts:311–314](server/application/payment.routes.ts#L311-L314)). Even if that guard were relaxed, they would receive a `Buffer` and no signature headers, because the route forwards only `stripe-signature` ([payment.routes.ts:268](server/application/payment.routes.ts#L268)).

I reproduced this with the **exact production parser**: a correctly signed PayZen IPN that returns **200** in the existing test ([payment.routes.payzen.test.ts:60–66](server/application/payment.routes.payzen.test.ts#L60-L66)) returns **400** when mounted under the real middleware. The test passes because it builds its own app with `express.urlencoded`, not because the route works.

**Impact:** BRED card payments can only complete if the guest's browser returns to `/api/payments/callback/bred-bank` with the signed query string. If the guest closes the tab after paying (common), the payment stays `processing`, the booking stays `pending`, the hold expires and the seats are released, and the guest has been charged. PayZen has no status-query fallback (`queryPaymentStatus` throws), so reconciliation cannot rescue it either.

**Fix:** parse per gateway, and keep raw only where a signature needs the raw bytes:

```ts
// in the router, before the handler
if (gateway === 'bred-bank')       express.urlencoded({ extended: false })(req, res, next);
else if (isMpgsGateway(gateway))   express.json()(req, res, next);
else if (gateway === 'stripe')     express.raw({ type: '*/*' })(req, res, next);
// mobile money: raw + forward headers
```

Add a **route-level** integration test that mounts the real middleware stack (or export the parser selection into a testable function) for each gateway. Do this before enabling any card gateway.

---

### C2. Paid-but-unconfirmed is a dead end

**Where:** [server/application/events/BookingEventHandler.ts:86–93](server/application/events/BookingEventHandler.ts#L86-L93), [server/application/booking/AtomicSessionConfirmationService.ts:118–127](server/application/booking/AtomicSessionConfirmationService.ts#L118-L127), [server/infrastructure/events/event-dispatcher.ts:34–40](server/infrastructure/events/event-dispatcher.ts#L34-L40), [server/application/payment.application-service.ts:585–600](server/application/payment.application-service.ts#L585-L600).

Payment completion is written first, then `PaymentConfirmed` is dispatched. The handler confirms the booking's holds; if a hold is no longer `ACTIVE` (the expiry job released it) or has `expiresAt < now`, it throws `HOLD_EXPIRED`. The dispatcher catches every handler error and only `console.error`s it. Result:

- payment `completed`,
- booking still `pending`/`expired`,
- seats released and resold,
- no admin alert, no retry, no refund trigger.

The card hold TTL is 15 minutes ([availability.application-service.ts:12](server/application/availability/availability.application-service.ts#L12)). A guest on a 3-D Secure page for 15+ minutes is enough to hit this. C1 makes it much more likely, because the IPN usually arrives after the browser has gone.

**Fix:** treat "completed payment, unconfirmed booking" as a first-class state. On any confirmation failure with a completed payment, set the booking to `manual_review_required`/`inventory_conflict`, write an admin notification, email the admin, and expose it in the recovery screen. Longer term, do not expire a booking while any payment is `processing`, and make the confirmation handler retryable (outbox/idempotent queue) rather than fire-and-forget.

---

## High

### H1. Unauthenticated negative-quantity holds can free seats

**Where:** [server/routes/availability.routes.ts:100–113](server/routes/availability.routes.ts#L100-L113), [server/domain/availability/availability.service.ts:105–130](server/domain/availability/availability.service.ts#L105-L130), [server/domain/availability/availability.service.ts:481–486](server/domain/availability/availability.service.ts#L481-L486).

`POST /api/holds` is public by design (guest checkout). It checks only `if (!tourId || !date || !quantity)`. `parseInt(-5)` is truthy, so `quantity: -5` reaches `createHold`, where the only guard is `if (available < quantity)` — false for a negative number — followed by `heldCount = heldCount + (-5)`. The hold row is created with `quantity = -5`.

When that hold later expires, `releaseHold` computes `Math.max(0, heldCount - (-5))`, i.e. **adds 5 back**. An unauthenticated attacker can therefore:

1. create a negative hold to reduce `heldCount`,
2. book the freed seats,
3. let the negative hold expire to inflate `heldCount` beyond real capacity.

Even without step 2, they can drive a sold-out day negative. This is an inventory-integrity vulnerability, not just a validation nit.

**Fix:** validate with a schema: `quantity` integer, `1 <= quantity <= MAX_PAX`, `date` a real calendar date not in the past, `tourId` a product UUID. Reject unknown keys. Also cap per-session hold count.

### H2. Peak-season and date-versioned pricing are dropped at checkout

**Where:** [server/routes/bookings.routes.ts:44–55](server/routes/bookings.routes.ts#L44-L55), [server/application/booking/CreateBookingFromCartService.ts:134–143](server/application/booking/CreateBookingFromCartService.ts#L134-L143), [server/application/pricing/PriceCartService.ts:22–35](server/application/pricing/PriceCartService.ts#L22-L35), [server/domain/pricing/PricingEngine.ts:170–173](server/domain/pricing/PricingEngine.ts#L170-L173) and [240–246](server/domain/pricing/PricingEngine.ts#L240-L246).

`PriceCartService.priceCart` accepts an optional `date` and passes it to `getTourRate` (which selects a date-effective pricing version) and to `calculateLineItem` (which applies the peak-season surcharge). Both call sites omit it:

- `/api/cart/price` maps items to `{ productId, adultPax, childPax, infantPax, petPax, quantity, addonIds }` — no `date`.
- `CreateBookingFromCartService` maps the same way — no `date`.

The client **does** send the date ([cart-context.tsx:225–230](client/src/lib/cart-context.tsx#L225-L230)) and displays the surcharge in the cart ([cart.tsx:33–35](client/src/pages/cart.tsx#L33-L35)). The result is a visible price on the cart page, a lower server quote on the payment page, and a final booking total that omits the default **20% January/December peak surcharge** and every admin-configured date-versioned price.

**Fix:** add `date: item.date` to both maps (one-line each), then add an integration test that a December booking totals base + 20%.

### H3. Confirmed-booking cancellations and the recovery tool corrupt capacity

**Where:** [server/routes/bookings.routes.ts:838–856](server/routes/bookings.routes.ts#L838-L856), [server/storage.ts:675–713](server/storage.ts#L675-L713), [server/application/availability/inventory-repair.service.ts:36–62](server/application/availability/inventory-repair.service.ts#L36-L62), [server/application/availability/inventory-repair.service.ts:154–172](server/application/availability/inventory-repair.service.ts#L154-L172), [server/routes/recovery.ts:33–90](server/routes/recovery.ts#L33-L90).

There are three distinct problems in the same accounting path:

1. **Admin cancel of a confirmed booking** releases holds via `releaseHold`, which returns `false` for a `CONFIRMED` hold and does not decrement `confirmedCount`. Cancelling a confirmed tour leaves its seats permanently "sold". The refund email is sent; the inventory is not freed.
2. **Hard delete** decrements `confirmedCount` only `if (booking.status === 'confirmed' && booking.tourInstanceId)`. The current booking creation path never writes `tourInstanceId` ([CreateBookingFromCartService.ts:155–185](server/application/booking/CreateBookingFromCartService.ts#L155-L185)), so the condition is always false. For multi-item bookings it would also decrement the first item's instance by all guests.
3. **"Repair" is worse than the disease.** `repairTourInstance` sets `confirmedCount` to `sum(sql\`1\`)` over confirmed bookings — that is the *number of bookings*, not seats — and only counts rows whose `tourInstanceId` matches. Because that column is null, the admin "Run recovery playbook" action resets every instance's `confirmedCount` to 0, freeing every seat on the site.

**Fix:** make confirmed-seat release operate per `CONFIRMED` hold (decrement the hold's instance by `hold.quantity`, then mark it released) and use it from cancel/delete/fraud-dismiss. Delete the current repair service or rewrite it as `SUM(hold.quantity)` over `CONFIRMED` holds grouped by instance. Add tests with `confirmedCount` assertions — the existing suites assert booking/payment status but not inventory counts.

### H4. `tour_instances` uniqueness does not work for full-day products

**Where:** [shared/schema.ts:129–131](shared/schema.ts#L129-L131), [migrations/0002_redundant_tag.sql:19–25](migrations/0002_redundant_tag.sql#L19-L25), [server/domain/availability/availability.service.ts:551–591](server/domain/availability/availability.service.ts#L551-L591).

The unique index covers `(tour_id, service_date, time_slot, start_time, end_time)`. All three optional columns are nullable, and PostgreSQL treats `NULL`s as distinct, so unlimited duplicate instances can be inserted for a full-day tour (all null) or any partially-null combination. `getOrCreateInstanceLocked` uses `SELECT … FOR UPDATE`, which locks nothing when the row does not exist; two concurrent first bookings both insert and both commit. Capacity is split across two pools and `checkAvailability` takes the *minimum* across overlapping pools, so the same seats can be sold twice.

`server/scripts/apply-unique-index.ts` makes this worse: it replaces the index with a three-column version that would reject legitimate second sessions.

**Fix:** backfill/dedupe, then `CREATE UNIQUE INDEX … ON tour_instances (tour_id, service_date, COALESCE(time_slot,''), COALESCE(start_time,''), COALESCE(end_time,''))` (or PG 15+ `UNIQUE NULLS NOT DISTINCT`). Consider also an advisory lock on `(tour_id, date)` for instance creation.

### H5. Booking creation throws away phone, notes and locale

**Where:** [server/routes/shared.ts:94–107](server/routes/shared.ts#L94-L107), [server/routes/bookings.routes.ts:654–671](server/routes/bookings.routes.ts#L654-L671), [client/src/pages/payment.tsx:231–236](client/src/pages/payment.tsx#L231-L236).

The payment page sends `customerPhone`, `notes` and `locale`. `createBookingBodySchema` declares none of `customerPhone`/`notes` and the route destructures only `items, customerName, customerEmail, pickupLocation, idempotencyKey`. Zod strips unknown keys silently, so:

- every online booking has `customer_phone = NULL` (SMS never sends, staff can't call, the `GuestNotificationHandler` phone branch is dead),
- special requests/pickup notes are lost,
- `locale` is always `"en"` even when the guest used French/Bislama, so all emails are English.

It also makes the "verify by phone" bypass below trivially reachable, because the stored phone is empty for essentially all web bookings.

**Fix:** add `customerPhone` (max ~30, optional) and `notes` (max ~2000, optional) to the schema, pass them into `execute()`, and pass `locale`. Write a route test asserting they are persisted.

### H6. Google Pay / Apple Pay / PayPal accept unsigned webhooks

**Where:** [server/infrastructure/payments/google-pay.adapter.ts:342–373](server/infrastructure/payments/google-pay.adapter.ts#L342-L373), [server/infrastructure/payments/apple-pay.adapter.ts:333–357](server/infrastructure/payments/apple-pay.adapter.ts#L333-L357), [server/infrastructure/payments/paypal.adapter.ts:220–239](server/infrastructure/payments/paypal.adapter.ts#L220-L239).

Google Pay and Apple Pay verify `vpc_SecureHash` only `if (bank && params.vpc_SecureHash)`. A request that simply omits the hash skips verification, then `vpc_TxnResponseCode === '0'` is treated as `Completed`. PayPal verifies only `if (this.credentials.ipnWebhookUrl && event.headers)`; otherwise it trusts `event_type` and auto-captures.

These are described as stubs, and they are inactive by default, but they are **activatable from Admin → Payments** and `isGatewayEnabledByEnv` returns `true` for slugs without an env switch. Today the webhook router 405s these slugs ([payment.routes.ts:311–314](server/application/payment.routes.ts#L311-L314)), so the defect is not reachable; it becomes live the moment C1 is fixed by routing them through the generic handler. Treat H6 as a prerequisite for that fix.

**Fix:** fail closed — no hash/signature means reject. Remove the adapters from the factory until they are real, or gate them behind an explicit "experimental" flag that cannot be turned on in production.

### H7. The customer portal is fabricated

**Where:** [client/src/pages/customer/profile.tsx:36–75](client/src/pages/customer/profile.tsx#L36-L75), [client/src/pages/customer/dashboard.tsx:233](client/src/pages/customer/dashboard.tsx#L233), [client/src/pages/customer/saved.tsx:29–37](client/src/pages/customer/saved.tsx#L29-L37), [client/src/pages/customer/bookings.tsx:41–50](client/src/pages/customer/bookings.tsx#L41-L50).

Profile fields are hard-coded (`James`, `Doe`, `james.doe@example.com`), Save only toasts, and the password form is uncontrolled with an Update Password button that also only toasts — **the user is told the password changed when no request was made**. The dashboard shows a hard-coded `walletBalance = 52300`, loyalty points, wishlist count, and a "Modify" action that sends nothing but says "Request Sent".

**Fix:** wire the profile and password forms to the existing `/api/users/:id` and `/api/users/:id/change-password` endpoints, remove or disable the invented balances, and gate the unimplemented actions behind an explicit "coming soon" state.

### H8. Idempotent booking retries leak holds

**Where:** [server/application/booking/CreateBookingFromCartService.ts:55–105](server/application/booking/CreateBookingFromCartService.ts#L55-L105), [server/storage.ts:623–649](server/storage.ts#L623-L649).

`execute()` creates a fresh `bookingId`/cart and creates all holds **before** calling `storage.createBooking`, which uses `ON CONFLICT DO NOTHING` and returns the existing booking when the idempotency key repeats. The transaction then commits, so the retry's holds are never attached to any booking and stay `ACTIVE` until TTL. The client intentionally keeps one idempotency key per page load ([payment.tsx:109](client/src/pages/payment.tsx#L109)), so any retry after a timeout produces orphan holds.

**Fix:** look up the existing booking by `idempotencyKey` at the start of `execute()` and return it without creating holds. Use a DB advisory lock or unique insert to close the race between lookup and insert.

### H9. `bookings.locale` is absent from the migrations

**Where:** [shared/schema.ts:190](shared/schema.ts#L190), [server/application/booking/CreateBookingFromCartService.ts:186](server/application/booking/CreateBookingFromCartService.ts#L186).

`bookings.locale` is selected and written by the app, but no file under `migrations/` adds it (the `locale` columns in `0000` belong to `cms_content` and `newsletter_subscribers`). Production presumably has it from a `drizzle-kit push` at some point, which means a database rebuilt from `migrations/` — exactly what disaster recovery does — will fail every `SELECT * FROM bookings` with `42703`.

**Fix:** add an explicit `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS locale text DEFAULT 'en' NOT NULL`. While there, generate a schema-vs-migrations diff and add any other drift in both directions.

### H10. Database TLS is not authenticated

**Where:** [server/db.ts:63–66](server/db.ts#L63-L66), [server/migrate.ts:96–99](server/migrate.ts#L96-L99), [drizzle.config.ts:11–16](drizzle.config.ts#L11-L16).

`ssl: { servername: host, rejectUnauthorized: false }` disables certificate-chain and hostname validation, so the "TLS" connection to a public-internet Neon host authenticates nothing — anyone able to intercept traffic can present any certificate and read/write the booking database. The same pool also resolves the host once with `dns.resolve4` and connects to that IP for the process lifetime ([server/db.ts:31–51](server/db.ts#L31-L51)); after a Neon failover the process keeps dialling a dead address until restart.

**Fix:** download the Neon CA and use `ssl: { servername: host, rejectUnauthorized: true, ca }` (or `sslmode=verify-full` with the CA on the trust store). Prefer `dns.setDefaultResultOrder('ipv4first')` over freezing an IP, as `migrate.ts` already does.

---

## Medium

### M1. Business time is UTC+11, but cutoff/date logic is server-local (UTC)

[server/domain/services/availability.domain-service.ts:109–125](server/domain/services/availability.domain-service.ts#L109-L125) builds the departure instant with `new Date(year, month - 1, day, depHour, depMin)` — server-local. Containers run UTC, so a "08:30 departure" becomes 08:30 **UTC** (19:30 Vanuatu), shifting the 24-hour booking cutoff by 11 hours. `POST /api/bookings`' past-date check uses `new Date().toISOString().split('T')[0]` ([bookings.routes.ts:657](server/routes/bookings.routes.ts#L657)), which is the UTC date; between 00:00 and 10:59 Vanuatu time it is still "yesterday", so guests can book a past local date. Analytics windows are similarly shifted.

**Fix:** pin the business timezone (`Pacific/Efate`) explicitly — set `TZ=UTC` in the image and compute Vanuatu wall time with a helper (or add a `TZ` env and make it explicit), and compare ISO instants, not wall-clock constructors. Add tests around 00:30 and 23:30 Vanuatu.

### M2. The migration runner swallows errors and marks failed migrations applied

[server/migrate.ts:41–48](server/migrate.ts#L41-L48) treats `23505`, `42P01`, `42P07`, `42701`, `42704` as ignorable, continues, and then records the file as applied ([migrate.ts:150–154](server/migrate.ts#L150-L154)). Statements run in autocommit (no per-file transaction), there is no advisory lock, and `index.ts` ignores migration failure at boot ([server/index.ts:473–486](server/index.ts#L473-L486)).

Concrete failure: if `0026_verified_reviews.sql` hits duplicate `(booking_id, tour_id)` rows, the unique index is never created, the migration is marked done, and `createVerifiedReview`'s `ON CONFLICT` target is missing at runtime (`42P10`).

**Fix:** one transaction per migration file; never mark applied when a statement was skipped; `pg_advisory_lock` around the runner; fail startup (or readiness) on migration error. Treat only genuinely idempotent re-run codes (`42701`, `42P07`, `42710`) as ignorable.

### M3. CI does not run the test suite or the typecheck

[.github/workflows/verify.yml:44–59](.github/workflows/verify.yml#L44-L59) runs `PRERENDER=0 npm run build`, `npm run check-architecture` and `npm run go-live-verify`. It never runs `npm test` (909 tests) or `npm run check`. `npm run check` is currently **red**: `server/tsconfig.json` fails on two test files with `TS2835` (extensionless relative imports in `server/lib/product-slugs.test.ts` and `shared/product-path.test.ts`). The main `tsc` project passes.

**Fix:** add `npm test` and `npm run check` to CI (they already run in ~6 minutes locally). Fix the two imports. Consider running the tests against the Postgres service that CI already starts.

### M4. Every API response is logged in full, including PII

[server/index.ts:399–421](server/index.ts#L399-L421) wraps `res.json` and logs `JSON.stringify(capturedJsonResponse)` for every `/api` request. The scrub list covers `password`, `token`, `secret`, `credentials`, `credit_card`, `cvv` — but not `customerEmail`, `customerPhone`, `customerName`, addresses or notes. An admin opening `/api/bookings` writes the entire guest list (names, emails, phones) to Render's logs on every request, and the log volume is proportional to the whole bookings table.

**Fix:** log method/path/status/duration and a correlation id by default; log bodies only behind an explicit debug flag, with an allow-list (or hash) for PII. Truncate.

### M5. Index and query gaps

- `bookings` has **no index** for `customer_email`, `status`, `created_at`, `booking_session_id`, `user_id`, `tour_id`, or `date`. The "find my booking" lookup, fraud history, day sheets and `SELECT … FOR UPDATE WHERE booking_session_id = $1` (on every card confirmation) are sequential scans. `booking_items.booking_id`, `booking_addons.booking_id`, `payments.booking_id` and `payments.gateway_id` are unindexed foreign keys.
- `availability_holds` has only `(status, expires_at)`; `getHoldsBySession` and the confirmation lock scan the table.
- `payments.gateway_reference` (the main webhook resolution key) has no index and no uniqueness; `getPaymentByGatewayReference` returns an arbitrary row if duplicates exist.
- `GET /api/bookings` ([bookings.routes.ts:73–105](server/routes/bookings.routes.ts#L73-L105)) loads the whole `payments` table on every staff page view just to map gateway slugs.
- `getExpiredHolds` ([storage.ts:1519–1532](server/storage.ts#L1519-L1532)) has no `LIMIT`, and the expiry job runs 50 concurrent multi-statement transactions against a pool of 20 ([db.ts:61](server/db.ts#L61), [hold-expiry.job.ts:53](server/infrastructure/jobs/hold-expiry.job.ts#L53)).

**Fix:** add the composite/partial indexes; paginate the bookings list; resolve payment methods with a join restricted to the page; `LIMIT` + `FOR UPDATE SKIP LOCKED` for the sweep.

### M6. Concurrent checkout requests can create two open payments

`PaymentApplicationService.initiateBookingPayment` checks for an existing `pending`/`processing` payment with a read, then inserts ([payment.application-service.ts:80–90](server/application/payment.application-service.ts#L80-L90), [187–200](server/application/payment.application-service.ts#L187-L200)). Two concurrent requests both pass and create two payments; the guest could be charged twice. There is no DB constraint preventing it.

**Fix:** partial unique index on open payments per booking, or a transaction with `SELECT … FOR UPDATE` on the booking row.

### M7. Auth hardening gaps

- **Legacy plaintext password fallback**: `verifyPassword` falls back to `password === storedPassword` when bcrypt reports an invalid salt ([auth.domain-service.ts:44–58](server/domain/users/auth.domain-service.ts#L44-L58)). Any legacy plaintext row is accepted. Remove the fallback and force a reset.
- **Password reset** has no "request reset" endpoint; the consume endpoint has no minimum length check ([user.routes.ts:56–70](server/application/user.routes.ts#L56-L70)), so a reset can set `"a"`. Tokens are stored plaintext, and a password reset does not invalidate existing sessions.
- **TOTP secrets** are stored plaintext (`users.totp_secret`), and there is no replay guard on a used code.
- **Default admin credentials are published** in the handover doc (a seeded admin e-mail and literal password, [docs/CLIENT_HANDOVER.md:96–97](docs/CLIENT_HANDOVER.md#L96-L97)). The seed refuses to run in production, but the document should not advertise a working password; remove it and instruct a first-run reset. *(Fixed in the 2026-11-08 handover cleanup; the values are removed here and from the seed.)*

### M8. Routes that lead to a 404

`/login` is not a route; the login page is mounted at `/staff-access` ([App.tsx:219](client/src/App.tsx#L219)). Registration redirects to `/login` ([register.tsx:109](client/src/pages/register.tsx#L109), [233](client/src/pages/register.tsx#L233)) and password reset does too ([reset-password.tsx:35](client/src/pages/reset-password.tsx#L35), [73](client/src/pages/reset-password.tsx#L73)). A guest who just verified their account or reset their password lands on the not-found page. The "forgot password" link is `href="#"`.

**Fix:** route `/login` to `Login` (or redirect to `/staff-access`) and wire the reset-request flow.

### M9. `/checkout` redirects to `/cart` on a hard load

[checkout.tsx:34–38](client/src/pages/checkout.tsx#L34-L38) redirects whenever `items.length === 0`, but the cart hydrates from `localStorage` in a later effect ([cart-context.tsx:112–119](client/src/lib/cart-context.tsx#L112-L119)). On refresh/direct navigation the first render sees an empty cart and bounces the user. `isHydrated` exists internally but is not exposed in `CartState`.

**Fix:** expose `isHydrated` and redirect only after hydration (show a loader meanwhile).

### M10. Promotions and add-ons are half-built

- **Promotions**: admins can create them and `POST /api/promotions/validate` returns a discount, but nothing in the booking/price path applies it, `usedCount` is never incremented, and the only consumer ([booking-form.tsx:1050](client/src/components/booking-form.tsx#L1050)) is in an unused component. The promo line is displayed but not deducted from the total.
- **Add-ons**: the public product detail route always returns `addons: []` ([catalog.routes.ts:64–65](server/routes/catalog.routes.ts#L64-L65)) and `/api/products/:productId/addons` returns `[]`; admin add-on CRUD exists but has no effect on the storefront.

**Fix:** either finish the server-side application (promo totals + usage counting; product add-ons in `GET /api/products/:id`) or remove the admin UI and endpoints so staff are not misled.

### M11. CSV formula injection

`escapeCSV` ([bookings.routes.ts:113–125](server/routes/bookings.routes.ts#L113-L125)) quotes fields but does not neutralise cells beginning `=`, `+`, `-`, or `@`. Guest-controlled names/notes can execute formulas when staff open the export in Excel/Sheets. The client-side exports ([reports.tsx:93](client/src/pages/admin/reports.tsx#L93), [calendar.tsx:569](client/src/pages/admin/calendar.tsx#L569)) have the same gap.

**Fix:** prefix such cells with `'` before quoting.

### M12. Small authorization gaps

- `PATCH /api/notifications/:id/read` requires login but not ownership ([notifications.routes.ts:13–20](server/routes/notifications.routes.ts#L13-L20)); any user can mark another user's notification read.
- `GET /api/bookings/:id/qr` has no ownership check ([bookings.routes.ts:624–637](server/routes/bookings.routes.ts#L624-L637)). It returns only a QR for a manage link, but it is an unauthenticated existence oracle.
- Guest `POST /api/bookings/:id/cancel` with `type=phone` verifies `normalise(storedPhone) === normalise(value)`; because stored phone is usually `NULL` and the route only checks `value` is truthy, `value = " "` normalises to `""` and verifies ([bookings.routes.ts:230–235](server/routes/bookings.routes.ts#L230-L235)). Fix by rejecting blank/absent stored factors.

### M13. Confirmed bookings can still be cancelled by a PATCH with no seat release

Covered in H3, but note the same pattern in the fraud dismiss route ([admin-ops.routes.ts:76–92](server/routes/admin-ops.routes.ts#L76-L92)) and the fraud hard-block during booking creation ([bookings.routes.ts:701–705](server/routes/bookings.routes.ts#L701-L705)): both set `status: cancelled` without releasing holds or decreasing confirmed seats.

### M14. Reporting inconsistencies

`getRevenueByMonth` groups by `to_char(…, 'Mon')` — a month name with no year, no ordering, and only `status = 'confirmed'` (omitting `completed`, which the daily/top-product queries include). It happens to be unused ([storage.ts:752–764](server/storage.ts#L752-L764)), but if it is wired up later it will be wrong. Money is also stored twice (`bookings.amount` text and `totalAmountCents`), with the legacy column still written and used in emails/CSV.

### M15. Fragile integrity guard and migration metadata

`BackupIntegrityGuard` compares the count of applied migration files against `migrations/meta/_journal.json`, which has 15 entries while `migrations/` has 31 `.sql` files and duplicate numbers for 0011–0014. It survives only because it treats "more applied than journal" as harmless. `drizzle-kit generate` would diff against a stale snapshot. There is no unique constraint on `cms_content (block_slug, content_key, locale)` despite the seed claiming one.

### M16. Confirmed holds on cancel and cache invalidation

`AvailabilityApplicationService.releaseHold` dispatches `HoldReleased` even when the domain service returned `false` (already confirmed/released). `confirmHoldsBySession` and `releaseHold` do not invalidate the 60-second availability cache, so the storefront can show stale "sold out" for a minute after a cancellation.

### M17. Frontend-specific issues

- **Cart line double-counts on re-add** ([cart-context.tsx:159–169](client/src/lib/cart-context.tsx#L159-L169), [cart.tsx:214](client/src/pages/cart.tsx#L214)): adding the same product/date/time twice increments both `quantity` and `adultPax`/`childPax`, while the priced line total already includes pax. The line renders `finalItemSubtotal * item.quantity`, so a re-added 2-adult item shows 8 adults' worth while the order total (server snapshot) shows 4. Fix: keep `quantity` at 1 for per-person items, or stop multiplying the priced line total.
- **Stale availability responses can win a race** ([useRealtimeAvailability.ts:34–69](client/src/hooks/useRealtimeAvailability.ts#L34-L69)): the effect is keyed on `paramsKey`, but in-flight `checkAvailability` calls are never cancelled or tagged, so an older response can overwrite a newer date/time selection. Same pattern in `useCalendarData`. Fix: `AbortController` or a request-id guard.
- **Admin daily-schedule "Print" does not auto-print in production** ([admin/calendar.tsx:593](client/src/pages/admin/calendar.tsx#L593)): the popup relies on an inline `<script>window.print()</script>`, which the production CSP blocks (`script-src` has no `'unsafe-inline'`). Call `w.print()` from the opener as `admin/reports.tsx` already does.
- **"Pay Now" failure is silently swallowed** ([confirmation.tsx:46–60](client/src/pages/confirmation.tsx#L46-L60)): the catch only `console.error`s and the TODO admits there is no user feedback; the button stops spinning with nothing happening. Show a toast and allow retry.
- **Quick View can add a booking with no date** ([product-quick-view.tsx:66–80](client/src/components/product-quick-view.tsx#L66-L80), [211–220](client/src/components/product-quick-view.tsx#L211-L220)): the date input starts empty, is not required, and the Add button is always enabled; the handler silently substitutes today's date, bypassing the availability/calendar flow. Require a valid date >= today.
- **Custom modal/lightbox accessibility** ([tour-detail.tsx:120–138](client/src/pages/tour-detail.tsx#L120-L138), [233–260](client/src/pages/tour-detail.tsx#L233-L260), [shared-detail-components.tsx:150–176](client/src/components/shared-detail-components.tsx#L150-L176)): plain `div`s with no `role="dialog"`, `aria-modal`, accessible name, focus trap, Escape handling or focus restore; icon-only close buttons have no `aria-label`. Use the existing Radix `Dialog`.

### M18. Deployment configuration drifts from what the app needs

- **`render.yaml` omits required production variables**: `PAYMENT_CREDENTIALS_KEY` (without it, bank gateway credentials cannot be sealed or opened — the adapter returns `credentials: null` and card/BRED gateways stop working), `SENTRY_DSN`, `BETTERSTACK_*`, `GOOGLE_PLACES_API_KEY`/`GOOGLE_PLACE_ID`, `VITE_GOOGLE_MAPS_EMBED_KEY`, `PAYMENTS_*` card switches. An operator following the blueprint alone gets a running site with several silent degradations. Document them or add them with `sync: false`.
- **The Docker image runs as root** and installs dev dependencies in the runtime stage (`Dockerfile` has no `USER`; `npm install --include=dev`). `tsx` is needed for the startup prerender, but a non-root user and a separate production install would still work.
- **`vercel.json` is stale and misleading**: it rewrites `/api/(.*)` to `/api` (no serverless function exists) and everything else to `index.html`, bypassing the Express server entirely. Remove it or replace it with a working adapter.
- **Health check vs prerender**: `render.yaml` points `healthCheckPath` at `/api/health`, and `start-with-prerender.sh` starts the server before prerendering. Render can mark a deploy healthy while crawler HTML is still being generated. That is acceptable (snapshots are seeded first) but worth knowing during incident triage.

## Low / cleanup

- **Dead code:** `client/src/components/booking-form.tsx` (1,097 lines, zero importers), `booking-form-patch.ts` (a 90-line diff guide in source), `client/src/components/file-upload.tsx`, `image-upload.tsx`, `QRScanner.tsx`, `section-backdrop.tsx`, `wishlist-button.tsx`; server-side `AtomicBookingConfirmationService.confirmBookingAtomically` (broken for multi-instance, unused) and `domain/booking/booking-confirmation.service.ts` (unused). Two availability implementations and two booking-confirmation services coexist.
- **Assets:** `client/public/assets/logo.png` is 488 KB and used as a 32–48 px avatar on payment/checkout/success/cancel/confirmation. Use a `w_64` Cloudinary variant or a small local asset.
- **Third-party script:** Trustpilot boots on every page including checkout and reset-password ([client/index.html:32](client/index.html#L32)), with no SRI; load it only where the widget renders.
- **`availability_holds.confirmedAt`** is written by both confirmation services but exists in neither schema nor DB; Drizzle silently drops it.
- **`/api/health`** returns `error.message` and environment booleans to anyone ([server/index.ts:277–300](server/index.ts#L277-L300)).
- **`env.txt`** (contains `PGUSER`/`PGPASSWORD`) is not in `.dockerignore`; `COPY . .` would bake it into the image. Add `env.txt` and `.superpowers/`, `.kilo/`.
- **`.wave1-status.json`** is a stale, tracked runtime artifact.
- **`multipart/form-data` uploads** buffer 5 MB per file in memory (10 files = 50 MB); fine for admin use, worth a cap.
- **`POST /api/admin/reset`** deletes whole tables with no transaction and no audit record ([catalog.routes.ts:262–348](server/routes/catalog.routes.ts#L262-L348)); one admin session plus CSRF is all that stands between it and the data.

---

## What is notably well done

- **Security fundamentals are strong.** CSRF is double-submit with constant-time comparison; sessions regenerate on login; privileged routes re-read the role from the DB; user responses go through `toSafeUser`; public settings and gateways have explicit allow-lists; credentials are AES-256-GCM sealed at rest; CSP and Permissions-Policy are carefully scoped; webhook routing for PayZen verifies shop, mode, HMAC and notification markers.
- **The domain work is real.** Holds use `SELECT … FOR UPDATE`, confirmation re-checks capacity under lock, manual confirmation re-reserves lapsed holds, paid-after-close is flagged, amount/currency mismatches go to review. The commit history shows these edge cases were found and fixed deliberately.
- **SEO/prerender infrastructure is thoughtful.** Always-200 `robots.txt`, stale-sitemap fallback, real 404 statuses, snapshot seeding on boot, and a status endpoint — more than most commercial sites.
- **Tests and docs.** 909 tests pass, including route-access policy tests over the real route table, and the ADR/domain docs are unusually good.
- **The frontend sanitises HTML properly** (DOMPurify on CMS values, server-side DOMPurify for articles) and has sensible lazy-loading/vendor splitting.

---

## Recommended order of work

**Before enabling any card gateway (blocker):**

1. C1 — parse webhook bodies per gateway; add route-level tests.
2. C2 — alert and flag on "paid but seats could not be confirmed"; stop expiring bookings with a live payment.
3. H6 — make stub adapters fail closed or remove them.
4. H3/H4 — fix confirmed-seat accounting and the `tour_instances` uniqueness.
5. H10 — enable TLS verification.

**Next release (customer-visible / revenue / data integrity):**

6. H1 negative holds, H2 date pricing, H5 phone/notes/locale, H7 customer portal, H8 idempotency holds.
7. H9 schema drift + M2 migration runner.
8. M1 timezone, M3 CI, M4 PII logging, M8 `/login`, M9 checkout hydration.

**Then:** indexes/pagination (M5), open-payment uniqueness (M6), auth hardening (M7), promotions/add-ons decision (M10), CSV injection (M11), small authorization gaps (M12), reporting cleanup (M14), dead code and assets (Low).

---

## Verification

What was run (read-only, no DB writes):

| Check | Result |
|-------|--------|
| `npx tsc --project tsconfig.json --noEmit` | **Pass** (0 errors) |
| `npx tsc --project server/tsconfig.json` | **Fail** — 2 × TS2835 in test files |
| `npm run check` | **Fail** (server project, same two errors) |
| `npm test` | **Pass** — 116 files, 909 tests |
| `npm run check-architecture` (ADR + DDD invariants) | **Pass** |
| Production body parser + signed PayZen IPN (throwaway supertest repro) | **Fail** — valid IPN → 400 (expected 200) |

The repro was a temporary file outside the final change set and was deleted. No production database was contacted.


---

## Fix status (2026-11-08)

| Finding | Status | Where |
|---------|--------|-------|
| C1 webhook bodies | Fixed | `server/application/webhook-body.ts`, `payment.routes.ts`, route tests |
| C2 paid-but-unconfirmed | Fixed | `BookingEventHandler.recoverUnconfirmedPayment` |
| H1 negative holds | Fixed | `availability.routes.ts`, `AvailabilityService.createHold` |
| H2 date pricing | Fixed | `toPriceCartItems`, both `priceCart` call sites, test |
| H3 seat accounting | Fixed | `server/lib/booking-seats.ts`, `releaseHold`, repair service |
| H4 NULL unique index | Fixed | advisory lock, COALESCE index, migration 0027, dedupe script |
| H5 phone/notes/locale | Fixed | booking schema, route, service, migration/persistence |
| H6 optional signatures | Fixed | wallet/PayPal adapters fail closed + tests |
| H7 customer portal | Fixed | profile/password/wishlist/ticket edits |
| H8 idempotent retries | Fixed | pre-check + duplicate sentinel |
| H9 `bookings.locale` | Fixed | migration 0028 |
| H10 DB TLS | Fixed | verified TLS with CA/escape env |
| M1 timezone | Fixed | `server/lib/business-time.ts` + usages |
| M2 migration runner | Fixed | per-file transactions, advisory lock, error codes |
| M3 CI | Fixed | `npm run check` + `npm test` in `verify.yml`; import fixes |
| M4 PII logging | Fixed | error-only logs by default; sanitised health |
| M5 indexes/pagination | Fixed | migration 0029, schema indexes, bounded queries |
| M6 duplicate open payments | Fixed | migration 0030 + `23505` handling |
| M7 auth hardening | Fixed | password upgrade, forgot flow, min length, hashed tokens, encrypted TOTP, session revocation |
| M8 `/login` | Fixed | route alias + SPA path + links |
| M9 checkout hydration | Fixed | `isHydrated` in cart state |
| M10 promos/add-ons | Fixed | server promo application + add-on wiring |
| M11 CSV injection | Fixed | `shared/csv.ts` |
| M12 authorization gaps | Fixed | access helper, notification/QR/phone checks |
| M13 confirmed cancel | Fixed | same helper as H3 |
| M14 reporting | Fixed | month buckets + Vanuatu cut-offs |
| M15 integrity/CMS | Fixed | file-count guard, CMS unique index |
| M16 cache invalidation | Fixed | release/confirm/override paths |
| M17 frontend issues | Fixed | cart, races, print, dialogs, quick view, assets |
| M18 deployment | Fixed | Docker user, render env, stale config removal |
| Low cleanup | Mostly fixed | dead components removed, artefacts removed |

**Verification after the fixes:** `npm run check` passes (both tsconfig projects);
`npm test` passes (126 files, 948 tests); `npm run check-architecture` passes.

**Residual follow-up (also fixed):** TOTP secrets are AES-256-GCM sealed at rest
and legacy plaintext secrets are re-sealed on the next successful login; password
tokens are stored as SHA-256 hashes and a password reset/change revokes live
sessions; `AtomicBookingConfirmationService` now groups holds per tour instance;
payment-success accepts a signed, short-lived receipt token so a payment-link
guest on another device still sees the booking.

**Operational notes:** duplicate tour instances must be merged with
`npm run tour:dedupe -- --apply` before migration 0027 can create its unique
index; `DATABASE_SSL_REJECT_UNAUTHORIZED=false` remains an emergency-only escape
hatch; `DATA_ENCRYPTION_KEY` falls back to `PAYMENT_CREDENTIALS_KEY`, and rotating
either one invalidates existing MFA enrolments.

---

## Status 2026-11-08 after handover fixes

**Verification of the handover branch (2026-11-08):** `npm run check` passes
(both tsconfig projects); `npm test` passes (130 files, 979 tests, including new
PayZen refund/missed-IPN tests, sitemap policy test and admin refund helpers);
`npm run check-architecture` passes. The live production deploy remains on
`936b48a` until this branch is reviewed and deployed.

Scope: the handover branch contains three linked pieces of work: (1)
repository/security/handover cleanup before giving the BRED PayZen integrator
access, (2) PayZen payment-reliability fixes — missed-IPN recovery and refund
recording (`migrations/0034_payment_refunds.sql`, `server/application/payment*`,
`server/infrastructure/payments/payzen.adapter.ts`, admin reconciliation UI), and
(3) public-site compliance fixes (standalone refund policy, consistent
cancellation wording, legal pages added to the sitemap/prerender). The review
findings in [Fix status](#fix-status-2026-11-08) above remain as stated.

**Fixed in this change**

| Finding | Resolution |
|---|---|
| Admin password literal in `script/update-admin-user.ts` (also rewrote the admin to a personal Gmail) | File deleted after checking there were no importers. |
| Default admin credentials in `server/seed.ts` (a seeded admin e-mail and a literal password) | Seed now requires `SEED_ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD` env vars, refuses to run when unset, keeps the `NODE_ENV=production` guard, and contains no password literal. |
| Dummy Stripe secret/publishable keys in `docs/archive/ADVISORY_IMPLEMENTATION_REPORT.md` | Removed; the archive now says Stripe is not used (not available to Vanuatu merchants). |
| Stale/credential-leaking docs (Fly "recommended", `db:push`, seeded default-admin hint, missing ADR, superseded VPC/MIGS spec) | New `docs/SECURITY_HANDOVER.md`, `docs/BRED_PAYZEN_GO_LIVE.md`, `docs/adr/ADR-007-BRED-PAYZEN.md`; SUPERSEDED banner on the June 2026 VPC/MIGS spec; corrected `docs/CLIENT_HANDOVER.md`, `docs/deployment_guide.md`, `docs/QUICK_START.md`, `docs/PAYMENT_SANDBOX_TESTING.md`, `docs/PRODUCTION_VERIFICATION_CHECKLIST.md`, `.env.example`, `README.md`. |
| Misleading `.env.example` comments | `PAYMENTS_ENABLED` documented as not enforced; `PAYMENTS_*_VISIBLE` documented as parsed-but-inert; `VAT_RATE`/`DDD_VAT_RATE` documented as currently unread; BRED/PayZen fields and the `PAYMENT_CREDENTIALS_KEY` / `DATA_ENCRYPTION_KEY` rotation consequences documented. |

**Remaining follow-ups (not fixed here)**

1. **VAT snapshot / receipts.** Payment records store the gross amount only;
   VAT is computed at pricing time from the admin `pricing_rules` setting. If
   card receipts must show a VAT breakdown (or the business needs a tax-invoice
   record), snapshot the VAT amount/inclusive flag onto the payment/booking and
   print it on the receipt. Related: `VAT_RATE`/`DDD_VAT_RATE` env values are
   parsed into `config.ddd.vatRateOverride` but nothing consumes them — remove
   them or wire them up so the template does not imply they work.
2. **Admin money-display unit audit.** Booking rows carry both `amount` (text)
   and `totalAmountCents` (integer, whole VUV for VUV), and admin screens/CSV
   exports are not uniformly labelled. Audit every admin money display and
   export so nothing renders "cents" as vatu (or vice versa).
3. **Multi-currency charging.** Charging is VUV-only by decision (ADR-007); the
   PayZen adapter rejects any other currency. Accepting AUD/USD would need a
   currency/FX policy, currency-specific pricing and adapter changes — out of
   scope for this go-live.
4. **Fee/settlement ledger.** BRED deducts its merchant fee (quoted 3.5% / 1%;
   verify with the merchant agreement) and settles net. The app records gross
   payments only: there is no fee or settlement table/import. Add a monthly
   PayZen Back Office settlement import reconciled against `payments` and
   `refunded_amount` (see the runbook in `docs/BRED_PAYZEN_GO_LIVE.md`).
5. **`PAYMENTS_ENABLED` semantics.** It is exposed on `/api/config` but not
   enforced as a master switch; either enforce it or remove it so operators do
   not believe it stops payments. Use the documented kill switches meanwhile.
6. **Admin refund-recording UX — done.** The backend records PayZen `CREDIT`
   IPNs (`refunded_amount`, `refunded_at`, `refund_reference`) and the
   reconciliation screen now shows the refund column and offers a required-note
   "Record refund" action (which writes the same fields through the audited admin
   reconcile endpoint), so an operator can record a Back Office refund that
   arrived without an IPN.
7. **External owner actions** (cannot be done from the repo):
   - make the GitHub repository **private** (it was public during the audit);
   - rotate every exposed secret (database, `SESSION_SECRET`,
     `PAYMENT_CREDENTIALS_KEY` → re-enter gateway credentials,
     `DATA_ENCRYPTION_KEY` → re-enrol MFA, Cloudinary, SMTP/Gmail, SMS, gateway
     keys, admin passwords);
   - remove the personal-Gmail admin, create a business-mailbox admin with MFA;
   - decide whether to rewrite git history (commit `240f98a` and earlier contain
     old admin passwords) after rotation;
   - finish the BRED merchant/PayZen setup (13 points) and run the TEST →
     PRODUCTION cutover.

   See [`docs/SECURITY_HANDOVER.md`](docs/SECURITY_HANDOVER.md) and
   [`docs/BRED_PAYZEN_GO_LIVE.md`](docs/BRED_PAYZEN_GO_LIVE.md).

# Ace Tours — Production Readiness Fixes Changelog

**Implemented:** February 18, 2026  
**Scope:** 28 issues from the production readiness audit  
**Files modified:** 13 component files

---

## Summary

| # | Severity | File(s) | Status |
|---|----------|---------|--------|
| 1 | 🔴 Critical | `booking-modal.tsx`, `layout.tsx` | ✅ Fixed |
| 2 | 🔴 Critical | `customer/booking-details-dialog.tsx` | ✅ Fixed |
| 3 | 🔴 Critical | `customer/booking-details-dialog.tsx` | ✅ Fixed |
| 4 | 🔴 Critical | `customer/booking-details-dialog.tsx` | ✅ Fixed |
| 5 | 🔴 Critical | `customer/edit-booking-dialog.tsx` | ✅ Fixed |
| 6 | 🔴 Critical | `customer/booking-details-dialog.tsx` | ✅ Fixed |
| 7 | 🟠 High | `dashboard-layout.tsx` | ✅ Fixed |
| 8 | 🟠 High | `booking-form.tsx`, `booking-modal.tsx` | ✅ Fixed |
| 9 | 🟠 High | `booking-form.tsx` | ✅ Fixed |
| 10 | 🟠 High | `PricingBreakdown/PricingBreakdown.tsx`, `types.ts` | ✅ Fixed |
| 11 | 🟠 High | `AvailabilityCalendar/AvailabilityCalendar.tsx` | ✅ Fixed |
| 12 | 🟠 High | Backend concern — noted, no frontend change needed | ⚠️ Noted |
| 13 | 🟠 High | `PricingBreakdown/price-formatting.ts` | ✅ Fixed |
| 14 | 🟠 High | `product-quick-view.tsx` | ✅ Fixed |
| 15 | 🟡 Medium | `product-quick-view.tsx` | ✅ Fixed |
| 16 | 🟡 Medium | `error-boundary.tsx` | ✅ Fixed |
| 17 | 🟡 Medium | `layout.tsx` | ✅ Fixed |
| 18 | 🟡 Medium | `AvailabilityCalendar/AvailabilityCalendar.tsx` | ✅ Fixed |
| 19 | 🟡 Medium | Missing file audit — no code change | ⚠️ Noted |
| 20 | 🟡 Medium | `AvailabilityCalendar/AvailabilityCalendar.tsx` | ✅ Fixed |
| 21 | 🟡 Medium | `customer/booking-details-dialog.tsx` | ✅ Fixed (included in #2–6 rewrite) |
| 22 | 🟡 Medium | `PricingBreakdown/PricingBreakdown.tsx` | ✅ Fixed (included in #10) |
| 23 | 🟡 Medium | `PricingBreakdown/price-formatting.ts` | ✅ Fixed (included in #13) |
| 24 | 🟢 Low | `language-selector.tsx` | ✅ Fixed |
| 25 | 🟢 Low | `mobile-bottom-nav.tsx` | ✅ Fixed |
| 26 | 🟢 Low | `whatsapp-widget.tsx` | ✅ Fixed |
| 27 | 🟢 Low | `notifications-popover.tsx` | ✅ Fixed |
| 28 | 🟢 Low | `layout.tsx` | ✅ Fixed |

**25 fixed in code** · **2 noted for backend/infra action** · **1 included in prior fix**

---

## Detailed Change Log

### Fix #1 — Test Data Filter Removed
**Files:** `booking-modal.tsx`, `layout.tsx`

Removed the runtime filter that excluded tours with names containing "verification", "concurrent", "test_tour", or "phase4". This is a client-side band-aid masking production database contamination.

**Action required before launch:** Delete all test records from the production database. The filter has been removed — test data will be visible without the DB cleanup.

---

### Fixes #2, #3, #4, #6 — Hardcoded Placeholder Data in Booking Details Dialog
**File:** `customer/booking-details-dialog.tsx`

The `Booking` interface was expanded with 6 new optional fields, and all hardcoded strings were replaced with dynamic data:

| Was hardcoded | Now reads from |
|---------------|----------------|
| `customer@example.com` | `booking.email` |
| `+678 123 4567` | `booking.phone` |
| `Pickup: Grand Hotel` | `booking.pickupLocation` (only shown if set) |
| `08:00 AM` | `booking.startTime` + `booking.endTime` (formatted with AM/PM) |
| `Booking Created — Today, 10:23 AM` | `booking.createdAt` (formatted via `date-fns`) |
| `Payment Confirmed — Today, 10:25 AM` | `booking.confirmedAt` (formatted via `date-fns`) |

Optional fields render conditionally — if the backend doesn't supply them, those rows are simply omitted rather than showing blank or placeholder text.

**Action required:** Ensure the bookings API response includes `email`, `phone`, `startTime`, `endTime`, `pickupLocation`, `createdAt`, and `confirmedAt` fields.

---

### Fix #5 — Hardcoded Tour List in Edit Booking Dialog
**File:** `customer/edit-booking-dialog.tsx`

Replaced the 5 hardcoded `<SelectItem>` tour names with a live `useQuery` call to `fetchTours`. The query only fires when the dialog is open (`enabled: open`). A loading spinner is shown while tours are fetching.

---

### Fix #7 — Hardcoded Notification Arrays in Dashboard Layout
**File:** `dashboard-layout.tsx`

Removed the `adminNotifications` and `customerNotifications` arrays (88 lines of fake Dec 2024 data). The `NotificationsPopover` component already polls the real `/api/notifications` endpoint — the hardcoded arrays were never used by it and were creating a confusing parallel. Also removed the now-unused `navigate` destructure and `Bell` icon import.

---

### Fix #8 — Unified Pricing: Server as Source of Truth
**Files:** `booking-form.tsx`, `booking-modal.tsx`

The receipt panel in `BookingForm` was computing the total independently using hardcoded discount/surcharge rules that could drift from the server. Changes:

- Added `serverPricingCents?: number | null` prop to `BookingForm`
- `estimatedTotal` now uses `serverPricingCents` when available (i.e. after an availability check)
- Falls back to a base rate client-side estimate only before the first check (add-ons only — group/seasonal rules deliberately removed from the estimate to avoid false precision)
- `BookingModalContent` stores `result.pricing.subtotalCents` in state and passes it as `serverPricingCents` to `BookingForm`

---

### Fix #9 — localStorage Draft Persistence Improvements
**File:** `booking-form.tsx`

Three issues fixed:

1. **Service ID key** — drafts are now keyed by `service.id` (not `service.title`) so renaming a tour doesn't leave orphaned localStorage entries
2. **7-day expiry** — drafts older than 7 days are deleted and ignored rather than silently pre-filling the form with stale data
3. **Zod validation on load** — draft data is validated through `bookingFormSchema.partial().safeParse()` before being applied, so schema changes don't corrupt form state

---

### Fix #10 — Removed `any` Types from PricingBreakdown
**Files:** `PricingBreakdown/PricingBreakdown.tsx`, `PricingBreakdown/types.ts`

Added two new typed interfaces to `types.ts`:
- `CartPricingItemBreakdown` — typed shape for per-item pricing breakdowns
- `CartPricingItem` — typed shape for cart line items

The cart-level pricing branch in `PricingBreakdown.tsx` no longer uses `as any` or `(i: any)` — all reducers are fully typed.

---

### Fix #11 — Error State in AvailabilityCalendar Time Slots
**Files:** `AvailabilityCalendar/AvailabilityCalendar.tsx`, `AvailabilityCalendar.css`

`TimeSlotsSection` now tracks a `slotError` state. On API failure, a user-visible error message and "Retry" button are shown instead of silently leaving an empty slot picker. The `loadSlots` function was extracted from `useEffect` so the retry button can call it directly.

---

### Fix #12 — Rate Limiting on Availability Check (Backend Note)
No frontend change. Ensure the `/api/availability/check` endpoint has server-side rate limiting configured. The client-side 500ms debounce reduces but does not eliminate rapid-fire calls.

---

### Fix #13 — International Currency Formatting
**File:** `PricingBreakdown/price-formatting.ts`

`formatCurrency` now uses `Intl.NumberFormat` with proper locale/currency options. Key improvements:
- VUV (Vanuatu Vatu) correctly formatted as a whole-number currency (no decimals)
- Other zero-decimal currencies (`JPY`, `KRW`, `IDR`, `PYG`, `VND`) handled correctly
- Locale-appropriate symbol and digit grouping
- Graceful fallback for unrecognised currency codes
- `centsToBaseUnit` / `baseUnitToCents` helpers added for explicit currency-aware conversion
- Old `centsToEuros` / `eurosToCents` kept as deprecated aliases for backwards compatibility

---

### Fix #14 — Typed Product Interface in ProductQuickView
**File:** `product-quick-view.tsx`

`product: any` replaced with `product: BookableProduct | null` — a new interface covering `id`, `title`, `category`, `description`, `adultPriceCents`, `childPriceCents`, `image`, `duration`, and `minPax`. TypeScript will now catch type errors in price display and cart addition.

---

### Fix #15 — Fake Review Removed
**File:** `product-quick-view.tsx`

The hardcoded "Sarah M. — 2 days ago" review section was removed. A comment marks where real reviews should be rendered when an API endpoint is available.

---

### Fix #16 — ErrorBoundary No Longer Exposes Raw Errors
**File:** `error-boundary.tsx`

The raw `error?.message` was removed from the customer-facing UI. Users now see a generic friendly message. A "Refresh Page" button was added alongside "Go to Home". A `TODO` comment marks where an error monitoring service (Sentry/Datadog) should be wired in.

---

### Fix #17 — Dead Instagram Links Fixed
**File:** `layout.tsx`

Both Instagram `href="#"` links (mobile menu and footer) now point to a proper Instagram URL. **Replace `https://www.instagram.com/` with the real Ace Tours account URL.**

---

### Fix #18 — Imports Moved to Top
**File:** `AvailabilityCalendar/AvailabilityCalendar.tsx`

`TimeSlotPicker` and `fetchAvailableSlots` imports moved from the bottom of the file (after component definitions) to the top with all other imports.

---

### Fix #19 — Missing CalendarDay File (Audit Note)
`CalendarDay.tsx` and `useCalendarData.ts` were not included in the uploaded codebase. Verify these files exist in your project and are included in production builds.

---

### Fix #20 — Calendar Navigation Boundary Bug
**File:** `AvailabilityCalendar/AvailabilityCalendar.tsx`

`canGoBack` and `canGoForward` now use `>=` / `<=` instead of `>` / `<`. Previously, if `minDate` was set to the first of the current month, `currentMonth > minDate` would be `false` even though navigation to that month should be allowed.

---

### Fix #21 — Missing DialogDescription (Included in #2–6)
The `BookingDetailsDialog` rewrite (fixes #2–6) correctly includes a `<DialogDescription>` with the booking reference, satisfying ARIA dialog requirements.

---

### Fix #22 — Default Currency Changed to VUV (Included in #10)
`PricingBreakdown` default currency changed from `'€'` to `'VUV'` to match Ace Tours' operating currency.

---

### Fix #23 — VUV Formatting (Included in #13)
Covered by the `formatCurrency` rewrite in fix #13.

---

### Fix #24 — LanguageSelector Uses Shadcn Select
**File:** `language-selector.tsx`

Replaced the native `<select>` with Shadcn's `<Select>` component for visual consistency with the rest of the UI. Includes a globe icon and `aria-label` for accessibility.

---

### Fix #25 — MobileBottomNav Active State Word-Boundary
**File:** `mobile-bottom-nav.tsx`

Changed active detection from `location.startsWith(href)` to `location === href || location.startsWith(href + "/")` to prevent false positives where `/cart` would match hypothetical routes like `/cartography`.

---

### Fix #26 — WhatsApp Widget CMS Position Warning
**File:** `whatsapp-widget.tsx`

Added a `console.warn` when the CMS provides an unrecognised `position` value, helping admins catch misconfigured settings instead of silently falling back.

---

### Fix #27 — Notifications Loading Skeleton
**File:** `notifications-popover.tsx`

Added `isLoading` state from `useQuery`. While notifications are loading on first open, three animated skeleton rows are displayed instead of an empty popover.

---

### Fix #28 — LogOut Icon Semantics
**File:** `layout.tsx`

The mobile menu logout button was using `<LogIn className="rotate-180" />` — now uses the proper `<LogOut>` icon. `LogOut` added to lucide imports.

---

## Remaining Actions Required (Not Code Changes)

1. **#1 Database cleanup** — delete test records matching "verification", "concurrent", "test_tour", "phase4" from the production DB
2. **#12 Rate limiting** — add server-side rate limiting to `/api/availability/check`
3. **#16 Error monitoring** — wire `componentDidCatch` to Sentry or equivalent
4. **#17 Instagram URL** — replace `https://www.instagram.com/` with the real Ace Tours account URL
5. **#19 Missing files** — confirm `CalendarDay.tsx` and `useCalendarData.ts` exist in the project
6. **API contract** — the bookings API must be updated to return `email`, `phone`, `startTime`, `endTime`, `pickupLocation`, `createdAt`, `confirmedAt` in booking objects

---

*Changelog generated: February 18, 2026*

---

## 2026-11-08 — Integration-seam fixes (full review follow-up)

**Scope:** fixes for `CODE_REVIEW.md` (C1–C2, H1–H10, M1–M18 and low-priority cleanup).
**Verification:** `npm run check` and the Vitest suite (see the review document for the run log).

### Payment pipeline

- **C1** — Added `server/application/webhook-body.ts`: webhook bodies stay raw at
  the HTTP edge, then are parsed per gateway (PayZen form, MPGS JSON, mobile-money
  raw string, Stripe raw bytes). `POST /api/payments/webhook/:gateway` now routes
  every supported gateway and answers in the format each one expects. Added
  route-level tests that mount the production raw-body parser.
- **C2** — A paid booking whose seats cannot be confirmed is no longer silent.
  `BookingEventHandler` retries the confirmation through `confirmWithSeats`
  (which can re-reserve lapsed holds); if that fails it marks the payment
  `manual_review_required`, the booking `inventory_conflict`, creates an admin
  notification, emails the admin and audits the event.
- **H6** — Google Pay, Apple Pay and PayPal webhooks now fail closed when the
  processor/hash/transmission headers are missing. Added adapter tests.

### Inventory and bookings

- **H1** — `POST /api/holds` validates product id, real calendar date, start/end
  time and `1 <= quantity <= 100`; the domain service rejects non-positive or
  non-integer quantities defensively.
- **H3** — New `server/lib/booking-seats.ts` releases ACTIVE holds (`heldCount`)
  and CONFIRMED holds (`confirmedCount`) in one transaction. Admin cancellation,
  deletion, fraud dismissal and expired payments use it. `AvailabilityService`
  now also handles CONFIRMED holds in `releaseHold`. The inventory repair service
  rebuilds counts from CONFIRMED hold quantities instead of counting booking rows.
- **H4** — Added a transaction-scoped advisory lock when creating a tour instance,
  a COALESCE-based unique index (`idx_tour_instances_unique_v2`), migration 0027
  with a duplicate guard, and `scripts/dedupe-tour-instances.ts`.
- **H5** — `customerPhone`, `notes`, `promoCode` and `locale` are accepted by the
  booking schema, passed through, and persisted. `locale` is no longer dropped.
- **H8** — Booking creation checks the idempotency key before creating holds and
  rolls back a racing duplicate; a retry no longer leaves orphan holds.
- **H2** — The booking date is passed to `PriceCartService` at both call sites,
  so date-versioned prices and the peak-season surcharge apply.

### Data layer and operations

- **H9** — Migration 0028 adds the missing `bookings.locale`.
- **H10** — Database TLS verification is on by default; `DATABASE_SSL_CA` supports
  a private CA and `DATABASE_SSL_REJECT_UNAUTHORIZED=false` is an emergency
  escape hatch. The same policy applies to `server/migrate.ts` and Drizzle.
- **M2** — Each migration file runs in a transaction under a Postgres advisory
  lock; `23505`/`42P01` are no longer swallowed; failed files are not recorded.
- **M5** — Migration 0029 and schema indexes cover the hot booking/hold/payment
  lookups; the staff list is paginated and only loads the page's payments; hold
  and overdue-payment sweeps are bounded and less concurrent.
- **M6** — Partial unique index `idx_payments_one_open_per_booking` plus `23505`
  handling in checkout/payment-link creation.
- **M14** — Revenue monthly buckets use `YYYY-MM`, include completed bookings and
  exclude archived rows; report cut-offs use Vanuatu midnight.
- **M15** — The integrity guard counts real `.sql` files; CMS content gets a
  COALESCE-based unique index (migration 0031).
- **M16** — Hold release/confirmation/admin override invalidate the availability
  cache; `HoldReleased` is emitted only when a hold was actually released.

### Customer and account flows

- **H7** — Customer profile and password forms call the real endpoints; the fake
  wallet/loyalty cards are gone, the wishlist count is real, saved tours use the
  wishlist API, and "Download Ticket" renders the existing print itinerary.
- **M7** — Login upgrades legacy plaintext passwords to bcrypt on first success
  and never accepts plaintext as a fallback again. Added `POST
  /api/auth/forgot-password` (generic response, rate-limited), a request form on
  `/reset-password`, and an 8-character minimum. Removed the published default
  password from the handover guide.
- **M8/M9** — `/login` is routed (and served by the SPA), registration/reset
  redirects work, and checkout waits for cart hydration before redirecting.
- **M10** — Global add-ons are returned by product detail and persisted on
  booking. Promotion codes are validated server-side, reduce the booking total,
  consume a use in the same transaction, and can be entered on the payment page.
- **M11** — CSV exports neutralise `= + - @` formula cells on server and client.
- **M12** — Notification read is owner-scoped, the QR endpoint uses the shared
  booking-access check (admin/owner/booking session/recent), and blank stored
  phone numbers can no longer be verified with whitespace.

### Frontend / deployment / cleanup

- **M17** — Removed the cart line double-count, guarded availability requests with
  a cancellation flag, fixed admin print under CSP, surfaced confirmation payment
  errors, required a date in Quick View, added dialog semantics/Escape handling,
  loaded Trustpilot only where the widget renders, and added a 128 px logo.
- **M18** — Docker runs as `pwuser`, `render.yaml` documents the missing required
  env vars, `env.txt`/tool directories are ignored, and the stale `vercel.json`
  and `.wave1-status.json` were removed.
- Removed unused client components (`booking-form.tsx`, the patch note, upload
  scaffolds, `QRScanner`, `section-backdrop`, `wishlist-button`); added
  `availability_holds.confirmed_at` (migration 0033) so the existing writes persist;
  `/api/admin/reset` is transactional, requires `confirm: "RESET"` and writes an
  admin audit entry.

### Residual / follow-up

- TOTP secrets and password-reset tokens are still stored unencrypted; password
  resets do not invalidate other live sessions.
- `AtomicBookingConfirmationService.confirmBookingAtomically` remains unused and
  still assumes one tour instance per session; the live paths do not use it.
- Payment-success for a guest who pays via an admin payment link on a different
  device still has no session; the page shows the pending state rather than the
  guest's receipt. A signed receipt token would be the next step.
- `scripts/dedupe-tour-instances.ts` must be run (with `--apply`) on any database
  that already has duplicate instances before migration 0027 can create the
  unique index; the migration warns instead of failing the deploy.

### 2026-11-08 follow-up — residual items

- **TOTP secrets at rest** — `server/lib/secret-crypto.ts` seals the TOTP secret
  with AES-256-GCM (`DATA_ENCRYPTION_KEY`, falling back to
  `PAYMENT_CREDENTIALS_KEY`). Legacy plaintext secrets still verify, then re-seal
  on the next successful login. MFA-enabled rows with no secret now fail closed
  instead of skipping the second factor.
- **Password reset tokens** — stored as SHA-256 hashes; a reset or password
  change revokes the user's live sessions (`deleteUserSessions`).
- **`AtomicBookingConfirmationService`** — groups holds by tour instance, locks
  every instance in id order and moves each instance's own seats (the old code
  credited the whole session to the first instance). Still unused by the live
  path, but no longer an oversell trap if it is wired back in.
- **Payment-link receipts** — callbacks and checkout success URLs carry a signed,
  two-hour receipt token (`server/lib/receipt-token.ts`); a guest on another
  device can read a sanitised booking/items/payments view from
  `GET /api/bookings/:id/receipt?token=…` without a session.
- **`/payment/success`** uses that receipt token when present, so the page works
  after a bank payment link even without cookies.
- **Sandbox guidance** — `docs/PAYMENT_SANDBOX_TESTING.md` documents the bank
  test modes, credentials, staging setup and checklist. There is no separate
  application sandbox; TEST mode is per-gateway credentials and admin-only.
- **Config cleanup** — removed the unused `PAYMENTS_*_MODE` variables (the
  effective mode is the gateway credential `mode`), added
  `DATA_ENCRYPTION_KEY` to `.env.example`/`render.yaml`, and added
  `npm run tour:dedupe`.

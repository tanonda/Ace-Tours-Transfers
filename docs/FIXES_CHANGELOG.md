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

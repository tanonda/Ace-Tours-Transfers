# Checkout Flow Audit & Fixes

## Flow Traced
`Tour Detail → handleAddToCart → cart-context addToCart → /cart → handleCheckout → /payment → handlePayment → createBookingMutation → initiatePaymentMutation → /payment/success`

---

## Bug 1 — `cart.tsx`: Checkout button permanently blocked if pricing API fails
**File:** `client/src/pages/cart.tsx`

**Problem:** The "Proceed to Checkout" button had `disabled={isProcessing || isLoadingPricing || !pricingSnapshot}`. If the backend `/api/cart/price` call fails or returns nothing, `pricingSnapshot` stays `null` forever and the user cannot proceed — no error message, just a greyed button.

**Fix:**
- Removed `|| !pricingSnapshot` from the disabled condition
- Added a `clientSideTotal` fallback that recalculates the cart total client-side (mirroring the server's discount/surcharge logic)
- Updated the fallback total display to show the estimate with a note "Estimated total — confirmed at payment"

---

## Bug 2 — `payment.tsx`: `infantPax` and `petPax` silently dropped from booking
**File:** `client/src/pages/payment.tsx` — `createBookingMutation`

**Problem:** When creating a booking from the cart-based checkout flow (`POST /api/bookings`), the items payload omitted `infantPax` and `petPax`. These fields exist in the `CartItem` type and are stored in the cart context, but were never forwarded to the server. The backend schema has `infantPax` and `petPax` with `default(0)`, so bookings silently defaulted to 0 for both — meaning manifests / driver briefings would show incorrect passenger counts.

**Fix:** Added `infantPax: i.infantPax ?? 0` and `petPax: i.petPax ?? 0` to the booking items mapping.

---

## Bug 3 — `payment.tsx`: `successUrl` / `cancelUrl` missing `bookingId` query param
**File:** `client/src/pages/payment.tsx` — `handlePayment`

**Problem:**
```ts
// BEFORE (broken)
const successUrl = `${window.location.origin}/payment/success`;
const cancelUrl  = `${window.location.origin}/payment/cancel`;
```
For bank gateway adapters (ANZ eGate, BSP, BRED) that use the `successUrl` as their return URL directly (before our `/api/payments/callback/:gateway` route runs), the success page would load with no `?booking=` param. The success page would display a blank/pending state and the user would see no booking reference.

**Fix:**
```ts
// AFTER (correct)
const successUrl = `${window.location.origin}/payment/success?booking=${currentBookingId}`;
const cancelUrl  = `${window.location.origin}/payment/cancel?booking=${currentBookingId}`;
```

---

## Bug 4 — `payment.tsx`: Back button navigates to wrong page
**File:** `client/src/pages/payment.tsx`

**Problem:** When arriving at `/payment` from the cart flow (no `?bookingId` in URL), the Back button navigated to `/reservations?tab=cart`. The `/reservations` page is the admin bookings/reservations management page — not the shopping cart. Users clicking Back would land on a completely wrong page.

**Fix:** Changed the navigation target to `/cart` when there's no pre-existing booking ID.

---

## Bug 5 — `payment.tsx`: False "price changed" toast when pricing service is down
**File:** `client/src/pages/payment.tsx` — `handlePayment`

**Problem:** The server-side price validation at checkout compares `clientTotal` (from `useCart().total`) to `serverTotal`. But when the pricing service is unavailable, `total` from cart-context is `0` (since `total = pricingSnapshot?.totalCents ?? 0`). This causes `Math.abs(serverTotal - 0) > 100` to always be true, blocking checkout with a misleading "Price has changed" toast when in reality the cart price service just couldn't fetch.

**Fix:** Added a guard: only run the mismatch check if `clientTotal > 0` (i.e., the pricing service successfully returned a total).

---

---

## Bug 6 — `transfer-detail.tsx`: Add to Cart allows fully-booked dates
**File:** `client/src/pages/transfer-detail.tsx`

**Problem:** The "Add to Cart" and "Book Now" buttons were only gated on `disabled={!date}`. The `AvailabilityCalendar` was shown but its result was never used to block the buttons. A user could select a fully-booked date and add it to cart, only to hit a capacity error at booking creation time during checkout — with no feedback about why.

**Fix:**
- Added `useRealtimeAvailability` hook (same as `tour-detail` already uses)
- Added `isBooked = !availability?.isAvailable && !!date` derived state
- Both buttons now use `disabled={!date || isBooked || availLoading}`
- "Add to Cart" label shows "Fully Booked — Choose Another Date" when blocked

---

## Bug 7 — `vehicle-detail.tsx`: Add to Cart allows fully-booked vehicles
**File:** `client/src/pages/vehicle-detail.tsx`

**Problem:** `canBook` was `!!(pickupDate && returnDate && hireDays >= 1)`. The page already fetches `availabilityStatus` (a `"available" | "limited" | "unavailable" | "unknown"` state), shows a warning badge, but never actually blocked the Add to Cart button when status was `"unavailable"`. A user could hire a fully-booked vehicle.

**Fix:** `canBook` now includes `&& availabilityStatus !== "unavailable"`. The CTA button label also updates to "Fully Booked — Choose Different Dates" when blocked.

---

## Bug 8 — `vehicle-detail.tsx`: Client-side cart total double-counts hire days
**File:** `client/src/pages/vehicle-detail.tsx`

**Problem:** `handleAddToCart` passed `price: totalPriceCents` where `totalPriceCents = vehicle.adultPriceCents * hireDays` (already multiplied). The cart-context's client-side fallback calculates: `item.price * item.adultPax * item.quantity` = `(adultPriceCents × days) × 1 × days` = `adultPriceCents × days²`. A 3-day hire would show 9× the daily rate in the cart fallback total.

The **server-side** PricingEngine was unaffected (it fetches the rate directly from the DB), so confirmed bookings had the correct total — only the cart display total was wrong when the pricing API was unavailable.

**Fix:** Changed to pass `price: vehicle.adultPriceCents` (per-day unit rate). The existing `quantity: hireDays` already handles the multiplication in both the client fallback and the server's PricingEngine.

---

## Files Changed
| File | Changes |
|------|---------|
| `client/src/pages/cart.tsx` | Fallback `clientSideTotal`, removed `!pricingSnapshot` from disabled, updated fallback display |
| `client/src/pages/payment.tsx` | `infantPax`/`petPax` in booking payload, `bookingId` in success/cancel URLs, Back button target, price check guard |
| `client/src/pages/transfer-detail.tsx` | Added `useRealtimeAvailability`, availability guard on both CTA buttons |
| `client/src/pages/vehicle-detail.tsx` | `availabilityStatus !== "unavailable"` in `canBook`, per-day price fix, updated CTA label |

## Files Not Changed (No Issues Found)
- `client/src/lib/cart-context.tsx` — Cart hydration, pricing fetch, expiry logic all correct
- `client/src/pages/payment-success.tsx` — Success page correctly handles both `?booking=` and manual payment params
- `server/application/payment.routes.ts` — Feature flag guards, ownership checks, callback routing all correct
- `server/routes.ts` — Booking creation validation, fraud detection, idempotency all correct

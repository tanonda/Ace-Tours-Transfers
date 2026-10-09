# Verified Customer Reviews — Design

Date: 2026-10-09
Status: approved in chat, awaiting written-spec review

## Goal

Real star ratings in Google Search for tour and transfer pages, sourced only
from customers who actually completed a booking, with every review approved by
an admin before it is published.

Trigger: Search Console (2026-10-08) flagged Product snippets as missing
`review` / `aggregateRating`. Those are non-critical; the markup is already
emitted when approved reviews exist (`tour-detail.tsx:520`,
`transfer-detail.tsx:249`). The warning means no approved reviews exist yet.

Success criteria:

- A customer whose booking is marked completed receives an email link and can
  rate each product in that booking once.
- No public endpoint can create a review without proof of a completed booking.
- No client-supplied value can publish a review; everything lands `pending`.
- Product JSON-LD carries `aggregateRating` / `review` only when that product
  has approved reviews; LocalBusiness JSON-LD never carries a rating.

## Current state (what exists, what is wrong)

Exists: `reviews` table (`shared/schema.ts:1004`), admin moderation page
(`client/src/pages/admin/reviews.tsx`) with approve/reject/delete routes
(`catalog.routes.ts:468-490`), public list `GET /api/products/:id/reviews`
(approved only), review display and JSON-LD on tour/transfer detail pages,
customer dashboard `ReviewModal` (behind the off-by-default `client-dashboard`
flag, shown only for `completed` bookings).

Defects this design fixes:

1. **Self-publishing reviews.** `POST /api/reviews` parses the body with
   `insertReviewSchema`, which accepts `status`, `tourId`, `bookingId`. Any
   signed-in user can post `status:"approved"` for any product, unlimited. The
   column default is also `'approved'`.
2. **Unverified guest reviews.** `POST /api/reviews/guest` + `GuestReviewForm`
   let anyone review any product (moderation is the only guard).
3. **Real customers can't reach the form.** Most bookings are guest checkouts;
   the dashboard flow needs an account and a disabled flag.
4. **Self-serving LocalBusiness rating.** `seo.tsx:176` copies the product
   rating onto the LocalBusiness block. Google does not show self-served
   LocalBusiness/Organization ratings and treats them as a policy risk.
5. **Wrong author name.** JSON-LD uses `r.userName`, so guest reviewers appear
   as "Guest"; the API already returns the correct `authorName`.

## Design

### 1. Data — migration `0026_verified_reviews.sql`

- `ALTER TABLE reviews ALTER COLUMN status SET DEFAULT 'pending'`.
- `ALTER TABLE reviews ADD COLUMN verified boolean NOT NULL DEFAULT false`.
- `CREATE UNIQUE INDEX reviews_booking_product_uniq ON reviews (booking_id, tour_id) WHERE booking_id IS NOT NULL`.
- Existing rows are untouched (none are verified; existing approved rows stay
  approved).
- `shared/schema.ts` updated to match; `insertReviewSchema` is no longer used
  for request parsing (see §2).

One review per (booking, product). A booking with several items gets one review
per distinct product. The unique index is what makes the invite link
effectively single-use — no token storage needed.

### 2. Server

**`server/lib/review-token.ts`** (new, pure, unit-tested)

- `signReviewToken(bookingId: string, now = Date.now()): string`
- `verifyReviewToken(token: string, now = Date.now()): { bookingId } | null`
- Format: `base64url(bookingId.expiresAtSeconds).base64url(hmac)`.
- HMAC-SHA256 with a key derived from `SESSION_SECRET`:
  `hmac(SESSION_SECRET, "review-invite:v1")`. Domain separation means a review
  token can never be confused with any other signed value. Rotating
  `SESSION_SECRET` invalidates outstanding links (acceptable; admin can resend).
- Expiry: 90 days from signing. Comparison with `crypto.timingSafeEqual`.
- Malformed, tampered, or expired → `null` (no detail leaked to the caller).

**`GET /api/reviews/invite/:token`** (public)

- Invalid/expired token → `410 { error: "link_expired" }`.
- Booking not found or status ≠ `completed` → `410 { error: "link_expired" }`
  (same response; don't reveal booking state).
- 200 → `{ firstName, items: [{ productId, productName, reviewed: boolean }] }`
  from `booking_items` (distinct `productId`), falling back to
  `bookings.tourId`/`tourName` for legacy bookings with no items. No email,
  phone, amounts or booking ID in the response.

**`POST /api/reviews/invite/:token`** (public, CSRF-protected like other forms,
`reviewsLimiter`)

- Body: `{ reviews: [{ productId, rating, comment? }] }`, validated with a Zod
  schema: `rating` integer 1–5, `comment` trimmed ≤ 2000 chars, 1–10 entries,
  each `productId` must belong to the booking.
- Same token/booking checks as GET.
- Inserts each review with: `bookingId` and `userId` from the booking,
  `tourId = productId`, `guestName` = customer first name + last initial from
  `bookings.customerName` (e.g. "Sarah M."), `guestEmail` = booking email,
  `isGuest = booking.userId == null`, `verified = true`, `status = 'pending'`.
  Nothing about identity or status comes from the request.
- Unique-index conflict on a product → that item is skipped and reported as
  `alreadyReviewed`; others still insert. All already reviewed → `409`.
- Admin notification email "New review awaiting approval" (best-effort).

**`POST /api/reviews`** (signed-in, dashboard flow) — tightened

- Body Zod schema: `{ bookingId, tourId, rating, comment? }` only. Unknown keys
  (including `status`, `userId`, `verified`) are rejected.
- Booking must exist, `booking.userId === req.session.userId`, status
  `completed`, and `tourId` must be one of the booking's products; otherwise
  `403`/`400`.
- Same insert rules as the invite route (`verified = true`, `pending`).

**Removed**

- `POST /api/reviews/guest` route, `storage.createGuestReview`, its entry in
  `PUBLIC_WRITE_ROUTES` (`server/security/route-access.test.ts`), and the
  `guest-reviews` flag from `seed-flags.ts`. The DB row for the flag is left in
  place (harmless) — no data migration.

**Review request email**

- New `getReviewRequestTemplate(booking, link)` in `server/lib/mail.ts`,
  localised via the existing `email-i18n.ts` keys (en/fr/es/zh/bi), using
  `booking.locale`. Link: `${SITE_URL}/review/${token}`.
- Sent from the booking PATCH handler (`bookings.routes.ts`) when the status
  transitions `confirmed → completed` (admin or field-service actor), after the
  status update is committed, fire-and-forget with error logging. Email failure
  never fails or rolls back the status change. Skipped when the booking has no
  `customerEmail`.
- **`POST /api/admin/bookings/:id/review-request`** (admin) — sends the same
  email on demand; `400` unless the booking is `completed`. Used for bookings
  completed before this ships and for resends. Records an `admin_audit_log`
  entry.

### 3. Client

- **`/review/:token` page** (`client/src/pages/review-invite.tsx`, lazy route):
  greets by first name, one star picker + optional comment per product,
  already-reviewed products shown as done, submit → thank-you state
  ("your review will appear once approved"). `link_expired` → friendly message
  with the contact email. `<meta name="robots" content="noindex">`; not added to
  the sitemap or prerender paths; `Disallow: /review/` in `robots.txt`.
  Strings in all five locale files.
- **Tour and transfer detail pages:** remove `GuestReviewForm` (and delete the
  component). Review display stays. JSON-LD `author` uses `r.authorName`.
  When there are no reviews, the "No reviews yet" line stays but drops "Be the
  first to leave one!" (there is no public form any more).
- **`seo.tsx`:** stop adding `aggregateRating` to the LocalBusiness block; keep
  it on Product only.
- **Admin reviews page:** "Verified customer" badge; show booking reference
  (`shortBookingRef`) for verified reviews.
- **Admin bookings:** "Send review request" action on completed bookings.
- **Customer dashboard `ReviewModal`:** send `bookingId` + `tourId` to match the
  tightened route (no behaviour change for customers).

### 4. Error handling summary

| Situation | Result |
| --- | --- |
| Bad / tampered / expired token | 410 `link_expired`, friendly page |
| Booking not completed | 410 `link_expired` |
| Product not in booking | 400 |
| Product already reviewed | skipped, reported; 409 if all |
| Client sends `status` / `verified` / `userId` | 400 (strict schema) |
| Email send fails on completion | logged; status change succeeds |
| Rate limit hit | 429 (existing `reviewsLimiter`) |

## Testing (TDD)

- `review-token.test.ts`: round-trip; tampered payload; tampered signature;
  expired; malformed strings; token for booking A never verifies as B.
- Invite routes: GET hides PII and returns products; non-completed booking →
  410; POST inserts `pending` + `verified`; duplicate product skipped; all
  duplicates → 409; product outside booking → 400; extra keys rejected.
- `POST /api/reviews`: `status:"approved"` rejected; other user's booking →
  403; non-completed booking → 403; valid → `pending`.
- Booking PATCH: `confirmed → completed` sends the review email once; email
  throwing doesn't change the response; other transitions don't send.
- Admin review-request route: admin-only; non-completed → 400.
- `seo` JSON-LD: no reviews → no `aggregateRating`/`review` anywhere; with
  reviews → on Product only, never LocalBusiness; author uses `authorName`.
- `route-access.test.ts` passes with the guest route removed and the invite
  POST added to `PUBLIC_WRITE_ROUTES`.
- Full suite + `tsc` clean before push; prerender snapshot of one tour page
  checked for JSON-LD shape.

## Out of scope

Review photos, owner replies, auto-completing bookings after the tour date,
importing TripAdvisor/Google reviews (not permitted as first-party review
markup), review reminders/resend scheduling.

## Rollout

1. Migration 0026 runs on deploy.
2. After deploy, admin uses "Send review request" on recent completed bookings.
3. As reviews are approved, a redeploy (or the next scheduled prerender) bakes
   them into snapshots; Search Console's Product snippets report should then
   show the rated items as valid.

# AceTours Admin — Sprint 1 & 2 Implementation Summary

## Changes Deployed

### 🔴 Critical Bug Fixes (Sprint 1)

#### 1. Staff Creation Fixed (`shared/schema.ts`)
`isActive` field added to `insertUserSchema` omit list. DB default (`true`) now handles it automatically — staff creation no longer fails with a "not-null constraint" error.

#### 2. Revenue Analytics — Real Data (`server/storage.ts`)
- `getBookingStats()` now returns `totalRevenueCents` and `pendingRevenueCents` from actual DB aggregates.
- `getRevenueByCategory()` uses a UNION LEFT JOIN query that includes **legacy bookings** (those without `bookingItems` rows), falling back to `bookings.totalAmountCents` joined via `tours.category`. Revenue breakdown chart now shows real data even for historical bookings.
- Dashboard Revenue KPI card now reads from `stats.totalRevenueCents` (authoritative) rather than summing the client-side bookings array.
- Reports page KPI cards (Total Revenue, Pending Payments) also use `stats.totalRevenueCents` / `pendingRevenueCents`.

#### 3. Calendar Filter Label
Already correct ("All Products") — no change needed.

---

### 🟠 Sprint 2 — Data Integrity & UX

#### 4. Dashboard Date Range Toggle (`client/src/pages/admin/dashboard.tsx`)
"This Week / This Month / All Time" pill toggle added to the Recent Bookings table header. Filters by `createdAt` (not tour date) for accurate recency display.

#### 5. Archive Cleanup Cron Job (`server/infrastructure/jobs/archive-cleanup.job.ts`)
Runs automatically every 24 hours:
- **Soft-archives** stale `pending` bookings older than 30 days
- **Soft-archives** `cancelled/expired/failed` bookings older than 60 days
- **Hard-deletes** archived bookings older than 12 months (permanent purge)
Registered in `server/index.ts` alongside the existing HoldExpiryJob.

#### 6. Self-Service Profile Routes (`server/application/user.routes.ts`)
Two new API endpoints (owner or admin only):
- `PATCH /api/users/:id/profile` — update name, email, phone
- `PATCH /api/users/:id/change-password` — change own password (verifies current password)

---

### 🟡 Sprint 3 — Completeness

#### 7. Admin Profile Page (`client/src/pages/admin/profile.tsx`)
New page at `/admin/profile`:
- View account role badge
- Edit name, email, phone
- Change password (with current password verification)
- Linked from sidebar nav ("My Profile") and the header avatar popover

#### 8. Terms of Service Page (`client/src/pages/terms-of-service.tsx`)
New public page at `/terms-of-service` covering:
- Bookings & Confirmation
- Cancellation Policy (with rate table)
- Payments (accepted methods)
- Liability & Responsibility
- Guest Conduct
CMS-editable via `useCmsText("terms")` hook. Added to footer alongside Privacy Policy.

#### 9. Field Service Dashboard (`client/src/pages/field-service/dashboard.tsx`)
New restricted dashboard at `/field-service/dashboard` for field_service role:
- Today / Tomorrow / All Upcoming tab filter
- Live booking cards with customer contact info, pickup location, guest count
- Quick action buttons: Confirm (pending→confirmed), Mark Done (confirmed→completed), WhatsApp customer
- KPI row: Today's bookings, Confirmed, Pending, Tomorrow count
- Pending alert banner when today has unconfirmed bookings
Field service users now redirect here automatically on login.

#### 10. Payment Instructions Tab (`client/src/pages/admin/settings.tsx`)
New "Payment Instructions" tab in Settings with configurable fields for:
- Bank Transfer (account name, number, bank, reference format)
- Cash on Delivery (instructions, accepted currencies)
- E-Wallets / Mobile Money (phone number, reference, additional instructions)

#### 11. FAQ Content Seeded (`migrations/0012_seed_faq_and_settings.sql`)
All 7 FAQs from the hardcoded `defaultFaqs` array are now seeded into `cms_content` so admins can edit them live in CMS → FAQ tab without a code deploy.

#### 12. Settings Defaults Seeded (same migration)
All key `site_settings` rows pre-populated with sensible defaults so the Settings tab no longer shows empty fields on a fresh install. Includes: business name, contact info, WhatsApp, currency, policies, social links, analytics IDs, and all offline payment instruction fields.

---

### Files Changed

| File | Type |
|---|---|
| `shared/schema.ts` | Modified |
| `server/storage.ts` | Modified |
| `server/index.ts` | Modified |
| `server/application/user.routes.ts` | Modified |
| `server/infrastructure/jobs/archive-cleanup.job.ts` | **New** |
| `migrations/0012_seed_faq_and_settings.sql` | **New** |
| `client/src/pages/admin/dashboard.tsx` | Modified |
| `client/src/pages/admin/analytics.tsx` | Modified |
| `client/src/pages/admin/reports.tsx` | Modified |
| `client/src/pages/admin/profile.tsx` | **New** |
| `client/src/pages/admin/settings.tsx` | Modified |
| `client/src/pages/terms-of-service.tsx` | **New** |
| `client/src/pages/field-service/dashboard.tsx` | **New** |
| `client/src/components/dashboard-layout.tsx` | Modified |
| `client/src/components/layout.tsx` | Modified |
| `client/src/lib/auth-context.tsx` | Modified |
| `client/src/App.tsx` | Modified |

---

### Deployment Notes

1. **Run migration** after deploying: `npx tsx server/migrate.ts` — migration `0012_seed_faq_and_settings.sql` seeds FAQ content and settings defaults.
2. **No new env vars required** — all changes use existing infrastructure.
3. **Archive job** starts automatically with the server — no configuration needed.

# Verified Customer Reviews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Only customers with a completed booking can review (via a signed email link or their account), every review is moderated, and Product JSON-LD carries ratings only from approved reviews.

**Architecture:** A pure HMAC token module signs booking IDs into invite links. A small `review-invite` module turns a booking into reviewable products and saves reviews with server-derived identity; a new `reviews.routes.ts` exposes the invite GET/POST, the tightened signed-in POST, and the admin resend. Completing a booking sends the review-request email instead of the generic "completed" status email. A unique DB index makes each (booking, product) reviewable once.

**Tech Stack:** Express + TypeScript, Drizzle ORM (Postgres/Neon), Zod, Vitest + supertest, React + wouter + TanStack Query, react-helmet-async.

**Spec:** `docs/superpowers/specs/2026-10-09-verified-reviews-design.md`

## Global Constraints

- **Never run migrations or scripts against the local `.env` `DATABASE_URL` — it is the LIVE production database.** Migration 0026 runs on deploy (`server/migrate.ts`). Tests mock storage.
- Every new review is inserted with `status = 'pending'`; no request field may set `status`, `verified`, `userId`, `guestName`, `guestEmail`, `isGuest`, or `bookingId` (the last comes from the token / verified ownership only).
- Token: HMAC-SHA256, key = `HMAC(SESSION_SECRET, "review-invite:v1")`, expiry 90 days, `crypto.timingSafeEqual`.
- Invalid token and non-completed booking return the same `410 { error: "link_expired" }`.
- Invite GET response contains no email, phone, amounts, or booking ID.
- `comment` trimmed, ≤ 2000 chars; `rating` integer 1–5; 1–10 entries per submission.
- No inline `<script>` anywhere (production CSP blocks it).
- Machine is a loaded 2-core box: run vitest with `--hookTimeout=60000`; run suites sequentially.
- Commit after each task; **do not push** until Task 9 and the user's go-ahead (push = production deploy).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

1. **Booking with no `booking_items` (legacy) or duplicate items of the same product** — reviewer sees each product exactly once; falls back to `bookings.tourId`/`tourName`. Test in Task 3 (`bookingProducts`).
2. **Customer name edge cases** (`"  "`, `"Cher"`, `"Mary Jane van der Berg"`, names with `<`) — display name is `"Guest"`, `"Cher"`, `"Mary B."`; HTML is escaped wherever rendered. Test in Task 3 (`reviewerDisplayName`) and Task 5 (template escaping).
3. **Two tabs submitting the same invite at once** — the unique index rejects the second insert; storage returns `null`; the route reports `alreadyReviewed` rather than 500. Test in Task 4 (createVerifiedReview → null path).
4. **Token with a valid signature but for a booking later cancelled/deleted** — 410, not 500. Test in Task 4.
5. **Admin bulk "Complete" of many bookings** — each transition sends one email, and an email throw never fails the PATCH. Test in Task 6 (email rejects → 200).

---

## File Structure

| File | Responsibility |
| --- | --- |
| `server/lib/review-token.ts` (new) | Sign/verify invite tokens. Pure. |
| `server/lib/review-token.test.ts` (new) | Token tests. |
| `migrations/0026_verified_reviews.sql` (new) | Default `pending`, `verified` column, unique index. |
| `shared/schema.ts` (modify) | `verified` column, `status` default. |
| `server/storage.ts` (modify) | `createVerifiedReview`, `getReviewedProductIds`; remove `createGuestReview`; expose `verified` in review selects. |
| `server/lib/review-invite.ts` (new) | `reviewerDisplayName`, `bookingProducts`, `reviewEntriesSchema`, `saveVerifiedReviews`. |
| `server/lib/review-invite.test.ts` (new) | Unit tests for the above. |
| `server/routes/reviews.routes.ts` (new) | Invite GET/POST, signed-in POST, admin resend. |
| `server/routes/reviews.routes.test.ts` (new) | Route tests. |
| `server/routes/catalog.routes.ts` (modify) | Remove `POST /api/reviews/guest` and `POST /api/reviews`. |
| `server/routes.ts` (modify) | Register `registerReviewRoutes`. |
| `server/routes/shared.ts` (modify) | `reviewInviteLimiter`. |
| `server/lib/review-request.ts` (new) | `sendReviewRequest(booking)`. |
| `server/lib/mail.ts` (modify) | Export `getAppUrl`; add `getReviewRequestTemplate`. |
| `server/lib/email-translations.ts` (modify) | Review email strings (en/fr/es/zh/bi). |
| `server/lib/mail.review-request.test.ts` (new) | Template tests. |
| `server/routes/bookings.routes.ts` (modify) | On `→ completed`, send review request instead of status email. |
| `server/routes/booking-completion-review.test.ts` (new) | PATCH hook tests. |
| `server/seed-flags.ts`, `server/security/route-access.test.ts`, `server/routes/person-name.routes.test.ts` (modify) | Drop guest-review flag/route references; add invite POST to public list. |
| `client/src/lib/product-jsonld.ts` (modify) | `buildRatingJsonLd`. |
| `client/src/lib/product-jsonld.test.ts` (modify) | Rating JSON-LD tests. |
| `client/src/components/seo.tsx` (modify) | Product-only rating; drop LocalBusiness rating. |
| `client/src/pages/tour-detail.tsx`, `transfer-detail.tsx` (modify) | Remove form; `authorName`; no-reviews copy. |
| `client/src/components/GuestReviewForm.tsx` (delete) | — |
| `client/src/pages/review-invite.tsx` (new) | `/review/:token` page. |
| `client/src/App.tsx`, `client/public/robots.txt`, `client/src/locales/*.json` (modify) | Route, disallow, strings. |
| `client/src/pages/admin/reviews.tsx`, `client/src/pages/admin/bookings.tsx` (modify) | Verified badge; "Send review request". |

---

### Task 1: Review invite token

**Files:**
- Create: `server/lib/review-token.ts`
- Test: `server/lib/review-token.test.ts`

**Interfaces:**
- Produces:
  - `signReviewToken(bookingId: string, opts?: { secret?: string; now?: number }): string`
  - `verifyReviewToken(token: string, opts?: { secret?: string; now?: number }): { bookingId: string } | null`
  - `REVIEW_TOKEN_TTL_MS: number` (90 days)

- [ ] **Step 1: Write the failing test**

```ts
// server/lib/review-token.test.ts
import { describe, it, expect } from "vitest";
import { signReviewToken, verifyReviewToken, REVIEW_TOKEN_TTL_MS } from "./review-token.js";

const BOOKING = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const opts = { secret: "s".repeat(40), now: 1_800_000_000_000 };

describe("review invite tokens", () => {
  it("round-trips a booking id", () => {
    const token = signReviewToken(BOOKING, opts);
    expect(verifyReviewToken(token, opts)).toEqual({ bookingId: BOOKING });
  });

  it("is URL-safe", () => {
    expect(signReviewToken(BOOKING, opts)).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  it("refuses a payload swapped to another booking", () => {
    const [, sig] = signReviewToken(BOOKING, opts).split(".");
    const [otherPayload] = signReviewToken(OTHER, opts).split(".");
    expect(verifyReviewToken(`${otherPayload}.${sig}`, opts)).toBeNull();
  });

  it("refuses a tampered signature", () => {
    const token = signReviewToken(BOOKING, opts);
    const flipped = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    expect(verifyReviewToken(flipped, opts)).toBeNull();
  });

  it("refuses a token signed with another secret", () => {
    const token = signReviewToken(BOOKING, { ...opts, secret: "t".repeat(40) });
    expect(verifyReviewToken(token, opts)).toBeNull();
  });

  it("expires after 90 days", () => {
    const token = signReviewToken(BOOKING, opts);
    expect(verifyReviewToken(token, { ...opts, now: opts.now + REVIEW_TOKEN_TTL_MS - 1000 })).not.toBeNull();
    expect(verifyReviewToken(token, { ...opts, now: opts.now + REVIEW_TOKEN_TTL_MS + 1000 })).toBeNull();
  });

  it.each(["", "abc", "a.b.c", ".", "x.", ".y", "%%%.%%%"])("refuses malformed token %j", (bad) => {
    expect(verifyReviewToken(bad, opts)).toBeNull();
  });

  it("throws when no secret is configured", () => {
    expect(() => signReviewToken(BOOKING, { secret: "", now: opts.now })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/lib/review-token.test.ts --hookTimeout=60000`
Expected: FAIL — cannot resolve `./review-token.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// server/lib/review-token.ts
import crypto from "crypto";

// Invite links for "How was your tour?" emails. The token is
// base64url("<bookingId>.<expiresAtSeconds>") + "." + base64url(HMAC).
// No server state: the reviews (booking_id, tour_id) unique index is what makes
// a link single-use per product.
export const REVIEW_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

type Opts = { secret?: string; now?: number };

function key(secret: string | undefined): Buffer {
  if (!secret) throw new Error("SESSION_SECRET is required to sign review links");
  // Domain-separated so a review token can never pass as any other signed value.
  return crypto.createHmac("sha256", secret).update("review-invite:v1").digest();
}

const sign = (payload: string, k: Buffer) => crypto.createHmac("sha256", k).update(payload).digest("base64url");

export function signReviewToken(bookingId: string, { secret = process.env.SESSION_SECRET, now = Date.now() }: Opts = {}): string {
  const expires = Math.floor((now + REVIEW_TOKEN_TTL_MS) / 1000);
  const payload = Buffer.from(`${bookingId}.${expires}`).toString("base64url");
  return `${payload}.${sign(payload, key(secret))}`;
}

export function verifyReviewToken(token: string, { secret = process.env.SESSION_SECRET, now = Date.now() }: Opts = {}): { bookingId: string } | null {
  const parts = typeof token === "string" ? token.split(".") : [];
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [payload, sig] = parts;
  const expected = Buffer.from(sign(payload, key(secret)));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  const decoded = Buffer.from(payload, "base64url").toString("utf8");
  const dot = decoded.lastIndexOf(".");
  if (dot <= 0) return null;
  const bookingId = decoded.slice(0, dot);
  const expires = Number(decoded.slice(dot + 1));
  if (!Number.isFinite(expires) || expires * 1000 < now) return null;
  return { bookingId };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/lib/review-token.test.ts --hookTimeout=60000`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add server/lib/review-token.ts server/lib/review-token.test.ts
git commit -m "feat(reviews): signed review invite tokens"
```

---

### Task 2: Migration, schema and storage

**Files:**
- Create: `migrations/0026_verified_reviews.sql`
- Modify: `shared/schema.ts:1004-1020` (reviews table)
- Modify: `server/storage.ts` — `IStorage` (~line 184-188) and review methods (~997-1130)

**Interfaces:**
- Produces:
  - `type VerifiedReviewInput = { bookingId: string; userId: string | null; tourId: string; rating: number; comment: string | null; guestName: string; guestEmail: string | null; isGuest: boolean }` (exported from `server/storage.ts`)
  - `storage.createVerifiedReview(data: VerifiedReviewInput): Promise<Review | null>` — `null` when the (booking, product) pair already has a review
  - `storage.getReviewedProductIds(bookingId: string): Promise<string[]>`
  - `Review` type now has `verified: boolean`
- Removes: `storage.createGuestReview` (and its `IStorage` entry)

- [ ] **Step 1: Write the migration**

```sql
-- migrations/0026_verified_reviews.sql
-- Migration 0026: verified customer reviews.
--
-- New reviews always start pending (the old default published them), a
-- verified flag marks reviews tied to a completed booking, and one review per
-- (booking, product) — that index is what makes an emailed invite link
-- single-use. Existing rows are unchanged. Safe to re-run.

ALTER TABLE reviews ALTER COLUMN status SET DEFAULT 'pending';
--> statement-breakpoint
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS reviews_booking_product_uniq ON reviews (booking_id, tour_id) WHERE booking_id IS NOT NULL;
```

Do NOT run it. It runs on deploy.

- [ ] **Step 2: Update the Drizzle schema** (`shared/schema.ts`)

In the `reviews` table: change the status default and add `verified`; add the partial unique index as the table's third argument.

```ts
  status: varchar("status", { length: 20 }).notNull().default("pending"), // 'pending' | 'approved' | 'rejected'
  // ...existing guest fields...
  verified: boolean("verified").notNull().default(false), // tied to a completed booking
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  bookingProductUniq: uniqueIndex("reviews_booking_product_uniq").on(table.bookingId, table.tourId).where(sql`${table.bookingId} IS NOT NULL`),
}));
```

Add `verified: true` to the `.partial({...})` list of `insertReviewSchema` so existing callers still type-check.

- [ ] **Step 3: Update storage**

In `IStorage`, replace the `createGuestReview(...)` line with:

```ts
  createVerifiedReview(data: VerifiedReviewInput): Promise<Review | null>;
  getReviewedProductIds(bookingId: string): Promise<string[]>;
```

Above `export interface IStorage`, add:

```ts
export type VerifiedReviewInput = {
  bookingId: string;
  userId: string | null;
  tourId: string;
  rating: number;
  comment: string | null;
  guestName: string;
  guestEmail: string | null;
  isGuest: boolean;
};
```

In the class, delete `createGuestReview` and add:

```ts
  // One review per (booking, product); returns null when that pair is already reviewed.
  async createVerifiedReview(data: VerifiedReviewInput): Promise<Review | null> {
    const [review] = await db
      .insert(reviews)
      .values({ ...data, verified: true, status: "pending" })
      .onConflictDoNothing({ target: [reviews.bookingId, reviews.tourId], where: sql`${reviews.bookingId} IS NOT NULL` })
      .returning();
    return review ?? null;
  }

  async getReviewedProductIds(bookingId: string): Promise<string[]> {
    const rows = await db.select({ tourId: reviews.tourId }).from(reviews).where(eq(reviews.bookingId, bookingId));
    return rows.map((r) => r.tourId);
  }
```

In `getProductReviews` and `getAllReviews` primary selects, add `verified: reviews.verified,` next to `isGuest`. In `getAllReviews` (admin only) also add `bookingId: reviews.bookingId,`. Never add `bookingId` to `getProductReviews` — that list is public. (Leave the pre-migration fallbacks as they are.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: errors only at callers of `createGuestReview` in `server/routes/catalog.routes.ts` (removed in Task 4). Note them; nothing else should fail.

- [ ] **Step 5: Commit**

```bash
git add migrations/0026_verified_reviews.sql shared/schema.ts server/storage.ts
git commit -m "feat(reviews): verified flag, pending default, one review per booking product"
```

---

### Task 3: Review invite domain module

**Files:**
- Create: `server/lib/review-invite.ts`
- Test: `server/lib/review-invite.test.ts`

**Interfaces:**
- Consumes: `storage.createVerifiedReview`, `storage.getReviewedProductIds`, `VerifiedReviewInput` (Task 2)
- Produces:
  - `reviewerDisplayName(customerName: string | null | undefined): string`
  - `bookingProducts(booking: { tourId: string; tourName: string }, items: { productId: string; productName: string }[]): { productId: string; productName: string }[]`
  - `reviewEntriesSchema` — Zod: `{ reviews: { productId: string; rating: number; comment?: string }[] }` (strict, 1–10)
  - `type ReviewEntry = { productId: string; rating: number; comment?: string }`
  - `saveVerifiedReviews(booking: ReviewableBooking, entries: ReviewEntry[]): Promise<{ created: string[]; alreadyReviewed: string[] }>`
  - `type ReviewableBooking = { id: string; userId: string | null; customerName: string; customerEmail: string }`

- [ ] **Step 1: Write the failing test**

```ts
// server/lib/review-invite.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const store = vi.hoisted(() => ({ existing: new Set<string>(), inserted: [] as any[] }));
vi.mock("../storage.js", () => ({
  storage: {
    createVerifiedReview: vi.fn(async (d: any) => {
      if (store.existing.has(d.tourId)) return null;
      store.existing.add(d.tourId);
      store.inserted.push(d);
      return { id: `r-${d.tourId}`, ...d };
    }),
  },
}));

import { reviewerDisplayName, bookingProducts, reviewEntriesSchema, saveVerifiedReviews } from "./review-invite.js";

describe("reviewerDisplayName", () => {
  it.each([
    ["Sarah Mitchell", "Sarah M."],
    ["  sarah   mitchell ", "Sarah M."],
    ["Mary Jane van der Berg", "Mary B."],
    ["Cher", "Cher"],
    ["", "Guest"],
    ["   ", "Guest"],
    [null, "Guest"],
  ])("%j → %j", (input, out) => {
    expect(reviewerDisplayName(input as any)).toBe(out);
  });
});

describe("bookingProducts", () => {
  const booking = { tourId: "t-main", tourName: "Main Tour" };
  it("lists each product once, in booking order", () => {
    expect(bookingProducts(booking, [
      { productId: "a", productName: "A" },
      { productId: "b", productName: "B" },
      { productId: "a", productName: "A" },
    ])).toEqual([{ productId: "a", productName: "A" }, { productId: "b", productName: "B" }]);
  });
  it("falls back to the booking's tour for legacy bookings with no items", () => {
    expect(bookingProducts(booking, [])).toEqual([{ productId: "t-main", productName: "Main Tour" }]);
  });
});

describe("reviewEntriesSchema", () => {
  const ok = { reviews: [{ productId: "a", rating: 5, comment: "  Lovely  " }] };
  it("accepts and trims", () => {
    expect(reviewEntriesSchema.parse(ok).reviews[0].comment).toBe("Lovely");
  });
  it.each([
    ["rating 0", { reviews: [{ productId: "a", rating: 0 }] }],
    ["rating 6", { reviews: [{ productId: "a", rating: 6 }] }],
    ["rating 4.5", { reviews: [{ productId: "a", rating: 4.5 }] }],
    ["comment too long", { reviews: [{ productId: "a", rating: 5, comment: "x".repeat(2001) }] }],
    ["no entries", { reviews: [] }],
    ["11 entries", { reviews: Array.from({ length: 11 }, (_, i) => ({ productId: `p${i}`, rating: 5 })) }],
    ["status smuggled", { reviews: [{ productId: "a", rating: 5, status: "approved" }] }],
    ["top-level extra", { ...ok, verified: true }],
  ])("rejects %s", (_n, body) => {
    expect(reviewEntriesSchema.safeParse(body).success).toBe(false);
  });
});

describe("saveVerifiedReviews", () => {
  beforeEach(() => { store.existing.clear(); store.inserted.length = 0; });
  const booking = { id: "bk1", userId: null, customerName: "Sarah Mitchell", customerEmail: "s@example.com" };

  it("derives identity from the booking, never the entry", async () => {
    const res = await saveVerifiedReviews(booking, [{ productId: "a", rating: 4, comment: "Great" }]);
    expect(res).toEqual({ created: ["a"], alreadyReviewed: [] });
    expect(store.inserted[0]).toEqual({
      bookingId: "bk1", userId: null, tourId: "a", rating: 4, comment: "Great",
      guestName: "Sarah M.", guestEmail: "s@example.com", isGuest: true,
    });
  });

  it("reports already-reviewed products instead of failing", async () => {
    store.existing.add("a");
    const res = await saveVerifiedReviews(booking, [{ productId: "a", rating: 5 }, { productId: "b", rating: 3 }]);
    expect(res).toEqual({ created: ["b"], alreadyReviewed: ["a"] });
  });

  it("marks account holders as non-guest", async () => {
    await saveVerifiedReviews({ ...booking, userId: "u1" }, [{ productId: "a", rating: 5 }]);
    expect(store.inserted[0]).toMatchObject({ userId: "u1", isGuest: false, comment: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/lib/review-invite.test.ts --hookTimeout=60000`
Expected: FAIL — cannot resolve `./review-invite.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// server/lib/review-invite.ts
import { z } from "zod";
import { storage } from "../storage.js";

export type ReviewableBooking = { id: string; userId: string | null; customerName: string; customerEmail: string };
export type ReviewEntry = { productId: string; rating: number; comment?: string };

/** "Sarah Mitchell" → "Sarah M." — public reviews show first name + last initial only. */
export function reviewerDisplayName(customerName: string | null | undefined): string {
  const parts = (customerName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Guest";
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const first = cap(parts[0]);
  return parts.length === 1 ? first : `${first} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

/** Distinct products in a booking; legacy bookings without items fall back to the booking's tour. */
export function bookingProducts(
  booking: { tourId: string; tourName: string },
  items: { productId: string; productName: string }[],
): { productId: string; productName: string }[] {
  const seen = new Map<string, string>();
  for (const it of items) if (!seen.has(it.productId)) seen.set(it.productId, it.productName);
  if (seen.size === 0) seen.set(booking.tourId, booking.tourName);
  return [...seen].map(([productId, productName]) => ({ productId, productName }));
}

export const reviewEntriesSchema = z.object({
  reviews: z.array(z.object({
    productId: z.string().min(1).max(64),
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(2000).optional(),
  }).strict()).min(1).max(10),
}).strict();

/** Save reviews with identity taken from the booking. Pairs already reviewed are reported, not thrown. */
export async function saveVerifiedReviews(booking: ReviewableBooking, entries: ReviewEntry[]) {
  const created: string[] = [];
  const alreadyReviewed: string[] = [];
  for (const e of entries) {
    const review = await storage.createVerifiedReview({
      bookingId: booking.id,
      userId: booking.userId ?? null,
      tourId: e.productId,
      rating: e.rating,
      comment: e.comment ? e.comment : null,
      guestName: reviewerDisplayName(booking.customerName),
      guestEmail: booking.customerEmail || null,
      isGuest: !booking.userId,
    });
    (review ? created : alreadyReviewed).push(e.productId);
  }
  return { created, alreadyReviewed };
}
```

Note the trim happens before the max check (`.trim().max(2000)`), and an all-whitespace comment becomes `""` → stored as `null`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/lib/review-invite.test.ts --hookTimeout=60000`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/lib/review-invite.ts server/lib/review-invite.test.ts
git commit -m "feat(reviews): booking-derived review identity and validation"
```

---

### Task 4: Review routes (invite GET/POST, tightened signed-in POST, guest route removed)

**Files:**
- Create: `server/routes/reviews.routes.ts`
- Test: `server/routes/reviews.routes.test.ts`
- Modify: `server/routes/catalog.routes.ts:155-212` (delete `POST /api/reviews/guest` and `POST /api/reviews`; drop now-unused `insertReviewSchema`, `ZodError`, `reviewsLimiter`, `invalidPersonName` imports if unused)
- Modify: `server/routes.ts:19,58` (import + call `registerReviewRoutes(app)` right after `registerCatalogRoutes(app)`)
- Modify: `server/routes/shared.ts` (add `reviewInviteLimiter`; delete `reviewsLimiter` if no longer used)
- Modify: `server/seed-flags.ts:36-41` (delete the `guest-reviews` entry)
- Modify: `server/security/route-access.test.ts:42` (replace `"POST /api/reviews/guest"` with `"POST /api/reviews/invite/:token", // HMAC-signed booking token`)
- Modify: `server/routes/person-name.routes.test.ts` (delete the `POST /api/reviews/guest` row)

**Interfaces:**
- Consumes: `verifyReviewToken` (Task 1); `bookingProducts`, `reviewEntriesSchema`, `saveVerifiedReviews` (Task 3); `storage.getBooking`, `storage.getBookingItems`, `storage.getReviewedProductIds` (Task 2); `sendAdminEmail` from `server/lib/mail.ts`; `requireAuth` from `./shared.js`
- Produces: `registerReviewRoutes(app: Express): void`; routes
  - `GET /api/reviews/invite/:token` → `200 { firstName, items: [{ productId, productName, reviewed }] }` | `410 { error: "link_expired" }`
  - `POST /api/reviews/invite/:token` body `{ reviews: ReviewEntry[] }` → `200 { created, alreadyReviewed }` | `400` | `409 { error: "already_reviewed" }` | `410`
  - `POST /api/reviews` (auth) body `{ bookingId, tourId, rating, comment? }` → `200 { created, alreadyReviewed }` | `400` | `403` | `409`
  - (Task 6 adds the admin resend route to this same file.)

- [ ] **Step 1: Write the failing test**

```ts
// server/routes/reviews.routes.test.ts
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import request from "supertest";
import express, { Express } from "express";
import session from "express-session";
import { signReviewToken } from "../lib/review-token.js";

// Rate limits are covered by express-rate-limit itself; keep them out of the way here.
vi.mock("express-rate-limit", () => ({ rateLimit: () => (_q: any, _s: any, n: any) => n(), default: () => (_q: any, _s: any, n: any) => n() }));
vi.mock("../lib/mail.js", () => ({ sendAdminEmail: vi.fn(async () => true), sendEmail: vi.fn(async () => true) }));

const BK = "11111111-1111-4111-8111-111111111111";
const fx = vi.hoisted(() => ({
  booking: null as any,
  items: [] as any[],
  reviewed: [] as string[],
  inserted: [] as any[],
}));
vi.mock("../storage.js", () => ({
  storage: {
    getBooking: vi.fn(async (id: string) => (fx.booking && id === fx.booking.id ? fx.booking : undefined)),
    getBookingItems: vi.fn(async () => fx.items),
    getReviewedProductIds: vi.fn(async () => fx.reviewed),
    createVerifiedReview: vi.fn(async (d: any) => {
      if (fx.reviewed.includes(d.tourId)) return null;
      fx.reviewed.push(d.tourId);
      fx.inserted.push(d);
      return { id: "r1", ...d };
    }),
    getUser: vi.fn(async (id: string) => ({ id, role: "customer", isActive: true })),
  },
}));

let app: Express;
beforeAll(async () => {
  const { registerReviewRoutes } = await import("./reviews.routes.js");
  app = express();
  app.use(express.json());
  app.use(session({ secret: "test", resave: false, saveUninitialized: true }));
  app.use((req, _res, next) => {
    const u = req.get("x-test-user");
    if (u) { (req.session as any).userId = u; (req.session as any).userRole = "customer"; }
    next();
  });
  registerReviewRoutes(app);
});

beforeEach(() => {
  fx.booking = {
    id: BK, userId: null, status: "completed", tourId: "t1", tourName: "Mele Cascades",
    customerName: "Sarah Mitchell", customerEmail: "sarah@example.com", customerPhone: "+678 555",
    totalAmountCents: 12000,
  };
  fx.items = [{ productId: "t1", productName: "Mele Cascades" }, { productId: "t2", productName: "Airport Transfer" }];
  fx.reviewed = [];
  fx.inserted = [];
});

const token = () => signReviewToken(BK);

describe("GET /api/reviews/invite/:token", () => {
  it("lists the booking's products without personal or payment details", async () => {
    fx.reviewed = ["t2"];
    const res = await request(app).get(`/api/reviews/invite/${token()}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      firstName: "Sarah",
      items: [
        { productId: "t1", productName: "Mele Cascades", reviewed: false },
        { productId: "t2", productName: "Airport Transfer", reviewed: true },
      ],
    });
    const raw = JSON.stringify(res.body);
    for (const leak of ["sarah@example.com", "+678", BK, "12000"]) expect(raw).not.toContain(leak);
  });

  it.each(["pending", "confirmed", "cancelled"])("410 when the booking is %s", async (status) => {
    fx.booking.status = status;
    const res = await request(app).get(`/api/reviews/invite/${token()}`);
    expect(res.status).toBe(410);
    expect(res.body).toEqual({ error: "link_expired" });
  });

  it("410 for a tampered token", async () => {
    const res = await request(app).get(`/api/reviews/invite/${token()}x`);
    expect(res.status).toBe(410);
  });

  it("410 (not 500) when a validly signed booking was deleted", async () => {
    fx.booking = null;
    const res = await request(app).get(`/api/reviews/invite/${signReviewToken(BK)}`);
    expect(res.status).toBe(410);
  });
});

describe("POST /api/reviews/invite/:token", () => {
  const post = (body: unknown, t = token()) => request(app).post(`/api/reviews/invite/${t}`).send(body);

  it("saves a pending, verified review with identity from the booking", async () => {
    const res = await post({ reviews: [{ productId: "t1", rating: 5, comment: "Amazing" }] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ created: ["t1"], alreadyReviewed: [] });
    expect(fx.inserted[0]).toMatchObject({ bookingId: BK, tourId: "t1", guestName: "Sarah M.", guestEmail: "sarah@example.com", isGuest: true });
  });

  it("400 for a product that is not in the booking", async () => {
    const res = await post({ reviews: [{ productId: "not-mine", rating: 5 }] });
    expect(res.status).toBe(400);
    expect(fx.inserted).toEqual([]);
  });

  it("400 when the client tries to set status", async () => {
    const res = await post({ reviews: [{ productId: "t1", rating: 5, status: "approved" }] });
    expect(res.status).toBe(400);
    expect(fx.inserted).toEqual([]);
  });

  it("skips products already reviewed and reports them", async () => {
    fx.reviewed = ["t1"];
    const res = await post({ reviews: [{ productId: "t1", rating: 5 }, { productId: "t2", rating: 4 }] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ created: ["t2"], alreadyReviewed: ["t1"] });
  });

  it("409 when everything was already reviewed (second tab / reused link)", async () => {
    await post({ reviews: [{ productId: "t1", rating: 5 }] });
    const res = await post({ reviews: [{ productId: "t1", rating: 5 }] });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "already_reviewed" });
  });

  it("410 when the booking is not completed", async () => {
    fx.booking.status = "confirmed";
    const res = await post({ reviews: [{ productId: "t1", rating: 5 }] });
    expect(res.status).toBe(410);
    expect(fx.inserted).toEqual([]);
  });
});

describe("POST /api/reviews (signed in)", () => {
  const post = (body: unknown, user = "custA") => request(app).post("/api/reviews").set("x-test-user", user).send(body);
  beforeEach(() => { fx.booking.userId = "custA"; });

  it("401 when not signed in", async () => {
    const res = await request(app).post("/api/reviews").send({ bookingId: BK, tourId: "t1", rating: 5 });
    expect(res.status).toBe(401);
  });

  it("saves a pending verified review for the owner's completed booking", async () => {
    const res = await post({ bookingId: BK, tourId: "t1", rating: 5, comment: "Great" });
    expect(res.status).toBe(200);
    expect(fx.inserted[0]).toMatchObject({ userId: "custA", isGuest: false, tourId: "t1" });
  });

  it("400 when the body tries to set status", async () => {
    const res = await post({ bookingId: BK, tourId: "t1", rating: 5, status: "approved" });
    expect(res.status).toBe(400);
    expect(fx.inserted).toEqual([]);
  });

  it("403 for another customer's booking", async () => {
    const res = await post({ bookingId: BK, tourId: "t1", rating: 5 }, "custB");
    expect(res.status).toBe(403);
    expect(fx.inserted).toEqual([]);
  });

  it("403 when the booking is not completed", async () => {
    fx.booking.status = "confirmed";
    const res = await post({ bookingId: BK, tourId: "t1", rating: 5 });
    expect(res.status).toBe(403);
  });

  it("400 for a product outside the booking", async () => {
    const res = await post({ bookingId: BK, tourId: "elsewhere", rating: 5 });
    expect(res.status).toBe(400);
  });
});
```

Before writing the route, check how `requireAuth` responds to an anonymous request (`grep -n "export function requireAuth" -A8 server/routes/shared.ts`) — if it is not 401, change that test's expectation to match it.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/routes/reviews.routes.test.ts --hookTimeout=60000`
Expected: FAIL — cannot resolve `./reviews.routes.js`.

- [ ] **Step 3: Add the limiter** (`server/routes/shared.ts`, next to the existing limiters)

```ts
export const reviewInviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // per IP — a family may submit several products in a few tries
  message: { error: "Too many review submissions. Please try again later." },
});
```

- [ ] **Step 4: Write the routes**

```ts
// server/routes/reviews.routes.ts
import type { Express, Response } from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import { verifyReviewToken } from "../lib/review-token.js";
import { bookingProducts, reviewEntriesSchema, reviewerDisplayName, saveVerifiedReviews } from "../lib/review-invite.js";
import { sendAdminEmail } from "../lib/mail.js";
import { escapeHtml } from "../lib/escape-html.js";
import { requireAuth, reviewInviteLimiter } from "./shared.js";

const expired = (res: Response) => res.status(410).json({ error: "link_expired" });

/** The completed booking a token points to, or null (bad token, missing, or not completed). */
async function bookingForToken(token: string) {
  const claim = verifyReviewToken(token);
  if (!claim) return null;
  const booking = await storage.getBooking(claim.bookingId);
  return booking && booking.status === "completed" ? booking : null;
}

async function productsFor(booking: any) {
  return bookingProducts(booking, await storage.getBookingItems(booking.id));
}

function notifyAdmin(booking: any, count: number) {
  // Best-effort: a failed notification never fails the customer's submission.
  sendAdminEmail(
    "New review awaiting approval",
    `<p>${count} new review(s) from <strong>${escapeHtml(reviewerDisplayName(booking.customerName))}</strong> are waiting in Admin → Reviews.</p>`,
  ).catch((err) => console.error("[REVIEWS] admin notification failed:", err));
}

const signedInReviewSchema = z.object({
  bookingId: z.string().min(1).max(64),
  tourId: z.string().min(1).max(64),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
}).strict();

export function registerReviewRoutes(app: Express) {
  app.get("/api/reviews/invite/:token", async (req, res) => {
    try {
      const booking = await bookingForToken(req.params.token);
      if (!booking) return expired(res);
      const reviewed = new Set(await storage.getReviewedProductIds(booking.id));
      const items = (await productsFor(booking)).map((p) => ({ ...p, reviewed: reviewed.has(p.productId) }));
      res.json({ firstName: reviewerDisplayName(booking.customerName).split(" ")[0], items });
    } catch (error: any) {
      console.error("[ROUTE] GET /api/reviews/invite failed:", error?.message);
      res.status(500).json({ error: "Failed to load review invite." });
    }
  });

  app.post("/api/reviews/invite/:token", reviewInviteLimiter, async (req, res) => {
    try {
      const booking = await bookingForToken(req.params.token);
      if (!booking) return expired(res);
      const parsed = reviewEntriesSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid review." });
      const allowed = new Set((await productsFor(booking)).map((p) => p.productId));
      if (parsed.data.reviews.some((r) => !allowed.has(r.productId))) {
        return res.status(400).json({ error: "That product is not part of this booking." });
      }
      const result = await saveVerifiedReviews(booking, parsed.data.reviews);
      if (result.created.length === 0) return res.status(409).json({ error: "already_reviewed" });
      notifyAdmin(booking, result.created.length);
      res.json(result);
    } catch (error: any) {
      console.error("[ROUTE] POST /api/reviews/invite failed:", error?.message);
      res.status(500).json({ error: "Failed to submit review. Please try again." });
    }
  });

  app.post("/api/reviews", requireAuth, reviewInviteLimiter, async (req, res) => {
    try {
      const parsed = signedInReviewSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid review." });
      const { bookingId, tourId, rating, comment } = parsed.data;
      const booking = await storage.getBooking(bookingId);
      if (!booking || booking.userId !== req.session.userId || booking.status !== "completed") {
        return res.status(403).json({ error: "You can review a booking once it is completed." });
      }
      if (!(await productsFor(booking)).some((p) => p.productId === tourId)) {
        return res.status(400).json({ error: "That product is not part of this booking." });
      }
      const result = await saveVerifiedReviews(booking, [{ productId: tourId, rating, comment }]);
      if (result.created.length === 0) return res.status(409).json({ error: "already_reviewed" });
      notifyAdmin(booking, 1);
      res.json(result);
    } catch (error: any) {
      console.error("[ROUTE] POST /api/reviews failed:", error?.message);
      res.status(500).json({ error: "Failed to submit review. Please try again." });
    }
  });
}
```

Then: delete the two old routes from `catalog.routes.ts`, register `registerReviewRoutes(app)` in `server/routes.ts` after `registerCatalogRoutes(app)`, remove the `guest-reviews` seed flag, update `route-access.test.ts` and `person-name.routes.test.ts` as listed under **Files**.

- [ ] **Step 5: Run tests to verify they pass**

Run (sequentially):
```bash
npx vitest run server/routes/reviews.routes.test.ts --hookTimeout=60000
npx vitest run server/security server/routes/person-name.routes.test.ts server/api-route-order.test.ts --hookTimeout=60000
npx tsc --noEmit -p .
```
Expected: all PASS; tsc clean.

- [ ] **Step 6: Commit**

```bash
git add server/routes/reviews.routes.ts server/routes/reviews.routes.test.ts server/routes/catalog.routes.ts server/routes.ts server/routes/shared.ts server/seed-flags.ts server/security/route-access.test.ts server/routes/person-name.routes.test.ts
git commit -m "fix(reviews): only completed bookings can review; drop open guest form route

POST /api/reviews accepted status from the body, so a signed-in user could
publish an approved review for any product."
```

---

### Task 5: Review request email

**Files:**
- Modify: `server/lib/mail.ts` (export `getAppUrl`; add `getReviewRequestTemplate`)
- Modify: `server/lib/email-translations.ts` (5 keys × 5 locales)
- Create: `server/lib/review-request.ts`
- Test: `server/lib/mail.review-request.test.ts`

**Interfaces:**
- Consumes: `signReviewToken` (Task 1); `bookingProducts` (Task 3); `storage.getBookingItems`
- Produces:
  - `getReviewRequestTemplate(booking: { id: string; customerName: string; locale?: string }, productNames: string[], link: string): Promise<string>`
  - `getMsg(locale, "reviewRequestSubject")` — subject string
  - `sendReviewRequest(booking: Booking): Promise<boolean>` — `false` (no throw) when the booking has no email or sending fails

- [ ] **Step 1: Write the failing test**

```ts
// server/lib/mail.review-request.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const sent = vi.hoisted(() => [] as any[]);
vi.mock("../storage.js", () => ({
  storage: {
    getSiteSetting: vi.fn(async () => undefined),
    getBookingItems: vi.fn(async () => [{ productId: "t1", productName: "Mele <Cascades>" }]),
  },
}));
vi.mock("../infrastructure/mailing/MailingService.js", () => ({
  mailingService: { send: vi.fn(async (o: any) => { sent.push(o); return true; }), verify: vi.fn() },
}));

const booking = { id: "11111111-1111-4111-8111-111111111111", customerName: "Jo <b>Bloggs</b>", customerEmail: "jo@example.com", locale: "fr", tourId: "t1", tourName: "Mele" };

describe("review request email", () => {
  beforeEach(() => { sent.length = 0; });

  it("links to the review page and escapes names", async () => {
    const { getReviewRequestTemplate } = await import("./mail.js");
    const html = await getReviewRequestTemplate(booking, ["Mele <Cascades>"], "https://acetoursvanuatu.com/review/abc.def");
    expect(html).toContain('href="https://acetoursvanuatu.com/review/abc.def"');
    expect(html).toContain("Mele &lt;Cascades&gt;");
    expect(html).not.toContain("<b>Bloggs</b>");
  });

  it("sends in the booking's language with a signed link", async () => {
    const { sendReviewRequest } = await import("./review-request.js");
    expect(await sendReviewRequest(booking as any)).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("jo@example.com");
    expect(sent[0].subject).toMatch(/avis|Ace Tours/i);
    expect(sent[0].html).toMatch(/\/review\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  });

  it("returns false without an email address", async () => {
    const { sendReviewRequest } = await import("./review-request.js");
    expect(await sendReviewRequest({ ...booking, customerEmail: "" } as any)).toBe(false);
    expect(sent).toHaveLength(0);
  });
});
```

Before running: check how `sendEmail` calls the mailing service (`sed -n 40,52p server/lib/mail.ts`) and adjust the `mailingService` mock's method name to match (e.g. `sendMail`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/lib/mail.review-request.test.ts --hookTimeout=60000`
Expected: FAIL — `getReviewRequestTemplate` is not a function / cannot resolve `./review-request.js`.

- [ ] **Step 3: Add translations** (`server/lib/email-translations.ts`, inside each locale object)

```ts
// en
    reviewRequestSubject: "How was your trip? — Ace Tours & Transfers",
    reviewRequestTitle: "How was your trip?",
    reviewRequestSubtitle: "Your review helps other travellers discover Vanuatu",
    reviewRequestIntro: "Thank you for travelling with us. Would you take a minute to rate your experience?",
    reviewRequestButton: "Leave a review",
// fr
    reviewRequestSubject: "Comment s'est passé votre voyage ? — Ace Tours & Transfers",
    reviewRequestTitle: "Comment s'est passé votre voyage ?",
    reviewRequestSubtitle: "Votre avis aide d'autres voyageurs à découvrir le Vanuatu",
    reviewRequestIntro: "Merci d'avoir voyagé avec nous. Pourriez-vous prendre une minute pour noter votre expérience ?",
    reviewRequestButton: "Laisser un avis",
// es
    reviewRequestSubject: "¿Qué tal su viaje? — Ace Tours & Transfers",
    reviewRequestTitle: "¿Qué tal su viaje?",
    reviewRequestSubtitle: "Su reseña ayuda a otros viajeros a descubrir Vanuatu",
    reviewRequestIntro: "Gracias por viajar con nosotros. ¿Podría dedicar un minuto a valorar su experiencia?",
    reviewRequestButton: "Dejar una reseña",
// zh
    reviewRequestSubject: "您的旅程如何？— Ace Tours & Transfers",
    reviewRequestTitle: "您的旅程如何？",
    reviewRequestSubtitle: "您的评价能帮助其他旅行者发现瓦努阿图",
    reviewRequestIntro: "感谢您与我们同行。能否花一分钟为您的体验评分？",
    reviewRequestButton: "留下评价",
// bi  (flag for Mark's native-speaker Bislama check)
    reviewRequestSubject: "Trip blong yu i olsem wanem? — Ace Tours & Transfers",
    reviewRequestTitle: "Trip blong yu i olsem wanem?",
    reviewRequestSubtitle: "Tingting blong yu i helpem ol narafala turis blong luk Vanuatu",
    reviewRequestIntro: "Tangkyu tumas blong travel wetem mifala. Yu save tekem smol taem blong givim mak long trip blong yu?",
    reviewRequestButton: "Raetem wan review",
```

- [ ] **Step 4: Add the template** (`server/lib/mail.ts`)

Change `async function getAppUrl()` to `export async function getAppUrl()`. Then add after `getBookingStatusUpdateTemplate`:

```ts
export async function getReviewRequestTemplate(
  booking: { id: string; customerName: string; locale?: string },
  productNames: string[],
  link: string,
): Promise<string> {
  const l = booking.locale || "en";
  const appUrl = await getAppUrl();
  const eName = escapeHtml(booking.customerName);
  const eLink = escapeHtml(link);
  const products = productNames.map((n) => `<li style="margin: 4px 0;">${escapeHtml(n)}</li>`).join("");

  return emailWrapper(`
    ${emailHeader(`${appUrl}/assets/logo.png`, getMsg(l, "reviewRequestTitle"), getMsg(l, "reviewRequestSubtitle"))}
    <div style="padding: 32px 28px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 8px 0;">${getMsg(l, "greeting", { name: eName })}</p>
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 16px 0;">${getMsg(l, "reviewRequestIntro")}</p>
      <ul style="color: #004165; font-size: 15px; font-weight: 600; padding-left: 20px; margin: 0 0 24px 0;">${products}</ul>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${eLink}" style="background: #004165; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 700; display: inline-block;">★★★★★ ${getMsg(l, "reviewRequestButton")}</a>
      </div>
    </div>
    ${emailFooter(l)}
  `);
}
```

- [ ] **Step 5: Add the sender**

```ts
// server/lib/review-request.ts
import type { Booking } from "../../shared/schema.js";
import { storage } from "../storage.js";
import { signReviewToken } from "./review-token.js";
import { bookingProducts } from "./review-invite.js";
import { getAppUrl, getMsg, getReviewRequestTemplate, sendEmail } from "./mail.js";

/** Email the customer a signed link to review a completed booking. Never throws. */
export async function sendReviewRequest(booking: Booking): Promise<boolean> {
  if (!booking.customerEmail) return false;
  try {
    const link = `${await getAppUrl()}/review/${signReviewToken(booking.id)}`;
    const names = bookingProducts(booking, await storage.getBookingItems(booking.id)).map((p) => p.productName);
    return await sendEmail({
      to: booking.customerEmail,
      subject: getMsg(booking.locale || "en", "reviewRequestSubject"),
      html: await getReviewRequestTemplate(booking, names, link),
    });
  } catch (err) {
    console.error("[REVIEWS] review request email failed:", err);
    return false;
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run server/lib/mail.review-request.test.ts server/lib/mail.bank-details.test.ts --hookTimeout=60000`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/lib/mail.ts server/lib/email-translations.ts server/lib/review-request.ts server/lib/mail.review-request.test.ts
git commit -m "feat(reviews): localised review request email with signed link"
```

---

### Task 6: Send on completion + admin resend

**Files:**
- Modify: `server/routes/bookings.routes.ts:880-905` (status email block)
- Modify: `server/routes/reviews.routes.ts` (admin resend route)
- Modify: `server/infrastructure/audit/admin-audit-log.service.ts:31` (no change needed if `"booking"` entity type is reused — it is)
- Test: `server/routes/booking-completion-review.test.ts`; extend `server/routes/reviews.routes.test.ts`

**Interfaces:**
- Consumes: `sendReviewRequest(booking): Promise<boolean>` (Task 5); `requireAdmin` from `./shared.js`; `adminAudit.log` from `../infrastructure/audit/admin-audit-log.service.js`
- Produces: `POST /api/admin/bookings/:id/review-request` → `200 { sent: boolean }` | `400 { error }` (not completed) | `404`

- [ ] **Step 1: Write the failing PATCH-hook test**

```ts
// server/routes/booking-completion-review.test.ts
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import request from "supertest";
import express, { Express } from "express";
import session from "express-session";

const BK = "11111111-1111-4111-8111-111111111111";
const fx = vi.hoisted(() => ({ status: "confirmed", reviewEmailFails: false }));
const sendReviewRequest = vi.hoisted(() => vi.fn());
const sendEmail = vi.hoisted(() => vi.fn(async () => true));

vi.mock("../lib/review-request.js", () => ({ sendReviewRequest }));
vi.mock("../lib/mail.js", async (orig) => ({ ...(await orig<any>()), sendEmail, sendAdminEmail: vi.fn(async () => true) }));
vi.mock("../storage.js", () => ({
  storage: new Proxy({} as Record<string, unknown>, {
    get: (t, key: string) => (t[key] ??= vi.fn(async (id?: unknown, updates?: any) => {
      if (key === "getUser") return { id, role: "admin", isActive: true };
      if (key === "getBooking") return { id: BK, status: fx.status, customerEmail: "a@example.com", customerName: "A B", totalAmountCents: 1, tourId: "t1", tourName: "T" };
      if (key === "updateBooking") return { id: BK, ...updates, customerEmail: "a@example.com", customerName: "A B", totalAmountCents: 1, tourId: "t1", tourName: "T" };
      if (key === "getBookingItems" || key === "getPaymentsByBooking") return [];
      return undefined;
    })),
  }),
}));

let app: Express;
beforeAll(async () => {
  const { registerBookingRoutes } = await import("./bookings.routes.js");
  app = express();
  app.use(express.json());
  app.use(session({ secret: "test", resave: false, saveUninitialized: true }));
  app.use((req, _res, next) => { (req.session as any).userId = "admin1"; (req.session as any).userRole = "admin"; next(); });
  registerBookingRoutes(app);
});

beforeEach(() => {
  sendReviewRequest.mockReset().mockResolvedValue(true);
  sendEmail.mockClear();
});

describe("completing a booking", () => {
  it("sends the review request instead of the generic status email", async () => {
    fx.status = "confirmed";
    const res = await request(app).patch(`/api/bookings/${BK}`).send({ status: "completed" });
    expect(res.status).toBe(200);
    expect(sendReviewRequest).toHaveBeenCalledTimes(1);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("still succeeds when the review email throws", async () => {
    fx.status = "confirmed";
    sendReviewRequest.mockRejectedValue(new Error("smtp down"));
    const res = await request(app).patch(`/api/bookings/${BK}`).send({ status: "completed" });
    expect(res.status).toBe(200);
  });

  it("does not send a review request for other transitions", async () => {
    fx.status = "pending";
    await request(app).patch(`/api/bookings/${BK}`).send({ status: "confirmed" });
    expect(sendReviewRequest).not.toHaveBeenCalled();
  });
});
```

Check the exported registrar name first: `grep -n "^export function register" server/routes/bookings.routes.ts` and use it. If the PATCH handler calls other storage methods that must return arrays, add them to the `getBookingItems` line.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run server/routes/booking-completion-review.test.ts --hookTimeout=60000`
Expected: FAIL — `sendReviewRequest` called 0 times; `sendEmail` called once.

- [ ] **Step 3: Hook into the PATCH handler** (`server/routes/bookings.routes.ts`)

Add the import near the other `../lib` imports:

```ts
import { sendReviewRequest } from "../lib/review-request.js";
```

Replace the start of the status-email block:

```ts
      // ✅ Send email when status changes
      if (updates.status && updates.status !== existing.status && booking.customerEmail) {
```

with:

```ts
      // Completed trips get the "How was your trip?" review request in place of the
      // generic status email. Fire-and-forget: email failure never fails the update.
      if (updates.status === "completed" && existing.status !== "completed") {
        sendReviewRequest(booking).catch((err) => console.error("[BOOKING][STATUS] Review request failed (non-fatal):", err));
      } else if (updates.status && updates.status !== existing.status && booking.customerEmail) {
```

(The rest of that block stays as-is.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run server/routes/booking-completion-review.test.ts --hookTimeout=60000`
Expected: PASS.

- [ ] **Step 5: Write the failing admin-resend tests** (append to `server/routes/reviews.routes.test.ts`)

At the top of that file add a mock and extend the storage/user mock:

```ts
const sendReviewRequest = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../lib/review-request.js", () => ({ sendReviewRequest }));
vi.mock("../infrastructure/audit/admin-audit-log.service.js", () => ({ adminAudit: { log: vi.fn(async () => {}) } }));
```

Change the `getUser` mock to: `getUser: vi.fn(async (id: string) => ({ id, role: id === "admin1" ? "admin" : "customer", isActive: true })),` and in the test middleware set `userRole` from `x-test-role` when present.

```ts
describe("POST /api/admin/bookings/:id/review-request", () => {
  const send = (user?: string) => {
    const r = request(app).post(`/api/admin/bookings/${BK}/review-request`);
    return user ? r.set("x-test-user", user).set("x-test-role", user === "admin1" ? "admin" : "customer") : r;
  };
  beforeEach(() => sendReviewRequest.mockClear());

  it("sends for a completed booking", async () => {
    const res = await send("admin1");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ sent: true });
    expect(sendReviewRequest).toHaveBeenCalledTimes(1);
  });

  it("400 when the booking is not completed", async () => {
    fx.booking.status = "confirmed";
    const res = await send("admin1");
    expect(res.status).toBe(400);
    expect(sendReviewRequest).not.toHaveBeenCalled();
  });

  it("refuses non-admins", async () => {
    expect((await send("custA")).status).toBe(403);
    expect((await send()).status).toBe(401);
    expect(sendReviewRequest).not.toHaveBeenCalled();
  });
});
```

(As in Task 4, align the 401/403 expectations with what `requireAdmin` actually returns.)

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run server/routes/reviews.routes.test.ts --hookTimeout=60000`
Expected: new tests FAIL with 404.

- [ ] **Step 7: Add the route** (`server/routes/reviews.routes.ts`)

Add imports:

```ts
import { requireAdmin } from "./shared.js";
import { sendReviewRequest } from "../lib/review-request.js";
import { adminAudit } from "../infrastructure/audit/admin-audit-log.service.js";
```

(merge `requireAdmin` into the existing `./shared.js` import). Inside `registerReviewRoutes`:

```ts
  app.post("/api/admin/bookings/:id/review-request", requireAdmin, async (req, res) => {
    try {
      const booking = await storage.getBooking(req.params.id);
      if (!booking) return res.status(404).json({ error: "Booking not found" });
      if (booking.status !== "completed") {
        return res.status(400).json({ error: "Only completed bookings can be asked for a review." });
      }
      const sent = await sendReviewRequest(booking);
      await adminAudit.log({
        action: "review_request_sent", entityType: "booking", entityId: booking.id,
        performedBy: req.session.userId, metadata: { sent }, req,
      });
      res.json({ sent });
    } catch (error: any) {
      console.error("[ROUTE] POST /api/admin/bookings/:id/review-request failed:", error?.message);
      res.status(500).json({ error: "Failed to send review request." });
    }
  });
```

- [ ] **Step 8: Run to verify all pass**

```bash
npx vitest run server/routes/reviews.routes.test.ts server/routes/booking-completion-review.test.ts --hookTimeout=60000
npx vitest run server/security --hookTimeout=60000
```
Expected: PASS (route-access test sees the new admin route as guarded).

- [ ] **Step 9: Commit**

```bash
git add server/routes/bookings.routes.ts server/routes/reviews.routes.ts server/routes/reviews.routes.test.ts server/routes/booking-completion-review.test.ts
git commit -m "feat(reviews): ask for a review when a booking is completed; admin resend"
```

---

### Task 7: Rating JSON-LD on Product only

**Files:**
- Modify: `client/src/lib/product-jsonld.ts` (add `buildRatingJsonLd`)
- Modify: `client/src/lib/product-jsonld.test.ts`
- Modify: `client/src/components/seo.tsx:176-183` (delete LocalBusiness rating) and `:210-224` (use helper)
- Modify: `client/src/pages/tour-detail.tsx:521`, `client/src/pages/transfer-detail.tsx:250` (`r.authorName`)

**Interfaces:**
- Produces:
  - `type RatedReview = { author: string; rating: number; body?: string | null; datePublished?: string }`
  - `buildRatingJsonLd(reviews: RatedReview[]): { aggregateRating: object; review: object[] } | null` — `null` for an empty list

- [ ] **Step 1: Write the failing test** (append to `client/src/lib/product-jsonld.test.ts`)

```ts
import { buildRatingJsonLd } from "./product-jsonld";

describe("buildRatingJsonLd", () => {
  it("returns null with no approved reviews (no empty ratings in markup)", () => {
    expect(buildRatingJsonLd([])).toBeNull();
  });

  it("averages to one decimal and counts every review", () => {
    const out = buildRatingJsonLd([
      { author: "Sarah M.", rating: 5, body: "Wonderful", datePublished: "2026-10-01" },
      { author: "Tom K.", rating: 4 },
      { author: "Ana P.", rating: 4 },
    ])!;
    expect(out.aggregateRating).toEqual({ "@type": "AggregateRating", ratingValue: "4.3", bestRating: "5", reviewCount: 3 });
  });

  it("includes at most 5 reviews with named authors", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ author: `R${i}`, rating: 5 }));
    const out = buildRatingJsonLd(many)!;
    expect(out.review).toHaveLength(5);
    expect(out.review[0]).toEqual({
      "@type": "Review",
      reviewRating: { "@type": "Rating", ratingValue: 5, bestRating: 5 },
      author: { "@type": "Person", name: "R0" },
    });
    expect(out.aggregateRating).toMatchObject({ reviewCount: 8 });
  });

  it("omits empty body and date fields", () => {
    const out = buildRatingJsonLd([{ author: "A", rating: 3, body: null }])!;
    expect(out.review[0]).not.toHaveProperty("reviewBody");
    expect(out.review[0]).not.toHaveProperty("datePublished");
  });
});
```

(If the file's existing imports already pull from `./product-jsonld`, merge into that import line.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run client/src/lib/product-jsonld.test.ts --hookTimeout=60000`
Expected: FAIL — `buildRatingJsonLd` is not exported.

- [ ] **Step 3: Implement** (`client/src/lib/product-jsonld.ts`)

```ts
export interface RatedReview {
  author: string;
  rating: number;
  body?: string | null;
  datePublished?: string;
}

/**
 * Product rating markup from approved first-party reviews. Returns null when
 * there are none — Google treats an empty or invented rating as spam. Never
 * attach this to LocalBusiness/Organization (self-serving ratings are ignored
 * there and risk a manual action).
 */
export function buildRatingJsonLd(reviews: RatedReview[]) {
  if (reviews.length === 0) return null;
  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  return {
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: avg.toFixed(1),
      bestRating: "5",
      reviewCount: reviews.length,
    },
    review: reviews.slice(0, 5).map((r) => ({
      "@type": "Review",
      reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
      author: { "@type": "Person", name: r.author },
      ...(r.body ? { reviewBody: r.body } : {}),
      ...(r.datePublished ? { datePublished: r.datePublished } : {}),
    })),
  };
}
```

- [ ] **Step 4: Use it in `seo.tsx`**

- Delete the `if (aggregateRating) { localBusiness.aggregateRating = ... }` block (lines ~176-183).
- In the Product block, replace the `if (aggregateRating) {...}` and `if (reviews.length > 0) {...}` blocks with:

```ts
    const rating = buildRatingJsonLd(reviews);
    if (rating) Object.assign(productSchema, rating);
```

- Import: `import { buildOfferJsonLd, buildRatingJsonLd } from "@/lib/product-jsonld";`
- Remove the now-unused `aggregateRating` prop from `SEOProps` and its destructuring, and change `ReviewSchema` to `export type ReviewSchema = RatedReview;` (import the type). The aggregate is now derived from all reviews passed in, so callers must pass the **full** approved list (next step).

- [ ] **Step 5: Update the detail pages**

In `tour-detail.tsx` (~line 520-521) and `transfer-detail.tsx` (~line 249-250), delete the `aggregateRating={...}` prop and replace the `reviews={...}` prop with:

```tsx
        reviews={reviews.map((r: any) => ({ author: r.authorName, rating: r.rating, body: r.comment, datePublished: r.createdAt?.slice(0, 10) }))}
```

- [ ] **Step 6: Run tests and type-check**

```bash
npx vitest run client/src/lib/product-jsonld.test.ts --hookTimeout=60000
npx tsc --noEmit -p .
```
Expected: PASS; tsc clean (fix any other `aggregateRating=` caller tsc reports — `grep -rn "aggregateRating=" client/src`).

- [ ] **Step 7: Commit**

```bash
git add client/src/lib/product-jsonld.ts client/src/lib/product-jsonld.test.ts client/src/components/seo.tsx client/src/pages/tour-detail.tsx client/src/pages/transfer-detail.tsx
git commit -m "fix(seo): ratings only on Product markup, from approved reviews, with real author names"
```

---

### Task 8: Review page, remove guest form, admin UI

**Files:**
- Create: `client/src/pages/review-invite.tsx`
- Modify: `client/src/App.tsx` (lazy import + `<Route path="/review/:token" component={ReviewInvite} />` next to `/manage-booking`)
- Modify: `client/public/robots.txt` (add `Disallow: /review/` after `Disallow: /confirmation`)
- Delete: `client/src/components/GuestReviewForm.tsx`
- Modify: `client/src/pages/tour-detail.tsx:20,888-895`, `client/src/pages/transfer-detail.tsx:19,~460-468` (remove import + form block)
- Modify: `client/src/locales/{en,fr,es,zh,bi}.json`
- Modify: `client/src/pages/admin/reviews.tsx:365,440` (Verified badge)
- Modify: `client/src/pages/admin/bookings.tsx:~255` (Send review request item)

**Interfaces:**
- Consumes: `GET/POST /api/reviews/invite/:token` (Task 4); `POST /api/admin/bookings/:id/review-request` (Task 6); `apiRequest(method, url, data)` from `@/lib/queryClient` (attaches CSRF)

Client pages are outside the vitest include list; verify in the browser (Step 6).

- [ ] **Step 1: Locale strings**

`en.json` is flat — add:

```json
  "review.title": "How was your trip?",
  "review.greeting": "Thanks for travelling with us, {{name}}.",
  "review.intro": "Rate each part of your trip. Your review appears once our team has checked it.",
  "review.commentLabel": "Tell other travellers about it (optional)",
  "review.alreadyReviewed": "Already reviewed — thank you!",
  "review.submit": "Submit review",
  "review.thanksTitle": "Thank you!",
  "review.thanksBody": "Your review will appear on our site once it has been approved.",
  "review.expiredTitle": "This review link has expired",
  "review.expiredBody": "It may already have been used, or it is more than 90 days old. Contact us and we'll send a new one.",
  "review.error": "Something went wrong. Please try again.",
  "review.ratingLabel": "{{n}} star(s)",
  "quickView.noReviewsYet": "No reviews yet.",
```

In `fr/es/zh/bi.json` follow each file's existing nesting (`"quickView": { ... }` objects, a new `"review": { ... }` object) with:

- fr: title "Comment s'est passé votre voyage ?", greeting "Merci d'avoir voyagé avec nous, {{name}}.", intro "Notez chaque partie de votre voyage. Votre avis apparaîtra après vérification par notre équipe.", commentLabel "Parlez-en aux autres voyageurs (facultatif)", alreadyReviewed "Déjà noté — merci !", submit "Envoyer l'avis", thanksTitle "Merci !", thanksBody "Votre avis apparaîtra sur notre site une fois approuvé.", expiredTitle "Ce lien a expiré", expiredBody "Il a peut-être déjà été utilisé ou date de plus de 90 jours. Contactez-nous et nous vous en enverrons un nouveau.", error "Une erreur s'est produite. Veuillez réessayer.", ratingLabel "{{n}} étoile(s)", noReviewsYet "Aucun avis pour l'instant."
- es: title "¿Qué tal su viaje?", greeting "Gracias por viajar con nosotros, {{name}}.", intro "Valore cada parte de su viaje. Su reseña aparecerá cuando nuestro equipo la revise.", commentLabel "Cuénteselo a otros viajeros (opcional)", alreadyReviewed "Ya valorado — ¡gracias!", submit "Enviar reseña", thanksTitle "¡Gracias!", thanksBody "Su reseña aparecerá en nuestro sitio una vez aprobada.", expiredTitle "Este enlace ha caducado", expiredBody "Puede que ya se haya usado o que tenga más de 90 días. Contáctenos y le enviaremos uno nuevo.", error "Algo salió mal. Inténtelo de nuevo.", ratingLabel "{{n}} estrella(s)", noReviewsYet "Aún no hay reseñas."
- zh: title "您的旅程如何？", greeting "感谢您与我们同行，{{name}}。", intro "请为旅程的每个部分评分。我们的团队审核后，您的评价将会显示。", commentLabel "与其他旅行者分享（可选）", alreadyReviewed "已评价——谢谢！", submit "提交评价", thanksTitle "谢谢！", thanksBody "您的评价通过审核后将显示在我们的网站上。", expiredTitle "此评价链接已失效", expiredBody "该链接可能已被使用或已超过 90 天。请联系我们，我们会发送新的链接。", error "出了点问题，请重试。", ratingLabel "{{n}} 星", noReviewsYet "还没有评价。"
- bi (flag for Mark's Bislama check): title "Trip blong yu i olsem wanem?", greeting "Tangkyu blong travel wetem mifala, {{name}}.", intro "Givim mak long evri pat blong trip blong yu. Review blong yu bambae i soaot taem tim blong mifala i jekem.", commentLabel "Talem long ol narafala turis (sapos yu wantem)", alreadyReviewed "Yu givim finis — tangkyu!", submit "Sendem review", thanksTitle "Tangkyu tumas!", thanksBody "Review blong yu bambae i soaot long websaet taem mifala i oraetem.", expiredTitle "Link ia i no moa wok", expiredBody "Maet yu yusum finis, o i bitim 90 dei. Kontaktem mifala mo bambae mifala i sendem wan niu.", error "I gat wan problem. Traem bakegen.", ratingLabel "{{n}} sta", noReviewsYet "I no gat review yet."

- [ ] **Step 2: Write the page**

```tsx
// client/src/pages/review-invite.tsx
import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";

type Invite = { firstName: string; items: { productId: string; productName: string; reviewed: boolean }[] };
type Draft = { rating: number; comment: string };

async function loadInvite(token: string): Promise<Invite | "expired"> {
  const res = await fetch(`/api/reviews/invite/${encodeURIComponent(token)}`, { credentials: "include" });
  if (res.status === 410) return "expired";
  if (!res.ok) throw new Error("load_failed");
  return res.json();
}

function Stars({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: (n: number) => string }) {
  return (
    <div role="radiogroup" className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={label(n)}
          onClick={() => onChange(n)} className="p-1 focus-visible:outline focus-visible:outline-2 rounded">
          <Star className={`h-8 w-8 ${n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
        </button>
      ))}
    </div>
  );
}

export default function ReviewInvite() {
  const { token = "" } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const invite = useQuery({ queryKey: ["review-invite", token], queryFn: () => loadInvite(token), retry: false });

  const submit = useMutation({
    mutationFn: async () => {
      const reviews = Object.entries(drafts)
        .filter(([, d]) => d.rating > 0)
        .map(([productId, d]) => ({ productId, rating: d.rating, ...(d.comment.trim() ? { comment: d.comment.trim() } : {}) }));
      const res = await apiRequest("POST", `/api/reviews/invite/${encodeURIComponent(token)}`, { reviews });
      return res.json();
    },
  });

  const set = (id: string, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [id]: { rating: 0, comment: "", ...d[id], ...patch } }));
  const anyRated = Object.values(drafts).some((d) => d.rating > 0);

  let body: React.ReactNode;
  if (invite.isLoading) {
    body = <p className="text-muted-foreground">…</p>;
  } else if (invite.data === "expired" || (submit.error as any)?.message?.startsWith("410")) {
    body = (<><h1 className="text-2xl font-bold mb-2">{t("review.expiredTitle")}</h1><p>{t("review.expiredBody")}</p></>);
  } else if (submit.isSuccess || (submit.error as any)?.message?.startsWith("409")) {
    body = (<><h1 className="text-2xl font-bold mb-2">{t("review.thanksTitle")}</h1><p>{t("review.thanksBody")}</p></>);
  } else if (invite.isError || !invite.data) {
    body = <p role="alert">{t("review.error")}</p>;
  } else {
    const data = invite.data;
    body = (
      <form onSubmit={(e) => { e.preventDefault(); submit.mutate(); }} className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">{t("review.title")}</h1>
          <p>{t("review.greeting", { name: data.firstName })}</p>
          <p className="text-sm text-muted-foreground mt-1">{t("review.intro")}</p>
        </div>
        {data.items.map((item) => (
          <fieldset key={item.productId} className="border border-border rounded-lg p-4 space-y-3">
            <legend className="font-semibold px-1">{item.productName}</legend>
            {item.reviewed ? (
              <p className="text-sm text-muted-foreground">{t("review.alreadyReviewed")}</p>
            ) : (
              <>
                <Stars value={drafts[item.productId]?.rating ?? 0} onChange={(n) => set(item.productId, { rating: n })}
                  label={(n) => t("review.ratingLabel", { n })} />
                <label className="block text-sm">
                  {t("review.commentLabel")}
                  <Textarea maxLength={2000} className="mt-1" value={drafts[item.productId]?.comment ?? ""}
                    onChange={(e) => set(item.productId, { comment: e.target.value })} />
                </label>
              </>
            )}
          </fieldset>
        ))}
        {submit.isError && <p role="alert" className="text-destructive text-sm">{t("review.error")}</p>}
        <Button type="submit" disabled={!anyRated || submit.isPending}>{t("review.submit")}</Button>
      </form>
    );
  }

  return (
    <main className="max-w-xl mx-auto px-4 py-12">
      <Helmet>
        <title>{t("review.title")}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      {body}
    </main>
  );
}
```

Before finishing: check how `apiRequest` reports HTTP errors (`sed -n 1,50p client/src/lib/queryClient.ts`). The 410/409 branches above assume it throws `Error("<status>: <body>")`; adapt the `startsWith` checks to its real error format. Also confirm the app's layout wrapper — if other public pages wrap content in a shared layout component (look at `manage-booking.tsx`'s root element), use the same wrapper instead of a bare `<main>`.

- [ ] **Step 3: Wire up route, robots, remove the guest form**

- `App.tsx`: `const ReviewInvite = lazy(() => import("@/pages/review-invite"));` and `<Route path="/review/:token" component={ReviewInvite} />` beside `/manage-booking`.
- `robots.txt`: `Disallow: /review/`.
- Confirm the path is not in prerender: `grep -n "review" server/prerender-paths.ts` → should be empty (paths are an allow-list).
- `tour-detail.tsx`: delete `import { GuestReviewForm } ...` and the `{/* Review submission form */}` `<div>…</div>` block. Replace `t("quickView.noReviews", "No reviews yet. Be the first to leave one!")` with `t("quickView.noReviewsYet", "No reviews yet.")`.
- `transfer-detail.tsx`: same three changes.
- `git rm client/src/components/GuestReviewForm.tsx`.
- `grep -rn "GuestReviewForm\|reviews/guest\|guest-reviews" client/src server` → only migration/history hits allowed, none in live code.

- [ ] **Step 4: Admin reviews badge** (`client/src/pages/admin/reviews.tsx`)

Next to the Guest pill at line ~365:

```tsx
{review.verified && <span className="text-[10px] bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded-full">Verified customer</span>}
```

Next to the Guest badge in the detail dialog at line ~440:

```tsx
{selectedReview.verified && <Badge variant="outline" className="text-xs mt-1 border-green-500 text-green-600">Verified customer</Badge>}
{selectedReview.bookingId && (
  <p className="text-xs text-muted-foreground mt-1">
    Booking ACT-{selectedReview.bookingId.replace(/^book_/i, "").replace(/-/g, "").slice(0, 8).toUpperCase()}
  </p>
)}
```

(Same format as the server's `shortBookingRef`, so it matches the reference in customer emails.)

- [ ] **Step 5: Admin bookings action** (`client/src/pages/admin/bookings.tsx`)

Add `import { apiRequest } from "@/lib/queryClient";` and `Star` to the `lucide-react` import. Inside the component, near the other mutations:

```tsx
  const reviewRequestMutation = useMutation({
    mutationFn: async (id: string) => (await apiRequest("POST", `/api/admin/bookings/${id}/review-request`)).json(),
    onSuccess: (r: { sent: boolean }) =>
      toast({ title: r.sent ? "Review request sent" : "No email sent", description: r.sent ? undefined : "The booking has no email address, or sending failed." }),
    onError: () => toast({ title: "Could not send review request", variant: "destructive" }),
  });
```

In the admin dropdown, after the "Create payment link" item:

```tsx
                              {booking.status === "completed" && (
                                <DropdownMenuItem onClick={() => reviewRequestMutation.mutate(booking.id)}><Star className="h-4 w-4 mr-2 text-amber-500" />Send review request</DropdownMenuItem>
                              )}
```

- [ ] **Step 6: Verify in the browser**

Run `npx tsc --noEmit -p .` (clean). Then start the dev server **against a non-production database only** — if no safe `DATABASE_URL` is available, stop here and tell the user; do not point the dev server at the live DB to "just look". With a safe DB: open `/review/<token>` (generate one with `npx tsx -e 'import("./server/lib/review-token.ts").then(m=>console.log(m.signReviewToken("<completed booking id>")))'`), confirm stars/keyboard selection, submit → thank-you; reload → products show "Already reviewed"; tamper token → expired message; tour page shows no review form; admin badge and "Send review request" visible.

- [ ] **Step 7: Commit**

```bash
git add -A client/src/pages/review-invite.tsx client/src/App.tsx client/public/robots.txt client/src/components/GuestReviewForm.tsx client/src/pages/tour-detail.tsx client/src/pages/transfer-detail.tsx client/src/locales client/src/pages/admin/reviews.tsx client/src/pages/admin/bookings.tsx
git commit -m "feat(reviews): review invite page; remove open review form; admin verified badge and resend"
```

---

### Task 9: Full verification and hand-off

- [ ] **Step 1: Full suite and type-check**

```bash
npx tsc --noEmit -p .
npx vitest run --hookTimeout=60000
```
Expected: tsc clean; all tests pass (baseline was 627 + the new tests). Report the exact counts.

- [ ] **Step 2: Production build sanity**

```bash
NODE_ENV=production npm run build
```
Expected: build succeeds; `grep -c "review-invite" dist/public/assets/*.js` ≥ 1 (lazy chunk exists).

- [ ] **Step 3: Leftover check**

```bash
grep -rn "createGuestReview\|reviews/guest\|GuestReviewForm\|localBusiness.aggregateRating" server client/src shared
```
Expected: no hits.

- [ ] **Step 4: Ask before pushing**

Pushing to `main` deploys to production and runs migration 0026 on the live DB. Summarise the commits and ask the user to confirm. On yes:

```bash
git -c credential.helper= -c credential.helper='!gh auth git-credential' push https://github.com/tanonda/Ace-Tours-Transfers.git main:main
```

Then after deploy: `curl -s https://acetoursvanuatu.com/api/health`, and `curl -s -o /dev/null -w "%{http_code}" https://acetoursvanuatu.com/api/reviews/invite/bad` → `410`.

- [ ] **Step 5: Hand-off notes for the user**

- Use Admin → Bookings → "Send review request" on recent completed bookings.
- Approve reviews in Admin → Reviews; stars reach Google after the next deploy re-prerenders the pages.
- Bislama strings (email + page) need the native-speaker check.

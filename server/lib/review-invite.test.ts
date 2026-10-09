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

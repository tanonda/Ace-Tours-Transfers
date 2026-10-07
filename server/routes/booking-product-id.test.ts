import { describe, expect, it } from "vitest";
import { createBookingItemSchema } from "./shared.js";

// Detail pages accept URL slugs, but bookings must not: holds, capacity counts and
// per-product pricing rules all key on the product id, so a slug would slip past them.
describe("booking item product id", () => {
  const item = { adultPax: 2, childPax: 0, date: "2026-11-01" };

  it("accepts a product id", () => {
    expect(createBookingItemSchema.safeParse({ ...item, productId: "90b13e31-6e1b-44e9-942c-667203409126" }).success).toBe(true);
  });

  it("rejects a URL slug", () => {
    expect(createBookingItemSchema.safeParse({ ...item, productId: "blue-lagoon-turtle-bay-combo" }).success).toBe(false);
  });
});

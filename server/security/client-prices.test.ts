import { describe, expect, it } from "vitest";
import { createBookingBodySchema } from "../routes/shared.js";

// POST /api/bookings parses its body with this schema before anything else runs.
// Prices and totals are computed on the server, so any the browser sends are dropped.
describe("booking request body", () => {
  it("drops prices and totals sent by the browser", () => {
    const parsed = createBookingBodySchema.parse({
      customerName: "Jo Guest",
      customerEmail: "guest@example.com",
      totalAmountCents: 1,
      discountCents: 99999,
      items: [
        {
          productId: "90b13e31-6e1b-44e9-942c-667203409126",
          adultPax: 2,
          childPax: 0,
          date: "2026-11-01",
          price: 1,
          unitPriceCents: 1,
          subtotalCents: 1,
        },
      ],
    }) as Record<string, any>;
    expect(parsed.totalAmountCents).toBeUndefined();
    expect(parsed.discountCents).toBeUndefined();
    expect(Object.keys(parsed.items[0])).not.toEqual(expect.arrayContaining(["price"]));
    expect(parsed.items[0].unitPriceCents).toBeUndefined();
    expect(parsed.items[0].subtotalCents).toBeUndefined();
  });

  it("refuses negative passenger counts", () => {
    const base = { customerName: "Jo Guest", customerEmail: "guest@example.com" };
    const item = { productId: "90b13e31-6e1b-44e9-942c-667203409126", childPax: 0, date: "2026-11-01" };
    expect(createBookingBodySchema.safeParse({ ...base, items: [{ ...item, adultPax: -2 }] }).success).toBe(false);
  });
});

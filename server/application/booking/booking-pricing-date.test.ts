import { describe, it, expect } from "vitest";
import { toPriceCartItems } from "./CreateBookingFromCartService.js";

describe("toPriceCartItems", () => {
  it("keeps the booking date so date-effective pricing and peak season apply", () => {
    const [item] = toPriceCartItems([
      { productId: "p1", adultPax: 2, childPax: 1, infantPax: 0, petPax: 0, date: "2026-12-20", addonIds: ["a1"] },
    ]);
    expect(item).toEqual({
      productId: "p1",
      adultPax: 2,
      childPax: 1,
      quantity: undefined,
      addonIds: ["a1"],
      date: "2026-12-20",
    });
  });
});

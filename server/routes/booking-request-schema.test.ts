import { describe, it, expect } from "vitest";
import { createBookingBodySchema } from "./shared.js";

const base = {
  customerName: "Jo Guest",
  customerEmail: "jo@example.com",
  items: [{ productId: "11111111-1111-4111-8111-111111111111", adultPax: 2, childPax: 0, infantPax: 0, petPax: 0, date: "2026-12-20" }],
};

describe("createBookingBodySchema", () => {
  it("keeps the contact fields the checkout collects", () => {
    const parsed = createBookingBodySchema.parse({
      ...base,
      customerPhone: "+678 555 1234",
      notes: "Pick up at the cruise terminal",
      promoCode: "WELCOME10",
      locale: "fr",
    });
    expect(parsed.customerPhone).toBe("+678 555 1234");
    expect(parsed.notes).toBe("Pick up at the cruise terminal");
    expect(parsed.promoCode).toBe("WELCOME10");
    expect(parsed.locale).toBe("fr");
  });

  it("rejects impossible dates and negative/zero guest counts", () => {
    expect(createBookingBodySchema.safeParse({
      ...base,
      items: [{ ...base.items[0], date: "2026-02-31" }],
    }).success).toBe(false);

    expect(createBookingBodySchema.safeParse({
      ...base,
      items: [{ ...base.items[0], adultPax: 0, childPax: 0 }],
    }).success).toBe(false);
  });

  it("still requires a guest name and a valid email", () => {
    expect(createBookingBodySchema.safeParse({ ...base, customerName: "" }).success).toBe(false);
    expect(createBookingBodySchema.safeParse({ ...base, customerEmail: "nope" }).success).toBe(false);
  });
});

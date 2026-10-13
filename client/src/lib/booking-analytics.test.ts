import { describe, it, expect, beforeEach } from "vitest";
import { bookingCompleted, buildPurchaseEvent, trackBookingCompleted } from "./booking-analytics";

const booking = { status: "pending", totalAmountCents: 19000, customerName: "Jane Doe", customerEmail: "jane@example.com" };
const items = [
  { productId: "p1", productName: "Blue Lagoon & Turtle Bay Combo", adultPax: 2, childPax: 1 },
  { productId: "p2", productName: "Premium Airport Transfer", adultPax: 0, childPax: 0 },
];

describe("bookingCompleted", () => {
  it("counts cash and bank-transfer bookings as soon as they are made", () => {
    expect(bookingCompleted({ isManual: true, status: "pending" })).toBe(true);
  });
  it("counts card bookings only once the payment has confirmed them", () => {
    expect(bookingCompleted({ isManual: false, status: "pending_payment" })).toBe(false);
    expect(bookingCompleted({ isManual: false, status: "confirmed" })).toBe(true);
    expect(bookingCompleted({ isManual: false, status: "completed" })).toBe(true);
  });
  it("never counts a booking it could not load", () => {
    expect(bookingCompleted({ isManual: true, status: undefined })).toBe(false);
  });
});

describe("buildPurchaseEvent", () => {
  it("builds a GA4 purchase in whole vatu with the booking reference", () => {
    expect(buildPurchaseEvent({ reference: "ACT-04C85720", booking, items, paymentMethod: "cash" })).toEqual({
      event: "purchase",
      ecommerce: {
        transaction_id: "ACT-04C85720",
        value: 19000,
        currency: "VUV",
        payment_type: "cash",
        items: [
          { item_id: "p1", item_name: "Blue Lagoon & Turtle Bay Combo", quantity: 3 },
          { item_id: "p2", item_name: "Premium Airport Transfer", quantity: 1 },
        ],
      },
    });
  });
  it("sends no personal details", () => {
    const json = JSON.stringify(buildPurchaseEvent({ reference: "ACT-1", booking, items, paymentMethod: "card" }));
    expect(json).not.toMatch(/Jane|jane@example/);
  });
});

describe("trackBookingCompleted", () => {
  beforeEach(() => {
    (globalThis as any).window = { dataLayer: [] };
    const store = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
  });

  it("pushes the event once per booking, even if the page is reloaded", () => {
    const input = { reference: "ACT-04C85720", booking, items, paymentMethod: "cash" };
    expect(trackBookingCompleted(input)).toBe(true);
    expect(trackBookingCompleted(input)).toBe(false);
    const dl = (globalThis as any).window.dataLayer;
    // GA4 asks for the previous ecommerce object to be cleared first.
    expect(dl).toEqual([{ ecommerce: null }, buildPurchaseEvent(input)]);
  });

  it("still tracks when storage is unavailable (private mode)", () => {
    (globalThis as any).localStorage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(trackBookingCompleted({ reference: "ACT-2", booking, items, paymentMethod: "cash" })).toBe(true);
  });
});

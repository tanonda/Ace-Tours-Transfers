import { describe, it, expect } from "vitest";
import { canRetryBooking, checkoutResultView, isFinalCheckoutView, retryPaymentPath } from "./checkout-result";

const card = { isManual: false, isCash: false };

describe("checkoutResultView", () => {
  it("never tells a card guest to make a bank transfer while the bank confirms", () => {
    expect(checkoutResultView({ ...card, status: "pending" })).toBe("card-confirming");
    expect(checkoutResultView({ ...card, status: undefined })).toBe("card-confirming");
  });

  it("shows a refused or cancelled card payment as not paid", () => {
    expect(checkoutResultView({ ...card, status: "failed" })).toBe("card-not-paid");
    expect(checkoutResultView({ ...card, status: "cancelled" })).toBe("card-not-paid");
  });

  it("sends a paid booking that needs a person to review", () => {
    expect(checkoutResultView({ ...card, status: "inventory_conflict" })).toBe("card-review");
    expect(checkoutResultView({ ...card, status: "price_mismatch" })).toBe("card-review");
  });

  it("keeps cash and bank transfer wording for manual methods", () => {
    expect(checkoutResultView({ isManual: true, isCash: true, status: "pending" })).toBe("cash");
    expect(checkoutResultView({ isManual: true, isCash: false, status: "pending" })).toBe("bank-transfer");
  });

  it("shows confirmed whatever the method", () => {
    expect(checkoutResultView({ ...card, status: "confirmed" })).toBe("confirmed");
    expect(checkoutResultView({ isManual: true, isCash: false, status: "completed" })).toBe("confirmed");
  });
});

describe("isFinalCheckoutView", () => {
  it("stops polling only when nothing more can happen by itself", () => {
    expect(isFinalCheckoutView("confirmed")).toBe(true);
    expect(isFinalCheckoutView("card-not-paid")).toBe(true);
    expect(isFinalCheckoutView("card-confirming")).toBe(false);
    expect(isFinalCheckoutView("bank-transfer")).toBe(false);
  });
});

describe("retryPaymentPath", () => {
  it("returns to the same booking", () => {
    expect(retryPaymentPath("0f3c-1")).toBe("/payment?bookingId=0f3c-1");
  });
  it("falls back to the basket flow without a booking", () => {
    expect(retryPaymentPath(null)).toBe("/payment");
  });
});

describe("canRetryBooking", () => {
  it("allows only a pending booking", () => {
    expect(canRetryBooking("pending")).toBe(true);
    expect(canRetryBooking("failed")).toBe(false);
    expect(canRetryBooking(undefined)).toBe(false);
  });
});

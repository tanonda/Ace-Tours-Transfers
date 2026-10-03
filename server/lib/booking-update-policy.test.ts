import { describe, expect, it } from "vitest";
import { screenBookingUpdate } from "./booking-update-policy.js";

describe("screenBookingUpdate — customer editing their own booking", () => {
  it("allows contact and pickup details", () => {
    const body = { notes: "Child seat please", pickupLocation: "Iririki", customerPhone: "+678 555", customerName: "A. Tari" };
    expect(screenBookingUpdate(body, false)).toEqual({ ok: true, updates: body });
  });

  it.each([
    ["status", "confirmed"], // confirm an unpaid booking
    ["date", "2026-12-24"], // move the date without an availability check
    ["guests", 12], // add people without repricing
    ["confirmedAt", "2026-10-03"],
    ["paymentReference", "PAID"],
    ["fraudScore", 0],
    ["fraudLevel", "low"],
    ["userId", "someone-else"],
    ["totalAmountCents", 1],
  ])("rejects %s", (field, value) => {
    const result = screenBookingUpdate({ notes: "hi", [field]: value }, false);
    expect(result).toEqual({ ok: false, error: `Field '${field}' cannot be modified.` });
  });

  it("rejects a non-object body", () => {
    expect(screenBookingUpdate([] as any, false).ok).toBe(false);
    expect(screenBookingUpdate(null as any, false).ok).toBe(false);
  });
});

describe("screenBookingUpdate — admin", () => {
  it("allows operational fields such as status and date", () => {
    const body = { status: "confirmed", date: "2026-12-24", notes: "moved by phone" };
    expect(screenBookingUpdate(body, true)).toEqual({ ok: true, updates: body });
  });

  it.each(["totalAmountCents", "amount", "tourId", "customerEmail", "idempotencyKey", "holdId", "bookingSessionId", "id", "createdAt"])(
    "still rejects immutable field %s",
    (field) => {
      expect(screenBookingUpdate({ [field]: "x" }, true)).toEqual({ ok: false, error: `Field '${field}' cannot be modified.` });
    },
  );
});

import { describe, expect, it } from "vitest";
import { screenBookingUpdate } from "./booking-update-policy.js";

describe("screenBookingUpdate — customer editing their own booking", () => {
  it("allows contact and pickup details", () => {
    const body = { notes: "Child seat please", pickupLocation: "Iririki", customerPhone: "+678 555", customerName: "A. Tari" };
    expect(screenBookingUpdate(body, "owner", "pending")).toEqual({ ok: true, updates: body });
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
    const result = screenBookingUpdate({ notes: "hi", [field]: value }, "owner", "pending");
    expect(result).toEqual({ ok: false, error: `Field '${field}' cannot be modified.` });
  });

  it("rejects a non-object body", () => {
    expect(screenBookingUpdate([] as any, "owner", "pending").ok).toBe(false);
    expect(screenBookingUpdate(null as any, "owner", "pending").ok).toBe(false);
  });
});

describe("screenBookingUpdate — field-service staff", () => {
  it("may mark a confirmed booking done", () => {
    expect(screenBookingUpdate({ status: "completed" }, "staff", "confirmed")).toEqual({
      ok: true,
      updates: { status: "completed" },
    });
  });

  it("may not confirm a pending booking (payment is an admin check)", () => {
    expect(screenBookingUpdate({ status: "confirmed" }, "staff", "pending")).toEqual({
      ok: false,
      error: "Field service can only mark confirmed bookings as completed.",
    });
  });

  it("may not cancel", () => {
    expect(screenBookingUpdate({ status: "cancelled" }, "staff", "confirmed").ok).toBe(false);
  });

  it("may not mark a pending booking done", () => {
    expect(screenBookingUpdate({ status: "completed" }, "staff", "pending").ok).toBe(false);
  });

  it("may not edit any other field", () => {
    expect(screenBookingUpdate({ status: "completed", notes: "x" }, "staff", "confirmed")).toEqual({
      ok: false,
      error: "Field 'notes' cannot be modified.",
    });
  });
});

describe("screenBookingUpdate — admin", () => {
  it("allows operational fields such as status and date", () => {
    const body = { status: "confirmed", date: "2026-12-24", notes: "moved by phone" };
    expect(screenBookingUpdate(body, "admin", "pending")).toEqual({ ok: true, updates: body });
  });

  it.each(["totalAmountCents", "amount", "tourId", "customerEmail", "idempotencyKey", "holdId", "bookingSessionId", "id", "createdAt"])(
    "still rejects immutable field %s",
    (field) => {
      expect(screenBookingUpdate({ [field]: "x" }, "admin", "pending")).toEqual({
        ok: false,
        error: `Field '${field}' cannot be modified.`,
      });
    },
  );
});

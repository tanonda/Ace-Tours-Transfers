// HoldExpiryJob: releases an expired hold first and expires its booking only when this run released
// the hold, with a write that only applies while the booking is pending. Holds of a confirmed or
// completed booking are skipped (not counted as expired) and each is logged once per process.
import { describe, it, expect, vi, beforeEach } from "vitest";

const logs = vi.hoisted(() => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }));
vi.mock("../../lib/logger.js", () => ({ createLogger: () => logs }));

import { HoldExpiryJob } from "./hold-expiry.job.js";
import { AvailabilityService, HoldStatus } from "../../domain/availability/availability.service.js";

const hold = (id: string, bookingSessionId = "s1") => ({ id, bookingSessionId, status: "ACTIVE", expiresAt: new Date(0), tourInstanceId: "i1", quantity: 1 });

let storage: Record<string, ReturnType<typeof vi.fn>>;
let release: ReturnType<typeof vi.spyOn>;

function setup(holds: any[], bookings: any[]) {
  storage = {
    getExpiredHolds: vi.fn(async () => holds),
    getBookingByHoldId: vi.fn(async (holdId: string) => bookings.find((b) => b.holdId === holdId)),
    getBookingsBySession: vi.fn(async (sid: string) => bookings.filter((b) => b.bookingSessionId === sid)),
    expireBookingIfPending: vi.fn(async (id: string) => {
      const b = bookings.find((x) => x.id === id);
      if (b?.status !== "pending") return undefined;
      b.status = "expired";
      return b;
    }),
    updateBooking: vi.fn(),
  };
  return new HoldExpiryJob(storage as any);
}

beforeEach(() => {
  vi.restoreAllMocks();
  Object.values(logs).forEach((f) => f.mockClear());
  release = vi.spyOn(AvailabilityService.prototype, "releaseHold").mockResolvedValue(true);
});

describe("HoldExpiryJob", () => {
  it("releases the hold, then expires its pending booking with the conditional write", async () => {
    const booking = { id: "b1", holdId: "h1", bookingSessionId: "s1", status: "pending" };
    const job = setup([hold("h1")], [booking]);
    expect(await job.run()).toEqual({ expired: 1, failed: 0 });
    expect(release).toHaveBeenCalledWith("h1", HoldStatus.EXPIRED);
    expect(release.mock.invocationCallOrder[0]).toBeLessThan(storage.expireBookingIfPending.mock.invocationCallOrder[0]);
    expect(storage.expireBookingIfPending).toHaveBeenCalledWith("b1", expect.stringContaining("hold expiry job"));
    expect(storage.updateBooking).not.toHaveBeenCalled();
    expect(booking.status).toBe("expired");
  });

  it("a confirm that lands after the job read the booking is never overwritten", async () => {
    const booking = { id: "b1", holdId: "h1", bookingSessionId: "s1", status: "pending" };
    const job = setup([hold("h1")], [booking]);
    // The admin confirms between the job's read and its release: the hold is confirmed, so the
    // release finds it no longer ACTIVE and returns false.
    release.mockImplementation(async () => { booking.status = "confirmed"; return false; });
    expect(await job.run()).toEqual({ expired: 0, failed: 0 });
    expect(storage.expireBookingIfPending).not.toHaveBeenCalled();
    expect(booking.status).toBe("confirmed");

    // Even if the release did happen first, the expire write only applies to a pending booking.
    booking.status = "pending";
    release.mockImplementation(async () => { booking.status = "confirmed"; return true; });
    await job.run();
    expect(booking.status).toBe("confirmed");
  });

  it("skips the hold of a confirmed or completed booking, does not count it, and logs it once", async () => {
    const job = setup([hold("h1"), hold("h2", "s2")], [
      { id: "b1", holdId: "h1", bookingSessionId: "s1", status: "confirmed" },
      { id: "b2", holdId: "h2", bookingSessionId: "s2", status: "completed" },
    ]);
    expect(await job.run()).toEqual({ expired: 0, failed: 0 });
    expect(await job.run()).toEqual({ expired: 0, failed: 0 });
    expect(release).not.toHaveBeenCalled();
    const skipped = logs.warn.mock.calls.filter(([msg]) => String(msg).startsWith("Skipping expired hold"));
    expect(skipped.map(([, meta]) => meta.holdId)).toEqual(["h1", "h2"]);
  });

  it("session fallback: a hold that is no booking's holdId is kept only for a paid booking alone in its session", async () => {
    // Alone in the session and confirmed: kept.
    let job = setup([hold("h-later", "s3")], [{ id: "b3", holdId: "h-first", bookingSessionId: "s3", status: "confirmed" }]);
    expect(await job.run()).toEqual({ expired: 0, failed: 0 });
    expect(release).not.toHaveBeenCalled();

    // Two bookings share the session: the hold is not taken to be the confirmed one's, so it is released.
    job = setup([hold("h-x", "s4")], [
      { id: "b4", holdId: "h-a", bookingSessionId: "s4", status: "confirmed" },
      { id: "b5", holdId: "h-b", bookingSessionId: "s4", status: "pending" },
    ]);
    expect(await job.run()).toEqual({ expired: 1, failed: 0 });
    expect(release).toHaveBeenCalledWith("h-x", HoldStatus.EXPIRED);
    expect(storage.expireBookingIfPending).not.toHaveBeenCalled();
  });
});

// ConcurrencyConflictHandler.cleanupStaleHolds must release a stale hold through
// AvailabilityService.releaseHold (which lowers heldCount), never by a bare status write.
// Ace's tests have no database, so storage is a fake and the release is a spy.
import { describe, it, expect, vi } from "vitest";

vi.mock("./db.js", () => ({ db: {} }));

import { ConcurrencyConflictHandler } from "./application/booking/ConcurrencyConflictHandler.js";
import { AvailabilityService } from "./domain/availability/availability.service.js";

const stale = (status: string, expiresAt: Date) => {
  const storage = {
    getBooking: vi.fn(async () => ({ id: "b1", holdId: "h1" })),
    getHold: vi.fn(async () => ({ id: "h1", status, expiresAt })),
    updateHold: vi.fn(async () => undefined),
  };
  return storage;
};
const run = (storage: unknown) => (new ConcurrencyConflictHandler(storage as any) as any).cleanupStaleHolds("b1");

describe("ConcurrencyConflictHandler.cleanupStaleHolds", () => {
  it("releases an expired ACTIVE hold through AvailabilityService.releaseHold", async () => {
    const release = vi.spyOn(AvailabilityService.prototype, "releaseHold").mockResolvedValue(true);
    const storage = stale("ACTIVE", new Date(Date.now() - 60_000));
    await run(storage);
    expect(release).toHaveBeenCalledWith("h1");
    expect(storage.updateHold).not.toHaveBeenCalled();
    release.mockRestore();
  });

  it.each([["ACTIVE", 60_000], ["CONFIRMED", -60_000], ["RELEASED", -60_000]])("leaves a %s hold (expires in %dms) alone", async (status, ahead) => {
    const release = vi.spyOn(AvailabilityService.prototype, "releaseHold").mockResolvedValue(true);
    const storage = stale(status, new Date(Date.now() + ahead));
    await run(storage);
    expect(release).not.toHaveBeenCalled();
    expect(storage.updateHold).not.toHaveBeenCalled();
    release.mockRestore();
  });
});

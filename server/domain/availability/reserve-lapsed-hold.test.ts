// AvailabilityService.reserveLapsedHold: an admin confirming a booking whose hold lapsed gets its
// seats back only if the date is not blacked out and the tour still has room.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTableName } from "drizzle-orm";

vi.mock("../../infrastructure/audit/audit-log.service.js", () => ({ AuditLogService: class { log = vi.fn(async () => undefined); } }));
vi.mock("../../infrastructure/cache/availability-cache.service.js", () => ({ availabilityCache: { invalidate: vi.fn() } }));

import { AvailabilityService, LapsedHoldUnavailableError } from "./availability.service.js";

let rows: Record<string, any>;
let updates: Array<{ table: string; set: any }>;
const tx = {
  select: () => ({ from: (t: any) => ({ where: () => ({ for: async () => [rows[getTableName(t)]].filter(Boolean) }) }) }),
  update: (t: any) => ({ set: (set: any) => ({ where: async () => { updates.push({ table: getTableName(t), set }); } }) }),
};

const service = (blackedOut = false) => new AvailabilityService({ isBlackedOut: vi.fn(async () => blackedOut) } as any);

beforeEach(() => {
  updates = [];
  rows = {
    availability_holds: { id: "h1", tourInstanceId: "i1", quantity: 2, status: "EXPIRED", resourceId: null },
    tour_instances: { id: "i1", tourId: "t1", serviceDate: "2099-01-01", timeSlot: null, totalCapacity: 10, confirmedCount: 7, heldCount: 1, blockedCount: 0 },
  };
});

describe("reserveLapsedHold", () => {
  it("re-reserves the seats as confirmed when the date is open and there is room", async () => {
    await service().reserveLapsedHold("h1", tx);
    expect(updates.map((u) => u.table)).toEqual(["tour_instances", "availability_holds"]);
    expect(updates[1].set).toEqual({ status: "CONFIRMED" });
  });

  it("refuses a full tour", async () => {
    rows.tour_instances.confirmedCount = 8;
    await expect(service().reserveLapsedHold("h1", tx)).rejects.toMatchObject({ name: "LapsedHoldUnavailableError", reason: "capacity" });
    expect(updates).toEqual([]);
  });

  it("refuses a blacked-out date even with room", async () => {
    await expect(service(true).reserveLapsedHold("h1", tx)).rejects.toBeInstanceOf(LapsedHoldUnavailableError);
    await expect(service(true).reserveLapsedHold("h1", tx)).rejects.toMatchObject({ reason: "blackout" });
    expect(updates).toEqual([]);
  });

  it("refuses a hold whose tour instance is gone; a hold that is neither EXPIRED nor RELEASED is a plain error", async () => {
    delete rows.tour_instances;
    await expect(service().reserveLapsedHold("h1", tx)).rejects.toMatchObject({ reason: "unavailable" });
    rows.availability_holds.status = "CONFIRMED";
    const err = await service().reserveLapsedHold("h1", tx).catch((e) => e);
    expect(err).not.toBeInstanceOf(LapsedHoldUnavailableError);
  });
});

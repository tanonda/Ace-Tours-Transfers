// The storage queries behind statement matching and manual confirmation. Ace's tests have no
// database, so drizzle runs over a fake pg client: each test checks the SQL sent and how the rows
// that come back are used.
import { describe, it, expect, vi, beforeEach } from "vitest";

const pg = vi.hoisted(() => ({ calls: [] as Array<{ text: string; values: unknown[] }>, rows: [] as unknown[][], respond: undefined as undefined | ((text: string) => unknown[][]) }));

vi.mock("./db.js", async () => {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const schema = await import("../shared/schema.js");
  const client = {
    query: async (q: any, values?: unknown[]) => {
      const text = typeof q === "string" ? q : q.text;
      pg.calls.push({ text, values: (typeof q === "string" ? values : q.values ?? values) ?? [] });
      const rows = pg.respond ? pg.respond(text) : pg.rows;
      return { rows, rowCount: rows.length, command: "SELECT", fields: [] };
    },
  };
  return { db: drizzle(client as any, { schema }) };
});

import { getTableColumns } from "drizzle-orm";
import { bookings, availabilityHolds, tourInstances } from "../shared/schema.js";
import { AvailabilityService } from "./domain/availability/availability.service.js";
import { storage } from "./storage.js";

/** A bookings row as pg returns it in array mode, in column order. */
const bookingRow = (over: Record<string, unknown>) =>
  Object.keys(getTableColumns(bookings)).map((k) => over[k] ?? (k === "createdAt" || k === "updatedAt" ? "2026-10-19 01:02:03.456" : null));

beforeEach(() => {
  pg.calls = [];
  pg.rows = [];
  pg.respond = undefined;
});

describe("getPendingOfflineBookings (statement candidates)", () => {
  it("selects pending, unarchived bookings joined to their open payments and those payments' gateways", async () => {
    await storage.getPendingOfflineBookings();
    const { text, values } = pg.calls[0];
    expect(text).toMatch(/inner join "payments" on "payments"."booking_id" = "bookings"."id"/);
    expect(text).toMatch(/inner join "payment_gateways" on "payment_gateways"."id" = "payments"."gateway_id"/);
    expect(text).toMatch(/"bookings"."status" = \$1/);
    expect(text).toMatch(/"bookings"."archived_at" is null/);
    expect(text).toMatch(/"payments"."status" in \(\$2, \$3, \$4\)/);
    expect(values).toEqual(["pending", "pending", "processing", "manual_review_required"]);
    expect(text).not.toMatch(/payment_method/); // the old filter read a field no query sets
  });

  it("keeps bookings whose open payment is on an offline gateway, once each, with that gateway's slug", async () => {
    pg.rows = [
      [...bookingRow({ id: "bank-1", status: "pending" }), "manual_transfer"],
      [...bookingRow({ id: "bank-1", status: "pending" }), "manual_transfer"],
      [...bookingRow({ id: "card-1", status: "pending" }), "payzen"],
      [...bookingRow({ id: "cash-1", status: "pending" }), "cash"],
    ];
    const out = await storage.getPendingOfflineBookings();
    expect(out.map((b) => [b.id, b.paymentMethod])).toEqual([["bank-1", "manual_transfer"], ["cash-1", "cash"]]);
  });
});

describe("booking writes", () => {
  it("updateBooking moves updatedAt on every change", async () => {
    pg.rows = [bookingRow({ id: "b1" })];
    await storage.updateBooking("b1", { notes: "guest called" } as any);
    expect(pg.calls[0].text).toMatch(/update "bookings" set .*"updated_at" = \$\d/);
  });

  it("confirmPendingBookingIfUnchanged is a compare-and-set on pending and updatedAt to the millisecond", async () => {
    const expected = new Date("2026-10-19T01:02:03.456Z");
    expect(await storage.confirmPendingBookingIfUnchanged("b1", expected)).toBeUndefined();
    const { text, values } = pg.calls[0];
    expect(text).toMatch(/"status" = \$\d/);
    expect(text).toMatch(/date_trunc\('milliseconds', "bookings"."updated_at"\) = \$\d+::timestamp/);
    expect(values).toEqual(expect.arrayContaining(["confirmed", "b1", "pending", expected.toISOString()]));
  });

  it("expireBookingIfPending writes only while the booking is pending", async () => {
    await storage.expireBookingIfPending("b1", "\nCancelled by hold expiry job.");
    const { text, values } = pg.calls[0];
    expect(text).toMatch(/where \("bookings"."id" = \$\d+ and "bookings"."status" = \$\d+\)/);
    expect(values).toEqual(expect.arrayContaining(["expired", "b1", "pending"]));
  });
});

describe("getOverduePayments", () => {
  it("leaves out only payments whose booking is paid (confirmed or completed)", async () => {
    await storage.getOverduePayments();
    expect(pg.calls[0].text).toMatch(/NOT EXISTS \(SELECT 1 FROM bookings b WHERE b.id = "payments"."booking_id" AND b.status IN \('confirmed', 'completed'\)\)/);
  });
});

// Held counts: a released hold gives its seats back, and a re-reservation counts them once.
describe("held counts", () => {
  const row = (table: any, over: Record<string, unknown>) => Object.keys(getTableColumns(table)).map((k) => over[k] ?? null);
  const world = (holdStatus: string, withInstance = true) => {
    pg.respond = (text) => {
      if (/from "bookings"/.test(text)) return [bookingRow({ id: "b1", status: "pending", holdId: "h1", guests: 2 })];
      if (/from "availability_holds"/.test(text)) return [row(availabilityHolds, { id: "h1", tourInstanceId: "i1", quantity: 2, status: holdStatus })];
      if (/from "tour_instances"/.test(text) && withInstance) {
        return [row(tourInstances, { id: "i1", tourId: "t1", serviceDate: "2099-01-01", totalCapacity: 10, confirmedCount: 0, heldCount: 2, blockedCount: 0 })];
      }
      return [];
    };
  };
  const sql = () => pg.calls.map((c) => c.text);
  const instanceUpdates = () => pg.calls.filter((c) => /^update "tour_instances"/.test(c.text));

  it("deleteBooking locks an ACTIVE hold and lowers heldCount by its quantity as it releases it", async () => {
    world("ACTIVE");
    await storage.deleteBooking("b1", false);
    expect(sql().some((t) => /from "availability_holds".* for update/.test(t))).toBe(true);
    const [upd] = instanceUpdates();
    expect(upd.text).toMatch(/"held_count" = GREATEST\(0, "tour_instances"."held_count" - \$1\)/);
    expect(upd.values[0]).toBe(2);
    expect(pg.calls.some((c) => /^update "availability_holds" set "status" = \$1/.test(c.text) && c.values[0] === "RELEASED")).toBe(true);
  });

  it("deleteBooking locks the booking row first, then the hold, then the instance (confirmWithSeats' order)", async () => {
    world("ACTIVE");
    await storage.deleteBooking("b1", false);
    const at = (re: RegExp) => sql().findIndex((t) => re.test(t));
    const booking = at(/from "bookings".* for update/);
    const hold = at(/from "availability_holds".* for update/);
    const instance = at(/^update "tour_instances"/);
    expect(booking).toBeGreaterThanOrEqual(0);
    expect(booking).toBeLessThan(hold);
    expect(hold).toBeLessThan(instance);
  });

  it.each(["RELEASED", "EXPIRED", "CONFIRMED"])("deleteBooking leaves heldCount alone for a %s hold", async (status) => {
    world(status);
    await storage.deleteBooking("b1", false);
    expect(instanceUpdates()).toHaveLength(0);
    expect(pg.calls.some((c) => /^update "availability_holds"/.test(c.text))).toBe(true);
  });

  it("re-reserving a RELEASED hold adds to confirmedCount only, so the seats are not counted twice", async () => {
    world("RELEASED");
    const { db } = await import("./db.js");
    await db.transaction((tx: any) => new AvailabilityService(storage).reserveLapsedHold("h1", tx));
    const [upd] = instanceUpdates();
    expect(upd.text).toMatch(/"confirmed_count" = "tour_instances"."confirmed_count" \+ \$1/);
    expect(upd.text).not.toMatch(/held_count/);
    expect(pg.calls.some((c) => /^update "availability_holds" set "status" = \$1/.test(c.text) && c.values[0] === "CONFIRMED")).toBe(true);
  });
});

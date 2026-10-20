// The storage queries behind statement matching and manual confirmation. Ace's tests have no
// database, so drizzle runs over a fake pg client: each test checks the SQL sent and how the rows
// that come back are used.
import { describe, it, expect, vi, beforeEach } from "vitest";

const pg = vi.hoisted(() => ({ calls: [] as Array<{ text: string; values: unknown[] }>, rows: [] as unknown[][] }));

vi.mock("./db.js", async () => {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const schema = await import("../shared/schema.js");
  const client = {
    query: async (q: any, values?: unknown[]) => {
      const text = typeof q === "string" ? q : q.text;
      pg.calls.push({ text, values: (typeof q === "string" ? values : q.values ?? values) ?? [] });
      return { rows: pg.rows, rowCount: pg.rows.length, command: "SELECT", fields: [] };
    },
  };
  return { db: drizzle(client as any, { schema }) };
});

import { getTableColumns } from "drizzle-orm";
import { bookings } from "../shared/schema.js";
import { storage } from "./storage.js";

/** A bookings row as pg returns it in array mode, in column order. */
const bookingRow = (over: Record<string, unknown>) =>
  Object.keys(getTableColumns(bookings)).map((k) => over[k] ?? (k === "createdAt" || k === "updatedAt" ? "2026-10-19 01:02:03.456" : null));

beforeEach(() => {
  pg.calls = [];
  pg.rows = [];
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

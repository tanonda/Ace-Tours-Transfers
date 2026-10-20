// A bank-transfer booking confirmed by hand (statement match, or admin PATCH to confirmed) must keep
// its seats and must not be cancelled when its payment's 72h expiry passes. Ace's tests have no
// database, so this runs against an in-memory world: storage is a fake over plain rows, and db.transaction
// snapshots the rows and restores them when the callback throws (a rollback). AvailabilityService's
// seat moves are faked on the same rows. The SQL itself is covered by storage.statement-queries.test.ts.
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import request from "supertest";
import express, { Express } from "express";
import session from "express-session";
import { getTableName } from "drizzle-orm";

type Row = Record<string, any>;
const w = vi.hoisted(() => ({
  bookings: new Map<string, Row>(),
  holds: new Map<string, Row>(),
  instances: new Map<string, Row>(),
  payments: new Map<string, Row>(),
  gateways: new Map<string, Row>(),
  blackedOut: new Set<string>(),
  locks: [] as string[],
  /** Throw this (not a seat problem) when confirming the given hold. */
  crashOn: null as string | null,
}));

/** Every bound value in a drizzle condition (eq / or / inArray), to pick the fake rows it names. */
const params = (x: any, out: unknown[] = []): unknown[] => {
  if (Array.isArray(x)) x.forEach((c) => params(c, out));
  else if (x && Array.isArray(x.queryChunks)) params(x.queryChunks, out);
  else if (x && x.constructor?.name === "Param") out.push(x.value);
  return out;
};

vi.mock("../db.js", () => {
  const tables: Record<string, () => Map<string, Row>> = {
    bookings: () => w.bookings, availability_holds: () => w.holds, tour_instances: () => w.instances,
  };
  const tx = {
    select: () => ({
      from: (table: any) => {
        const name = getTableName(table);
        let wanted: unknown[] = [];
        const chain = {
          where: (cond: unknown) => { wanted = params(cond); return chain; },
          orderBy: () => chain,
          for: async () => {
            w.locks.push(name);
            return [...tables[name]().values()]
              .filter((r) => wanted.includes(r.id) || (name === "availability_holds" && wanted.includes(r.bookingSessionId)))
              .sort((a, b) => String(a.id).localeCompare(String(b.id)))
              .map((r) => ({ ...r }));
          },
        };
        return chain;
      },
    }),
  };
  const snapshot = () => [w.bookings, w.holds, w.instances, w.payments].map((m) => new Map([...m].map(([k, v]) => [k, { ...v }])));
  const restore = (s: Map<string, Row>[]) => {
    [w.bookings, w.holds, w.instances, w.payments].forEach((m, i) => { m.clear(); s[i].forEach((v, k) => m.set(k, v)); });
  };
  return {
    db: {
      transaction: async (fn: (t: unknown) => Promise<unknown>) => {
        const s = snapshot();
        try { return await fn(tx); } catch (err) { restore(s); throw err; }
      },
    },
  };
});

vi.mock("express-rate-limit", () => ({ rateLimit: () => (_q: any, _s: any, n: any) => n(), default: () => (_q: any, _s: any, n: any) => n() }));
vi.mock("../infrastructure/audit/admin-audit-log.service.js", () => ({ adminAudit: { log: vi.fn(async () => undefined) } }));
vi.mock("../lib/mail.js", async (orig) => ({ ...(await orig<any>()), sendEmail: vi.fn(async () => true), sendAdminEmail: vi.fn(async () => true) }));
vi.mock("../lib/review-request.js", () => ({ sendReviewRequest: vi.fn(async () => true) }));
const notify = vi.hoisted(() => ({ email: [] as string[], sms: [] as string[], admin: [] as string[] }));
vi.mock("../infrastructure/mailing/MailingService.js", () => ({
  mailingService: { sendPaymentExpiry: vi.fn(async (_to: string, id: string) => { notify.email.push(id); }), sendPaymentFailure: vi.fn(async () => undefined) },
}));
vi.mock("../infrastructure/sms/SmsService.js", () => ({ smsService: { sendPaymentExpiry: vi.fn(async (_to: string, ref: string) => { notify.sms.push(ref); }) } }));

vi.mock("../storage.js", () => {
  const OPEN = ["pending", "processing", "manual_review_required"];
  const storage = {
    getUser: async (id: string) => ({ id, role: "admin", isActive: true }),
    getBooking: async (id: string) => (w.bookings.has(id) ? { ...w.bookings.get(id) } : undefined),
    getBookingByHoldId: async (holdId: string) => [...w.bookings.values()].find((b) => b.holdId === holdId),
    getBookingsBySession: async (sid: string) => [...w.bookings.values()].filter((b) => b.bookingSessionId === sid),
    updateBooking: async (id: string, updates: Row) => {
      const b = Object.assign(w.bookings.get(id)!, updates, { updatedAt: new Date(Date.now() + 1000) });
      return { ...b };
    },
    confirmPendingBookingIfUnchanged: async (id: string, expected: Date) => {
      const b = w.bookings.get(id);
      if (!b || b.status !== "pending" || b.updatedAt.getTime() !== expected.getTime()) return undefined;
      Object.assign(b, { status: "confirmed", confirmedAt: new Date(), updatedAt: new Date(Date.now() + 1000) });
      return { ...b };
    },
    expireBookingIfPending: async (id: string) => {
      const b = w.bookings.get(id);
      if (!b || b.status !== "pending") return undefined;
      b.status = "expired";
      return { ...b };
    },
    getPaymentsByBooking: async (id: string) => [...w.payments.values()].filter((p) => p.bookingId === id).map((p) => ({ ...p })),
    getPayment: async (id: string) => (w.payments.has(id) ? { ...w.payments.get(id) } : undefined),
    getPaymentGateway: async (id: string) => w.gateways.get(id),
    updatePayment: async (id: string, updates: Row) => Object.assign(w.payments.get(id)!, updates),
    // As the SQL does: open, past expiry, and never a paid (confirmed or completed) booking's.
    getOverduePayments: async () => [...w.payments.values()].filter((p) =>
      (p.status === "pending" || p.status === "manual_review_required") && p.expiresAt < new Date()
      && !["confirmed", "completed"].includes(w.bookings.get(p.bookingId)?.status)),
    createNotification: async (n: Row) => { notify.admin.push(n.message); return n; },
    getHoldsBySession: async (sid: string) => [...w.holds.values()].filter((h) => h.bookingSessionId === sid && h.status === "ACTIVE"),
    getExpiredHolds: async (now: Date) => [...w.holds.values()].filter((h) => h.status === "ACTIVE" && h.expiresAt < now),
    getBookingItems: async () => [],
    getProduct: async () => undefined,
    isBlackedOut: async (productId: string, date: string) => w.blackedOut.has(`${productId}:${date}`),
  };
  return { storage };
});

import { storage } from "../storage.js";
import { AvailabilityService, HoldStatus, LapsedHoldUnavailableError } from "../domain/availability/availability.service.js";
import { holdCountsForBooking } from "../lib/manual-confirmation.js";
import { eventDispatcher } from "../infrastructure/events/event-dispatcher.js";
import { PaymentExpired } from "../domain/events.js";

const free = (i: Row) => i.totalCapacity - (i.confirmedCount + i.heldCount + i.blockedCount);

// The seat moves AvailabilityService makes, on the fake rows.
beforeAll(() => {
  vi.spyOn(AvailabilityService.prototype, "confirmBooking").mockImplementation(async (holdId: string) => {
    if (w.crashOn === holdId) throw new Error("connection reset");
    const h = w.holds.get(holdId)!;
    if (h.status === HoldStatus.CONFIRMED) return;
    if (h.status !== HoldStatus.ACTIVE) throw new Error(`Cannot confirm hold in status: ${h.status}`);
    const i = w.instances.get(h.tourInstanceId)!;
    i.heldCount -= h.quantity; i.confirmedCount += h.quantity; h.status = HoldStatus.CONFIRMED;
  });
  vi.spyOn(AvailabilityService.prototype, "reserveLapsedHold").mockImplementation(async (holdId: string) => {
    const h = w.holds.get(holdId)!;
    const i = w.instances.get(h.tourInstanceId)!;
    if (w.blackedOut.has(`${i.tourId}:${i.serviceDate}`)) throw new LapsedHoldUnavailableError("blackout", "blackout");
    if (free(i) < h.quantity) throw new LapsedHoldUnavailableError("capacity", "full");
    i.confirmedCount += h.quantity; h.status = HoldStatus.CONFIRMED;
  });
  vi.spyOn(AvailabilityService.prototype, "releaseHold").mockImplementation(async (holdId: string, status: HoldStatus = HoldStatus.RELEASED) => {
    const h = w.holds.get(holdId);
    if (!h || h.status !== HoldStatus.ACTIVE) return false;
    w.instances.get(h.tourInstanceId)!.heldCount -= h.quantity;
    h.status = status;
    return true;
  });
});

// The guest and admin notifications of an expiry, as the app registers them.
const expiredEvents: string[] = [];
beforeAll(async () => {
  const { BookingEventHandler } = await import("../application/events/BookingEventHandler.js");
  const { GuestNotificationHandler } = await import("../application/events/GuestNotificationHandler.js");
  const { AdminNotificationHandler } = await import("../application/events/AdminNotificationHandler.js");
  const { AvailabilityApplicationService } = await import("../application/availability/availability.application-service.js");
  new BookingEventHandler(storage, new AvailabilityApplicationService(storage)).register();
  new GuestNotificationHandler(storage).register();
  new AdminNotificationHandler(storage).register();
  eventDispatcher.subscribe(PaymentExpired, async (e: PaymentExpired) => { expiredEvents.push(e.bookingId); });
});
const settle = () => new Promise((r) => setTimeout(r, 20)); // PaymentIntent.fail dispatches without awaiting

let app: Express;
beforeAll(async () => {
  const { registerReportingRoutes } = await import("./reporting.routes.js");
  const { registerBookingsRoutes } = await import("./bookings.routes.js");
  app = express();
  app.use(express.json());
  app.use(session({ secret: "test", resave: false, saveUninitialized: true }));
  app.use((req, _res, next) => { (req.session as any).userId = "admin1"; (req.session as any).userRole = "admin"; next(); });
  registerReportingRoutes(app);
  registerBookingsRoutes(app, { bookingApplicationService: {} as any, availabilityAppService: {} as any, sseClients: [] });
});

const HOUR = 3600_000;
let n = 0;
beforeEach(() => {
  [w.bookings, w.holds, w.instances, w.payments, w.gateways].forEach((m) => m.clear());
  w.blackedOut.clear();
  w.locks.length = 0;
  w.crashOn = null;
  expiredEvents.length = 0;
  notify.email.length = 0; notify.sms.length = 0; notify.admin.length = 0;
  w.gateways.set("gw-bank", { id: "gw-bank", slug: "manual_transfer" });
});

/**
 * A pending bank-transfer booking as checkout leaves it: one hold per seat spec (the first is its
 * holdId, the rest its session's), each on its own tour instance, and a manual_review_required
 * payment that expires in 72h.
 */
function bankTransferBooking(holds: Array<{ status?: string; quantity?: number; capacity?: number; confirmed?: number }> = [{}]) {
  const k = ++n;
  const bookingId = `b${k}`;
  const sessionId = `s${k}`;
  const holdIds = holds.map((spec, j) => {
    const holdId = `h${k}-${j}`;
    const quantity = spec.quantity ?? 2;
    const status = spec.status ?? "ACTIVE";
    w.instances.set(`i${k}-${j}`, {
      id: `i${k}-${j}`, tourId: "tour1", serviceDate: "2099-01-01", totalCapacity: spec.capacity ?? 10,
      confirmedCount: spec.confirmed ?? 0, heldCount: status === "ACTIVE" ? quantity : 0, blockedCount: 0,
    });
    w.holds.set(holdId, { id: holdId, tourInstanceId: `i${k}-${j}`, quantity, status, bookingSessionId: sessionId, expiresAt: new Date(Date.now() + 72 * HOUR) });
    return holdId;
  });
  w.bookings.set(bookingId, {
    id: bookingId, status: "pending", holdId: holdIds[0] ?? null, bookingSessionId: sessionId, totalAmountCents: 10000,
    customerName: "Bank Guest", customerEmail: "guest@example.com", customerPhone: "+678 5550000", updatedAt: new Date("2026-10-19T01:02:03.456Z"), notes: null,
  });
  w.payments.set(`p${k}`, { id: `p${k}`, bookingId, gatewayId: "gw-bank", amount: 10000, currency: "VUV", status: "manual_review_required", expiresAt: new Date(Date.now() + 72 * HOUR) });
  return { bookingId, holdIds, paymentId: `p${k}`, instanceIds: holdIds.map((_, j) => `i${k}-${j}`) };
}

const statementConfirm = (bookingId: string, expectedUpdatedAt = w.bookings.get(bookingId)!.updatedAt.toISOString()) =>
  request(app).post(`/api/admin/statement-matches/${bookingId}/confirm`).send({ expectedUpdatedAt, statementAmount: 10000 });
const patchConfirm = (bookingId: string) => request(app).patch(`/api/bookings/${bookingId}`).send({ status: "confirmed" });

/** 72 hours later: the payment and holds are past expiry; the saga (every 5 min) and the hold-expiry job run. */
async function advancePastExpiry(b: { paymentId: string; holdIds: string[] }) {
  w.payments.get(b.paymentId)!.expiresAt = new Date(Date.now() - 60_000);
  for (const id of b.holdIds) w.holds.get(id)!.expiresAt = new Date(Date.now() - 60_000);
  const { BankTransferReconciliationSaga } = await import("../application/sagas/BankTransferReconciliationSaga.js");
  const { HoldExpiryJob } = await import("../infrastructure/jobs/hold-expiry.job.js");
  await new BankTransferReconciliationSaga(storage).checkAndExpireOverduePayments();
  const run = await new HoldExpiryJob(storage).run();
  await settle();
  return run;
}

const state = (b: { bookingId: string; holdIds: string[]; paymentId: string; instanceIds: string[] }) => ({
  booking: w.bookings.get(b.bookingId)!.status,
  holds: b.holdIds.map((id) => w.holds.get(id)!.status),
  payment: w.payments.get(b.paymentId)!.status,
  seats: b.instanceIds.map((id) => ({ confirmed: w.instances.get(id)!.confirmedCount, held: w.instances.get(id)!.heldCount })),
});

describe("a booking confirmed by hand survives its payment's expiry", () => {
  it("statement confirm, then a saga run past expiresAt: booking and holds stay confirmed, payment completed", async () => {
    const b = bankTransferBooking([{}, {}]);
    expect((await statementConfirm(b.bookingId)).status).toBe(200);
    const confirmed = { booking: "confirmed", holds: ["CONFIRMED", "CONFIRMED"], payment: "completed", seats: [{ confirmed: 2, held: 0 }, { confirmed: 2, held: 0 }] };
    expect(state(b)).toEqual(confirmed);

    await advancePastExpiry(b);
    expect(state(b)).toEqual(confirmed);
  });

  it("admin PATCH pending -> confirmed, then a saga run past expiresAt: the same", async () => {
    const b = bankTransferBooking();
    expect((await patchConfirm(b.bookingId)).status).toBe(200);
    const confirmed = { booking: "confirmed", holds: ["CONFIRMED"], payment: "completed", seats: [{ confirmed: 2, held: 0 }] };
    expect(state(b)).toEqual(confirmed);

    await advancePastExpiry(b);
    expect(state(b)).toEqual(confirmed);
  });

  it("an unpaid pending booking still expires: cancelled, payment expired, seats freed", async () => {
    const b = bankTransferBooking();
    await advancePastExpiry(b);
    const s = state(b);
    expect(s.booking).toBe("cancelled");
    expect(s.payment).toBe("expired");
    expect(s.holds).toEqual(["RELEASED"]);
    expect(s.seats).toEqual([{ confirmed: 0, held: 0 }]);
    expect(expiredEvents).toEqual([b.bookingId]);
    expect(notify.email).toEqual([b.bookingId]);
    expect(notify.sms).toHaveLength(1);
    expect(notify.admin).toHaveLength(1);
  });

  it("a lapsed booking the hold job already marked expired still gets the saga's expiry: payment closed, guest and admin told", async () => {
    const b = bankTransferBooking();
    // The hold lapses first (15-minute holds in practice): the job releases it and marks the booking expired.
    w.holds.get(b.holdIds[0])!.expiresAt = new Date(Date.now() - 60_000);
    const { HoldExpiryJob } = await import("../infrastructure/jobs/hold-expiry.job.js");
    await new HoldExpiryJob(storage).run();
    expect(state(b)).toMatchObject({ booking: "expired", holds: ["EXPIRED"], payment: "manual_review_required" });

    // 72h later the payment's deadline passes and the saga runs.
    w.payments.get(b.paymentId)!.expiresAt = new Date(Date.now() - 60_000);
    const { BankTransferReconciliationSaga } = await import("../application/sagas/BankTransferReconciliationSaga.js");
    await new BankTransferReconciliationSaga(storage).checkAndExpireOverduePayments();
    await settle();
    expect(state(b)).toMatchObject({ booking: "cancelled", payment: "expired", seats: [{ confirmed: 0, held: 0 }] });
    expect(expiredEvents).toEqual([b.bookingId]);
    expect(notify.email).toEqual([b.bookingId]);
    expect(notify.sms).toHaveLength(1);
    expect(notify.admin).toHaveLength(1);
  });

  it("a confirmed booking past its payment deadline is untouched and nobody is told it expired", async () => {
    const b = bankTransferBooking();
    expect((await statementConfirm(b.bookingId)).status).toBe(200);
    w.payments.get(b.paymentId)!.status = "manual_review_required"; // as if left open
    await advancePastExpiry(b);
    expect(state(b)).toMatchObject({ booking: "confirmed", holds: ["CONFIRMED"], payment: "manual_review_required" });
    expect(expiredEvents).toEqual([]);
    expect(notify).toEqual({ email: [], sms: [], admin: [] });
  });

  it("defence in depth: a confirmed booking whose payment was left open (as before this fix) is not expired", async () => {
    const b = bankTransferBooking();
    w.bookings.get(b.bookingId)!.status = "confirmed";
    w.payments.get(b.paymentId)!.expiresAt = new Date(Date.now() - 60_000);
    const { PaymentApplicationService } = await import("../application/payment.application-service.js");
    const { BookingConfirmationService } = await import("../application/booking/BookingConfirmationService.js");
    await new PaymentApplicationService(storage).expirePayment(b.paymentId);
    await new BookingConfirmationService(storage).cancelBooking(b.bookingId, "payment_expired");
    expect(state(b)).toMatchObject({ booking: "confirmed", payment: "manual_review_required", holds: ["ACTIVE"] });

    // The hold-expiry job never frees a confirmed booking's seats either.
    w.holds.get(b.holdIds[0])!.expiresAt = new Date(Date.now() - 60_000);
    const { HoldExpiryJob } = await import("../infrastructure/jobs/hold-expiry.job.js");
    expect(await new HoldExpiryJob(storage).run()).toEqual({ expired: 0, failed: 0 });
    expect(state(b)).toMatchObject({ booking: "confirmed", holds: ["ACTIVE"], seats: [{ confirmed: 0, held: 2 }] });
  });
});

describe("seats are reserved in the transaction of the confirm", () => {
  it("locks the booking, then its holds, then their tour instances", async () => {
    const b = bankTransferBooking([{}, {}]);
    expect((await statementConfirm(b.bookingId)).status).toBe(200);
    expect(w.locks).toEqual(["bookings", "availability_holds", "tour_instances"]);
  });

  it("a hold that can't be had mid-loop leaves the booking pending and the earlier hold as it was (409)", async () => {
    // Two holds in the session; the second (by id) is the booking's own holdId, which lapsed, and its
    // tour has filled up since. The first is confirmed in the loop, then the second fails.
    const b = bankTransferBooking([{}, { status: "EXPIRED", capacity: 4, confirmed: 4 }]);
    w.bookings.get(b.bookingId)!.holdId = b.holdIds[1];
    for (const res of [await statementConfirm(b.bookingId), await patchConfirm(b.bookingId)]) {
      expect(res.status).toBe(409);
      expect(res.body.error).toBe("Couldn't reserve the seats for this booking. Check availability and try again.");
      expect(AvailabilityService.prototype.confirmBooking).toHaveBeenCalledWith(b.holdIds[0], expect.anything());
      expect(state(b)).toEqual({
        booking: "pending", holds: ["ACTIVE", "EXPIRED"], payment: "manual_review_required",
        seats: [{ confirmed: 0, held: 2 }, { confirmed: 4, held: 0 }],
      });
    }
  });

  it("a lapsed hold of the booking's own is re-reserved when the tour has room", async () => {
    const b = bankTransferBooking([{ status: "EXPIRED" }]);
    expect((await patchConfirm(b.bookingId)).status).toBe(200);
    expect(state(b)).toMatchObject({ booking: "confirmed", holds: ["CONFIRMED"], seats: [{ confirmed: 2, held: 0 }] });
  });

  it("a lapsed hold on a blacked-out date is refused (409) and the booking stays pending", async () => {
    const b = bankTransferBooking([{ status: "EXPIRED" }]);
    w.blackedOut.add("tour1:2099-01-01");
    expect((await statementConfirm(b.bookingId)).status).toBe(409);
    expect(state(b)).toMatchObject({ booking: "pending", holds: ["EXPIRED"], seats: [{ confirmed: 0, held: 0 }] });
  });

  it("a stale expectedUpdatedAt after the holds were reserved rolls everything back (409)", async () => {
    const b = bankTransferBooking([{}, {}]);
    const res = await statementConfirm(b.bookingId, new Date(w.bookings.get(b.bookingId)!.updatedAt.getTime() - 1).toISOString());
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/changed after the statement was matched/);
    expect(AvailabilityService.prototype.confirmBooking).toHaveBeenCalled(); // the holds were reserved, then undone
    expect(state(b)).toEqual({
      booking: "pending", holds: ["ACTIVE", "ACTIVE"], payment: "manual_review_required",
      seats: [{ confirmed: 0, held: 2 }, { confirmed: 0, held: 2 }],
    });
  });

  it("an error that is not about seats is a 500, not the seats message, and rolls back", async () => {
    const b = bankTransferBooking([{}, {}]);
    w.crashOn = b.holdIds[1];
    const res = await statementConfirm(b.bookingId);
    expect(res.status).toBe(500);
    expect(state(b)).toMatchObject({ booking: "pending", holds: ["ACTIVE", "ACTIVE"] });
  });

  it("a later item's lapsed hold (a session hold, not the holdId) is re-reserved when its tour has room", async () => {
    const b = bankTransferBooking([{}, { status: "EXPIRED" }]);
    expect((await patchConfirm(b.bookingId)).status).toBe(200);
    expect(state(b)).toMatchObject({ booking: "confirmed", holds: ["CONFIRMED", "CONFIRMED"], seats: [{ confirmed: 2, held: 0 }, { confirmed: 2, held: 0 }] });
  });

  it("a later item's lapsed hold on a full tour refuses the confirm (409) and nothing changes", async () => {
    const b = bankTransferBooking([{}, { status: "EXPIRED", capacity: 4, confirmed: 3 }]);
    for (const res of [await statementConfirm(b.bookingId), await patchConfirm(b.bookingId)]) {
      expect(res.status).toBe(409);
      expect(res.body.error).toBe("Couldn't reserve the seats for this booking. Check availability and try again.");
      expect(state(b)).toEqual({
        booking: "pending", holds: ["ACTIVE", "EXPIRED"], payment: "manual_review_required",
        seats: [{ confirmed: 0, held: 2 }, { confirmed: 3, held: 0 }],
      });
    }
  });

  it("an open card payment is never completed by a manual confirm", async () => {
    const b = bankTransferBooking();
    w.gateways.set("gw-card", { id: "gw-card", slug: "payzen" });
    Object.assign(w.payments.get(b.paymentId)!, { gatewayId: "gw-card", status: "manual_review_required" });
    const warn = vi.spyOn(console, "warn");
    expect((await patchConfirm(b.bookingId)).status).toBe(200);
    expect(state(b)).toMatchObject({ booking: "confirmed", holds: ["CONFIRMED"], payment: "manual_review_required" });
    expect(warn.mock.calls.some(([m]) => String(m).includes("open card payment"))).toBe(true);
    warn.mockRestore();
  });

  it("an unexpected error in the admin PATCH is a 500, not a 400", async () => {
    const b = bankTransferBooking();
    w.crashOn = b.holdIds[0];
    const res = await patchConfirm(b.bookingId);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Failed to update booking");
    expect(state(b)).toMatchObject({ booking: "pending", holds: ["ACTIVE"] });
  });

  it("a booking sharing its session confirms only its own hold, never a sibling's", async () => {
    const a = bankTransferBooking([{}]);
    // A second booking in the same session, with its own hold.
    const sid = w.bookings.get(a.bookingId)!.bookingSessionId;
    w.instances.set("i-sib", { id: "i-sib", tourId: "tour1", serviceDate: "2099-01-01", totalCapacity: 10, confirmedCount: 0, heldCount: 1, blockedCount: 0 });
    w.holds.set("h-sib", { id: "h-sib", tourInstanceId: "i-sib", quantity: 1, status: "ACTIVE", bookingSessionId: sid, expiresAt: new Date(Date.now() + HOUR) });
    w.bookings.set("b-sib", { id: "b-sib", status: "pending", holdId: "h-sib", bookingSessionId: sid, updatedAt: new Date() });
    expect((await patchConfirm(a.bookingId)).status).toBe(200);
    expect(w.holds.get(a.holdIds[0])!.status).toBe("CONFIRMED");
    expect(w.holds.get("h-sib")!.status).toBe("ACTIVE");
  });
});

describe("holdCountsForBooking", () => {
  const booking = { holdId: "own", bookingSessionId: "s1" };
  const hold = (id: string, status: string, bookingSessionId = "s1") => ({ id, status, bookingSessionId });
  it("counts ACTIVE, CONFIRMED and EXPIRED holds of the booking, never RELEASED ones", () => {
    expect(holdCountsForBooking(hold("own", "ACTIVE"), booking, false)).toBe(true);
    expect(holdCountsForBooking(hold("own", "CONFIRMED"), booking, false)).toBe(true);
    expect(holdCountsForBooking(hold("own", "EXPIRED"), booking, false)).toBe(true);
    expect(holdCountsForBooking(hold("own", "RELEASED"), booking, true)).toBe(false);
    expect(holdCountsForBooking(hold("other", "ACTIVE"), booking, true)).toBe(true);
    expect(holdCountsForBooking(hold("other", "EXPIRED"), booking, true)).toBe(true);
    expect(holdCountsForBooking(hold("other", "RELEASED"), booking, true)).toBe(false);
  });
  it("counts session holds only when the booking is alone in its session", () => {
    expect(holdCountsForBooking(hold("other", "ACTIVE"), booking, false)).toBe(false);
    expect(holdCountsForBooking(hold("other", "ACTIVE", "s2"), booking, true)).toBe(false);
  });
});

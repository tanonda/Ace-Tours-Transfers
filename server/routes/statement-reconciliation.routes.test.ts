// Statement reconciliation never confirms by itself: uploads give suggestions and needs-review lines,
// and an admin confirms each suggestion (compare-and-set, audited, through the admin confirm path).
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import request from "supertest";
import express, { Express } from "express";
import session from "express-session";

const A_ID = "1234abcd-0000-4000-8000-000000000001";
const UPDATED = new Date("2026-10-19T01:02:03.456Z");
const fx = vi.hoisted(() => ({ booking: null as any }));
const auditLog = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("../infrastructure/audit/admin-audit-log.service.js", () => ({ adminAudit: { log: auditLog } }));
vi.mock("../lib/mail.js", async (orig) => ({ ...(await orig<any>()), sendEmail: vi.fn(async () => true), sendAdminEmail: vi.fn(async () => true) }));
vi.mock("../lib/review-request.js", () => ({ sendReviewRequest: vi.fn(async () => true) }));
// The seat reservation is a database transaction, tested in manual-confirm.test.ts.
vi.mock("../lib/manual-confirmation.js", async (orig) => ({ ...(await orig<any>()), confirmWithSeats: async (_s: unknown, _b: unknown, write: (tx: unknown) => unknown) => write(undefined) }));
vi.mock("../storage.js", () => ({
  storage: {
    getUser: vi.fn(async (id: string) => ({ id, role: id === "admin1" ? "admin" : "customer", isActive: true })),
    getPendingOfflineBookings: vi.fn(async () => [fx.booking]),
    getBooking: vi.fn(async (id: string) => (id === fx.booking.id ? { ...fx.booking } : undefined)),
    updateBooking: vi.fn(),
    confirmPendingBookingIfUnchanged: vi.fn(async (id: string, expected: Date) => {
      const b = fx.booking;
      if (b.id !== id || b.status !== "pending" || b.updatedAt.getTime() !== expected.getTime()) return undefined;
      Object.assign(b, { status: "confirmed", updatedAt: new Date(b.updatedAt.getTime() + 1000) });
      return { ...b };
    }),
    getBookingItems: vi.fn(async () => []),
    getPaymentsByBooking: vi.fn(async () => []),
    getProduct: vi.fn(async () => undefined),
  },
}));

import { storage } from "../storage.js";

let app: Express;
beforeAll(async () => {
  const { registerReportingRoutes } = await import("./reporting.routes.js");
  app = express();
  app.use(express.json());
  app.use(session({ secret: "test", resave: false, saveUninitialized: true }));
  app.use((req, _res, next) => {
    (req.session as any).userId = req.get("x-test-user") ?? "admin1";
    (req.session as any).userRole = req.get("x-test-user") ? "customer" : "admin";
    next();
  });
  registerReportingRoutes(app);
});

beforeEach(() => {
  fx.booking = {
    id: A_ID, status: "pending", totalAmountCents: 13000, updatedAt: new Date(UPDATED),
    customerName: "Ana", customerEmail: "", tourId: "t1", tourName: "T",
  };
  auditLog.mockClear();
  (storage.updateBooking as any).mockClear();
  (storage.confirmPendingBookingIfUnchanged as any).mockClear();
});

const upload = (csv: string, name = "statement.csv", contentType = "text/csv") =>
  request(app).post("/api/admin/reconciliation/statement").attach("statement", Buffer.from(csv), { filename: name, contentType });

describe("POST /api/admin/reconciliation/statement", () => {
  it("accepts a CSV file (text/csv and Excel's CSV type)", async () => {
    expect((await upload("Date,Description,Amount\n")).status).toBe(200);
    expect((await upload("Date,Description,Amount\n", "statement.csv", "application/vnd.ms-excel")).status).toBe(200);
    expect((await upload("Date,Description,Amount\n", "statement.txt", "text/plain")).status).toBe(200);
  });

  it("rejects an image or an oversized file with 400", async () => {
    const png = await upload("not really", "photo.png", "image/png");
    expect(png.status).toBe(400);
    const big = await upload("x".repeat(1024 * 1024 + 1));
    expect(big.status).toBe(400);
  });

  it("an amount in the description, with a short credit, is needs review and confirms nothing", async () => {
    const res = await upload("Date,Description,Amount\n2026-10-01,REF 1234ABCD 13000,500\n");
    expect(res.status).toBe(200);
    expect(res.body.suggestions).toEqual([]);
    expect(res.body.needsReview).toEqual([expect.objectContaining({ bookingId: A_ID, statementAmount: 500, reason: "amount_mismatch" })]);
    expect(storage.updateBooking).not.toHaveBeenCalled();
    expect(fx.booking.status).toBe("pending");
    expect(storage.confirmPendingBookingIfUnchanged).not.toHaveBeenCalled();
  });

  it("an exact amount in the amount column is a suggestion; the booking stays pending", async () => {
    const res = await upload("Date,Description,Amount\n2026-10-01,ACT-1234ABCD,13000\n");
    expect(res.body.suggestions).toEqual([expect.objectContaining({ bookingId: A_ID, statementAmount: 13000, updatedAt: UPDATED.toISOString() })]);
    expect(storage.updateBooking).not.toHaveBeenCalled();
    expect(fx.booking.status).toBe("pending");
    expect(storage.confirmPendingBookingIfUnchanged).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/statement-matches/:bookingId/confirm", () => {
  const confirm = (body: unknown) => request(app).post(`/api/admin/statement-matches/${A_ID}/confirm`).send(body as object);

  it("nothing is confirmed until the admin confirms: upload, then confirm a fresh suggestion, which is audited", async () => {
    const up = await upload("Date,Description,Amount\n2026-10-01,ACT-1234ABCD,13000\n");
    expect(fx.booking.status).toBe("pending");
    const res = await confirm({ expectedUpdatedAt: up.body.suggestions[0].updatedAt, statementAmount: 13000 });
    expect(res.status).toBe(200);
    expect(fx.booking.status).toBe("confirmed");
    expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "booking.statement_confirm", entityType: "booking", entityId: A_ID, performedBy: "admin1" }));
  });

  it("is admin-only", async () => {
    const res = await request(app).post(`/api/admin/statement-matches/${A_ID}/confirm`).set("x-test-user", "guest1").send({ expectedUpdatedAt: UPDATED.toISOString() });
    expect(res.status).toBe(403);
    expect(fx.booking.status).toBe("pending");
  });

  it("a stale expectedUpdatedAt gives 409 and changes nothing", async () => {
    const res = await confirm({ expectedUpdatedAt: new Date(UPDATED.getTime() - 1).toISOString() });
    expect(res.status).toBe(409);
    expect(fx.booking.status).toBe("pending");
    expect(auditLog).not.toHaveBeenCalled();
  });

  it("a booking that is no longer pending gives 409; a missing or bad timestamp gives 400; an unknown booking 404", async () => {
    expect((await confirm({})).status).toBe(400);
    expect((await confirm({ expectedUpdatedAt: "yesterday" })).status).toBe(400);
    fx.booking.status = "cancelled";
    expect((await confirm({ expectedUpdatedAt: UPDATED.toISOString() })).status).toBe(409);
    const res = await request(app).post(`/api/admin/statement-matches/nope/confirm`).send({ expectedUpdatedAt: UPDATED.toISOString() });
    expect(res.status).toBe(404);
  });
});

describe("statement candidates", () => {
  it("the upload and the admin page both take their candidates from getPendingOfflineBookings", async () => {
    (storage.getPendingOfflineBookings as any).mockClear();
    await upload("Date,Description,Amount\n");
    expect(storage.getPendingOfflineBookings).toHaveBeenCalledTimes(1);
    const res = await request(app).get("/api/admin/statement-matches/candidates");
    expect(res.status).toBe(200);
    expect(res.body.map((b: any) => b.id)).toEqual([A_ID]);
    expect((await request(app).get("/api/admin/statement-matches/candidates").set("x-test-user", "guest1")).status).toBe(403);
  });
});

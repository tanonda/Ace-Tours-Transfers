// server/routes/booking-completion-review.test.ts
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import request from "supertest";
import express, { Express } from "express";
import session from "express-session";

const BK = "11111111-1111-4111-8111-111111111111";
const fx = vi.hoisted(() => ({ status: "confirmed" }));
const sendReviewRequest = vi.hoisted(() => vi.fn());
const sendEmail = vi.hoisted(() => vi.fn(async () => true));

vi.mock("express-rate-limit", () => ({ rateLimit: () => (_q: any, _s: any, n: any) => n(), default: () => (_q: any, _s: any, n: any) => n() }));
vi.mock("../lib/review-request.js", () => ({ sendReviewRequest }));
vi.mock("../lib/mail.js", async (orig) => ({ ...(await orig<any>()), sendEmail, sendAdminEmail: vi.fn(async () => true) }));
vi.mock("../storage.js", () => ({
  storage: new Proxy({} as Record<string, unknown>, {
    get: (t, key: string) => (t[key] ??= vi.fn(async (id?: unknown, updates?: any) => {
      const base = { id: BK, customerEmail: "a@example.com", customerName: "A B", totalAmountCents: 1, tourId: "t1", tourName: "T" };
      if (key === "getUser") return { id, role: "admin", isActive: true };
      if (key === "getBooking") return { ...base, status: fx.status };
      if (key === "updateBooking") return { ...base, ...updates };
      if (key === "getBookingItems" || key === "getPaymentsByBooking" || key === "getHoldsBySession") return [];
      return undefined;
    })),
  }),
}));

let app: Express;
beforeAll(async () => {
  const { registerBookingsRoutes } = await import("./bookings.routes.js");
  app = express();
  app.use(express.json());
  app.use(session({ secret: "test", resave: false, saveUninitialized: true }));
  app.use((req, _res, next) => { (req.session as any).userId = "admin1"; (req.session as any).userRole = "admin"; next(); });
  registerBookingsRoutes(app, { bookingApplicationService: {} as any, availabilityAppService: {} as any, sseClients: [] });
});

beforeEach(() => {
  sendReviewRequest.mockReset().mockResolvedValue(true);
  sendEmail.mockClear();
});

describe("completing a booking", () => {
  it("sends the review request instead of the generic status email", async () => {
    fx.status = "confirmed";
    const res = await request(app).patch(`/api/bookings/${BK}`).send({ status: "completed" });
    expect(res.status).toBe(200);
    expect(sendReviewRequest).toHaveBeenCalledTimes(1);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("still succeeds when the review email throws", async () => {
    fx.status = "confirmed";
    sendReviewRequest.mockRejectedValue(new Error("smtp down"));
    const res = await request(app).patch(`/api/bookings/${BK}`).send({ status: "completed" });
    expect(res.status).toBe(200);
  });

  it("does not send a review request for other transitions", async () => {
    fx.status = "pending";
    const res = await request(app).patch(`/api/bookings/${BK}`).send({ status: "confirmed" });
    expect(res.status).toBe(200);
    expect(sendReviewRequest).not.toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});

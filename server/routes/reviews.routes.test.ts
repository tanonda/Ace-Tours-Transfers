// server/routes/reviews.routes.test.ts
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import request from "supertest";
import express, { Express } from "express";
import session from "express-session";
import { signReviewToken } from "../lib/review-token.js";

// Rate limits are covered by express-rate-limit itself; keep them out of the way here.
vi.mock("express-rate-limit", () => ({ rateLimit: () => (_q: any, _s: any, n: any) => n(), default: () => (_q: any, _s: any, n: any) => n() }));
vi.mock("../lib/mail.js", () => ({ sendAdminEmail: vi.fn(async () => true), sendEmail: vi.fn(async () => true) }));

const sendReviewRequest = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../lib/review-request.js", () => ({ sendReviewRequest }));
vi.mock("../infrastructure/audit/admin-audit-log.service.js", () => ({ adminAudit: { log: vi.fn(async () => {}) } }));

const BK = "11111111-1111-4111-8111-111111111111";
const fx = vi.hoisted(() => ({
  booking: null as any,
  items: [] as any[],
  reviewed: [] as string[],
  inserted: [] as any[],
  allReviews: [] as any[],
}));
vi.mock("../storage.js", () => ({
  storage: {
    getBooking: vi.fn(async (id: string) => (fx.booking && id === fx.booking.id ? fx.booking : undefined)),
    getBookingItems: vi.fn(async () => fx.items),
    getReviewedProductIds: vi.fn(async () => fx.reviewed),
    createVerifiedReview: vi.fn(async (d: any) => {
      if (fx.reviewed.includes(d.tourId)) return null;
      fx.reviewed.push(d.tourId);
      fx.inserted.push(d);
      return { id: "r1", ...d };
    }),
    getAllReviews: vi.fn(async () => fx.allReviews),
    getUser: vi.fn(async (id: string) => ({ id, role: id === "admin1" ? "admin" : "customer", isActive: true })),
  },
}));

let app: Express;
beforeAll(async () => {
  const { registerReviewRoutes } = await import("./reviews.routes.js");
  app = express();
  app.use(express.json());
  app.use(session({ secret: "test", resave: false, saveUninitialized: true }));
  app.use((req, _res, next) => {
    const u = req.get("x-test-user");
    if (u) { (req.session as any).userId = u; (req.session as any).userRole = "customer"; }
    next();
  });
  registerReviewRoutes(app);
});

beforeEach(() => {
  fx.booking = {
    id: BK, userId: null, status: "completed", tourId: "t1", tourName: "Mele Cascades",
    customerName: "Sarah Mitchell", customerEmail: "sarah@example.com", customerPhone: "+678 555",
    totalAmountCents: 12000,
  };
  fx.items = [{ productId: "t1", productName: "Mele Cascades" }, { productId: "t2", productName: "Airport Transfer" }];
  fx.reviewed = [];
  fx.inserted = [];
});

const token = () => signReviewToken(BK);

describe("GET /api/reviews/invite/:token", () => {
  it("lists the booking's products without personal or payment details", async () => {
    fx.reviewed = ["t2"];
    const res = await request(app).get(`/api/reviews/invite/${token()}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      firstName: "Sarah",
      items: [
        { productId: "t1", productName: "Mele Cascades", reviewed: false },
        { productId: "t2", productName: "Airport Transfer", reviewed: true },
      ],
    });
    const raw = JSON.stringify(res.body);
    for (const leak of ["sarah@example.com", "+678", BK, "12000"]) expect(raw).not.toContain(leak);
  });

  it.each(["pending", "confirmed", "cancelled"])("410 when the booking is %s", async (status) => {
    fx.booking.status = status;
    const res = await request(app).get(`/api/reviews/invite/${token()}`);
    expect(res.status).toBe(410);
    expect(res.body).toEqual({ error: "link_expired" });
  });

  it("410 for a tampered token", async () => {
    const res = await request(app).get(`/api/reviews/invite/${token()}x`);
    expect(res.status).toBe(410);
  });

  it("410 (not 500) when a validly signed booking was deleted", async () => {
    fx.booking = null;
    const res = await request(app).get(`/api/reviews/invite/${signReviewToken(BK)}`);
    expect(res.status).toBe(410);
  });
});

describe("POST /api/reviews/invite/:token", () => {
  const post = (body: object, t = token()) => request(app).post(`/api/reviews/invite/${t}`).send(body);

  it("saves a pending, verified review with identity from the booking", async () => {
    const res = await post({ reviews: [{ productId: "t1", rating: 5, comment: "Amazing" }] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ created: ["t1"], alreadyReviewed: [] });
    expect(fx.inserted[0]).toMatchObject({ bookingId: BK, tourId: "t1", guestName: "Sarah M.", guestEmail: "sarah@example.com", isGuest: true });
  });

  it("400 for a product that is not in the booking", async () => {
    const res = await post({ reviews: [{ productId: "not-mine", rating: 5 }] });
    expect(res.status).toBe(400);
    expect(fx.inserted).toEqual([]);
  });

  it("400 and nothing inserted when one submission repeats a product", async () => {
    const res = await post({ reviews: [{ productId: "t1", rating: 5 }, { productId: "t1", rating: 4 }] });
    expect(res.status).toBe(400);
    expect(fx.inserted).toEqual([]);
  });

  it("400 when the client tries to set status", async () => {
    const res = await post({ reviews: [{ productId: "t1", rating: 5, status: "approved" }] });
    expect(res.status).toBe(400);
    expect(fx.inserted).toEqual([]);
  });

  it("skips products already reviewed and reports them", async () => {
    fx.reviewed = ["t1"];
    const res = await post({ reviews: [{ productId: "t1", rating: 5 }, { productId: "t2", rating: 4 }] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ created: ["t2"], alreadyReviewed: ["t1"] });
  });

  it("409 when everything was already reviewed (second tab / reused link)", async () => {
    await post({ reviews: [{ productId: "t1", rating: 5 }] });
    const res = await post({ reviews: [{ productId: "t1", rating: 5 }] });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "already_reviewed" });
  });

  it("410 when the booking is not completed", async () => {
    fx.booking.status = "confirmed";
    const res = await post({ reviews: [{ productId: "t1", rating: 5 }] });
    expect(res.status).toBe(410);
    expect(fx.inserted).toEqual([]);
  });
});

describe("POST /api/reviews (signed in)", () => {
  const post = (body: object, user = "custA") => request(app).post("/api/reviews").set("x-test-user", user).send(body);
  beforeEach(() => { fx.booking.userId = "custA"; });

  it("401 when not signed in", async () => {
    const res = await request(app).post("/api/reviews").send({ bookingId: BK, tourId: "t1", rating: 5 });
    expect(res.status).toBe(401);
  });

  it("saves a pending verified review for the owner's completed booking", async () => {
    const res = await post({ bookingId: BK, tourId: "t1", rating: 5, comment: "Great" });
    expect(res.status).toBe(200);
    expect(fx.inserted[0]).toMatchObject({ userId: "custA", isGuest: false, tourId: "t1" });
  });

  it("400 when the body tries to set status", async () => {
    const res = await post({ bookingId: BK, tourId: "t1", rating: 5, status: "approved" });
    expect(res.status).toBe(400);
    expect(fx.inserted).toEqual([]);
  });

  it("403 for another customer's booking", async () => {
    const res = await post({ bookingId: BK, tourId: "t1", rating: 5 }, "custB");
    expect(res.status).toBe(403);
    expect(fx.inserted).toEqual([]);
  });

  it("403 when the booking is not completed", async () => {
    fx.booking.status = "confirmed";
    const res = await post({ bookingId: BK, tourId: "t1", rating: 5 });
    expect(res.status).toBe(403);
  });

  it("400 for a product outside the booking", async () => {
    const res = await post({ bookingId: BK, tourId: "elsewhere", rating: 5 });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/reviews/approved", () => {
  it("returns only approved rows with a comment, exposing exactly five fields", async () => {
    fx.allReviews = [
      { id: "a", rating: 5, comment: "Great", status: "approved", authorName: "Sarah M.", tourTitle: "Mele", guestEmail: "s@example.com", userId: "u1", bookingId: BK, isGuest: true },
      { id: "b", rating: 5, comment: "Hidden", status: "pending", authorName: "X", tourTitle: "Mele" },
      { id: "c", rating: 5, comment: null, status: "approved", authorName: "Y", tourTitle: "Mele" },
    ];
    const res = await request(app).get("/api/reviews/approved");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: "a", rating: 5, comment: "Great", authorName: "Sarah M.", tourTitle: "Mele" }]);
    expect(Object.keys(res.body[0]).sort()).toEqual(["authorName", "comment", "id", "rating", "tourTitle"]);
  });
});

describe("POST /api/admin/bookings/:id/review-request", () => {
  const send = (user?: string) => {
    const r = request(app).post(`/api/admin/bookings/${BK}/review-request`);
    return user ? r.set("x-test-user", user) : r;
  };
  beforeEach(() => sendReviewRequest.mockClear());

  it("sends for a completed booking", async () => {
    const res = await send("admin1");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ sent: true });
    expect(sendReviewRequest).toHaveBeenCalledTimes(1);
  });

  it("400 when the booking is not completed", async () => {
    fx.booking.status = "confirmed";
    const res = await send("admin1");
    expect(res.status).toBe(400);
    expect(sendReviewRequest).not.toHaveBeenCalled();
  });

  it("404 when the booking does not exist", async () => {
    fx.booking = null;
    expect((await send("admin1")).status).toBe(404);
    expect(sendReviewRequest).not.toHaveBeenCalled();
  });

  it("refuses non-admins and anonymous callers", async () => {
    expect((await send("custA")).status).toBe(403);
    expect((await send()).status).toBe(401);
    expect(sendReviewRequest).not.toHaveBeenCalled();
  });
});

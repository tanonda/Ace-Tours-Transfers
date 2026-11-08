import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import express from "express";
import { signBookingReceiptToken } from "../lib/receipt-token.js";
import { makeBooking } from "../test-fixtures/payment.js";

vi.mock("../storage.js", () => {
  const booking = makeBooking({ id: "book_123", customerEmail: "guest@example.com", status: "confirmed" });
  return {
    storage: {
      getBooking: vi.fn(async (id: string) => (id === "book_123" ? booking : undefined)),
      getBookingItems: vi.fn(async () => [{ id: "item1", productId: "p1", productName: "Blue Lagoon", productType: "tour", quantity: 2, unitPriceCents: 5000, subtotalCents: 10000, adultPax: 2, childPax: 0, infantPax: 0, petPax: 0 }]),
      getPaymentsByBooking: vi.fn(async () => [{ id: "pay1", status: "completed", amount: 10000, currency: "VUV", createdAt: new Date() }]),
    },
  };
});

import { registerBookingsRoutes } from "./bookings.routes.js";

const app = express();
app.use(express.json());
registerBookingsRoutes(app, { bookingApplicationService: {} as any, availabilityAppService: {} as any, sseClients: [] });

describe("GET /api/bookings/:id/receipt", () => {
  it("returns a sanitised receipt for a valid signed token", async () => {
    const token = signBookingReceiptToken("book_123");
    const res = await request(app).get(`/api/bookings/book_123/receipt?token=${encodeURIComponent(token)}`);
    expect(res.status).toBe(200);
    expect(res.body.booking.id).toBe("book_123");
    expect(res.body.booking.customerEmail).toBe("g****@example.com");
    expect(res.body.booking).not.toHaveProperty("holdId");
    expect(res.body.booking).not.toHaveProperty("bookingSessionId");
    expect(res.body.items).toHaveLength(1);
    expect(res.body.payments[0]).toMatchObject({ status: "completed", amount: 10000 });
  });

  it("rejects a missing, tampered or wrong-booking token", async () => {
    expect((await request(app).get("/api/bookings/book_123/receipt")).status).toBe(401);
    const token = signBookingReceiptToken("book_123");
    expect((await request(app).get(`/api/bookings/book_123/receipt?token=${token}x`)).status).toBe(401);
    const other = signBookingReceiptToken("book_other");
    expect((await request(app).get(`/api/bookings/book_123/receipt?token=${other}`)).status).toBe(401);
  });
});

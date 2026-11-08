import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express, { type Express } from "express";
import { registerPaymentRoutes } from "./payment.routes.js";
import { computePayzenSignature } from "../infrastructure/payments/payzen-signature.js";
import { PaymentStatus } from "../domain/payments/interfaces.js";
import { makeBooking, makePaymentGateway } from "../test-fixtures/payment.js";
import { config } from "../config.js";

config.payments.bred.enabled = true;

vi.mock("../infrastructure/events/event-dispatcher.js", () => ({
  eventDispatcher: { dispatch: vi.fn(), subscribe: vi.fn() },
}));
vi.mock("../lib/mail.js", () => ({
  sendEmail: vi.fn(), sendAdminEmail: vi.fn(),
  getPaymentConfirmationTemplate: vi.fn(), getBookingRequestTemplate: vi.fn(),
  getAdminNewBookingTemplate: vi.fn(), shortBookingRef: (id: string) => id.slice(0, 6),
}));

const TEST_KEY = "TestKeyAbc123";
const bredGateway = makePaymentGateway({
  id: "gw-bred",
  slug: "bred-bank",
  credentials: { shopId: "12345678", mode: "TEST", testKey: TEST_KEY },
  config: null,
});

function signedIpn(overrides: Record<string, string> = {}) {
  const fields: Record<string, string> = {
    vads_amount: "12500",
    vads_ctx_mode: "TEST",
    vads_currency: "548",
    vads_operation_type: "DEBIT",
    vads_order_id: "pay-0001",
    vads_site_id: "12345678",
    vads_trans_id: "a1b2c3",
    vads_trans_status: "AUTHORISED",
    vads_trans_uuid: "uuid-1",
    vads_url_check_src: "PAY",
    vads_hash: "notification-hash",
    ...overrides,
  };
  return { ...fields, signature: computePayzenSignature(fields, TEST_KEY) };
}

let app: Express;
let storage: Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  const gatewayFor = (slug: string) =>
    slug === "bred-bank" ? bredGateway : makePaymentGateway({ id: `gw-${slug}`, slug, active: false });

  storage = {
    getFeatureFlags: vi.fn().mockResolvedValue([]),
    getPaymentGatewayBySlug: vi.fn().mockImplementation(async (slug: string) => gatewayFor(slug)),
    getPayment: vi.fn().mockResolvedValue({
      id: "pay-0001", bookingId: "book-123", gatewayId: "gw-bred", amount: 12500, currency: "VUV",
      status: PaymentStatus.Processing, metadata: null,
    }),
    updatePayment: vi.fn().mockResolvedValue({}),
    getBooking: vi.fn().mockResolvedValue(makeBooking({
      id: "book-123", status: "pending", bookingSessionId: "book-123", totalAmountCents: 12500,
      customerEmail: "guest@example.com", customerName: "Jo Guest",
    })),
    getPaymentsByBooking: vi.fn().mockResolvedValue([]),
    createPayment: vi.fn().mockResolvedValue({ id: "pay-0001" }),
  };

  app = express();
  // The production body parser: webhooks arrive as raw Buffers.
  app.use((req, _res, next) => {
    if (req.path.startsWith("/api/payments/webhook/")) {
      express.raw({ type: "*/*" })(req, _res, next);
    } else {
      express.json()(req, _res, next);
    }
  });
  registerPaymentRoutes(app, storage as any);
});

describe("webhook route under the production raw-body parser", () => {
  it("accepts a signed PayZen IPN", async () => {
    const res = await request(app).post("/api/payments/webhook/bred-bank").type("form").send(signedIpn());
    expect(res.status).toBe(200);
    expect(storage.updatePayment).toHaveBeenCalledWith("pay-0001", expect.objectContaining({
      status: PaymentStatus.Completed,
      gatewayReference: "uuid-1",
    }));
  });

  it("rejects a PayZen IPN with a broken signature", async () => {
    const res = await request(app).post("/api/payments/webhook/bred-bank").type("form")
      .send({ ...signedIpn(), vads_amount: "1" });
    expect(res.status).toBe(400);
    expect(storage.updatePayment).not.toHaveBeenCalled();
  });

  it("does not 405 a supported mobile-money gateway (it fails closed on an inactive gateway)", async () => {
    const res = await request(app).post("/api/payments/webhook/kwikpay")
      .set("content-type", "application/json")
      .send('{"status":"completed"}');
    expect(res.status).not.toBe(405);
    expect(res.status).toBe(400);
  });

  it("still rejects manual gateways", async () => {
    const res = await request(app).post("/api/payments/webhook/manual").send({});
    expect(res.status).toBe(405);
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express, { type Express } from "express";
import session from "express-session";
import { registerPaymentRoutes } from "./payment.routes.js";
import { getFormActionSources, setConfiguredHostedPaymentUrl } from "../lib/csp-form-action.js";
import { makePaymentGateway } from "../test-fixtures/payment.js";

// The route module imports the admin guard, which looks the user up through the
// global storage singleton; mock only that lookup so the guard lets admin1 through.
vi.mock("../storage.js", () => ({
  storage: {
    getUser: async (id: string) => (id === "admin1" ? { id, role: "admin", isActive: true } : undefined),
  },
}));
vi.mock("../infrastructure/audit/admin-audit-log.service.js", () => ({
  adminAudit: { log: async () => undefined },
}));
vi.mock("../infrastructure/events/event-dispatcher.js", () => ({
  eventDispatcher: { dispatch: vi.fn(), subscribe: vi.fn() },
}));
vi.mock("../lib/mail.js", () => ({
  sendEmail: vi.fn(),
  sendAdminEmail: vi.fn(),
  getPaymentConfirmationTemplate: vi.fn(),
  getBookingRequestTemplate: vi.fn(),
  getAdminNewBookingTemplate: vi.fn(),
  shortBookingRef: (id: string) => id.slice(0, 6),
}));

const bredGateway = makePaymentGateway({
  id: "gw-bred",
  slug: "bred-bank",
  credentials: { shopId: "12345678", mode: "TEST", testKey: "TestKeyAbc123" },
  config: null,
});

let app: Express;
let storage: Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  setConfiguredHostedPaymentUrl(null);

  storage = {
    getPaymentGateway: vi.fn().mockResolvedValue(bredGateway),
    updatePaymentGateway: vi.fn().mockImplementation(async (id: string, data: any) => ({
      ...bredGateway,
      ...data,
      id,
      slug: "bred-bank",
      credentials: data.credentials ?? bredGateway.credentials,
    })),
  };

  app = express();
  app.use(express.json());
  app.use(session({ secret: "test", resave: false, saveUninitialized: true }));
  app.use((req, _res, next) => {
    (req.session as any).userId = "admin1";
    (req.session as any).userRole = "admin";
    next();
  });
  registerPaymentRoutes(app, storage as any);
});

const save = (body: object) =>
  request(app).put("/api/admin/payment-gateways/gw-bred").send(body);

describe("PUT /api/admin/payment-gateways/:id — server-side credential validation", () => {
  it("refuses a PayZen mode that is not TEST/PRODUCTION (the e-mail seen in the admin form)", async () => {
    const res = await save({
      credentials: { shopId: "12345678", mode: "admin@acetoursvanuatu.com", testKey: "k" },
    });
    expect(res.status).toBe(400);
    expect(res.body.details.fieldErrors.credentials.mode).toBeTruthy();
    expect(storage.updatePaymentGateway).not.toHaveBeenCalled();
  });

  it("refuses a Shop ID that is not the 8-digit PayZen site ID", async () => {
    const res = await save({ credentials: { shopId: "123", mode: "TEST", testKey: "k" } });
    expect(res.status).toBe(400);
    expect(res.body.details.fieldErrors.credentials.shopId).toBeTruthy();
    expect(storage.updatePaymentGateway).not.toHaveBeenCalled();
  });

  it("refuses a plain-http payment page, which the browser CSP would block", async () => {
    const res = await save({
      credentials: { shopId: "12345678", mode: "TEST", testKey: "k", paymentUrl: "http://pay.bred.vu/vads-payment/" },
    });
    expect(res.status).toBe(400);
    expect(res.body.details.fieldErrors.credentials.paymentUrl).toBeTruthy();
    expect(storage.updatePaymentGateway).not.toHaveBeenCalled();
  });

  it("saves valid BRED credentials", async () => {
    const res = await save({ credentials: { shopId: "12345678", mode: "TEST", testKey: "k" } });
    expect(res.status).toBe(200);
    expect(storage.updatePaymentGateway).toHaveBeenCalledWith(
      "gw-bred",
      expect.objectContaining({
        credentials: { shopId: "12345678", mode: "TEST", testKey: "k" },
      }),
    );
  });

  it("adds a BRED-specific payment page to the CSP form-action allowlist on save", async () => {
    const res = await save({
      credentials: {
        shopId: "12345678",
        mode: "TEST",
        testKey: "k",
        paymentUrl: "https://pay.bred.vu/vads-payment/",
      },
    });
    expect(res.status).toBe(200);
    expect(getFormActionSources()).toContain("https://pay.bred.vu");
  });

  it("returns 404 instead of throwing for an unknown gateway", async () => {
    storage.getPaymentGateway.mockResolvedValue(undefined);
    const res = await save({ active: true });
    expect(res.status).toBe(404);
    expect(storage.updatePaymentGateway).not.toHaveBeenCalled();
  });
});

describe("PUT /api/admin/payment-gateways/:id — ANZ/BSP/NBV production mode", () => {
  const anz = {
    mode: "PRODUCTION",
    gatewayUrl: "https://anzworldline.gateway.mastercard.com",
    testMerchantId: "TESTACETOURS01",
    testApiPassword: "test-pass",
    productionMerchantId: "ACETOURS01",
    productionApiPassword: "prod-pass",
    productionNotificationSecret: "prod-secret",
  };

  beforeEach(() => {
    storage.getPaymentGateway.mockResolvedValue(
      makePaymentGateway({ id: "gw-bred", slug: "anz-egate", displayName: "ANZ eGate", credentials: {}, config: null }),
    );
  });

  it("refuses PRODUCTION without the notification secret and says which value is missing", async () => {
    const res = await save({ credentials: { ...anz, productionNotificationSecret: "" } });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/production notification secret/);
    expect(storage.updatePaymentGateway).not.toHaveBeenCalled();
  });

  it("saves PRODUCTION once the secret is entered", async () => {
    const res = await save({ credentials: anz });
    expect(res.status).toBe(200);
    expect(storage.updatePaymentGateway).toHaveBeenCalled();
  });

  it("saves TEST mode with the production fields still blank", async () => {
    const res = await save({
      credentials: { ...anz, mode: "TEST", productionMerchantId: "", productionApiPassword: "", productionNotificationSecret: "" },
    });
    expect(res.status).toBe(200);
  });
});

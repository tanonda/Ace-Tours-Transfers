import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import request from "supertest";
import express, { Express } from "express";
import session from "express-session";

const state = vi.hoisted(() => ({
  stored: {} as Record<string, unknown>,
  sendAdminEmail: undefined as unknown as ReturnType<typeof import("vitest").vi.fn>,
}));

vi.mock("../storage.js", () => ({
  storage: {
    getUser: async (id: string) => (id === "admin1" ? { id, role: "admin", isActive: true } : undefined),
    getSiteSetting: async (key: string) => (key in state.stored ? { key, value: state.stored[key] } : undefined),
    upsertSiteSetting: async ({ key, value }: { key: string; value: unknown }) => {
      state.stored[key] = value;
      return { key, value };
    },
  },
}));
vi.mock("../infrastructure/audit/admin-audit-log.service.js", () => ({ adminAudit: { log: async () => undefined } }));
vi.mock("../lib/mail.js", async (importOriginal) => {
  const { vi: v } = await import("vitest");
  state.sendAdminEmail = v.fn(async () => true);
  return { ...(await importOriginal<Record<string, unknown>>()), sendAdminEmail: state.sendAdminEmail };
});

let app: Express;
beforeAll(async () => {
  const { registerSiteRoutes } = await import("./site.routes.js");
  app = express();
  app.use(express.json());
  app.use(session({ secret: "test", resave: false, saveUninitialized: true }));
  app.use((req, _res, next) => {
    (req.session as any).userId = "admin1";
    (req.session as any).userRole = "admin";
    next();
  });
  registerSiteRoutes(app);
});

beforeEach(() => {
  state.stored = { bank_transfer_account_number: "0012-345678-9" };
  state.sendAdminEmail.mockClear();
});

const save = (key: string, value: unknown) => request(app).put(`/api/admin/settings/${key}`).send({ value });

describe("changing bank-transfer details emails the admin", () => {
  it("alerts with the old and new account number", async () => {
    const res = await save("bank_transfer_account_number", "9999-000000-1");
    expect(res.status).toBe(200);
    expect(state.sendAdminEmail).toHaveBeenCalledTimes(1);
    const [subject, html] = state.sendAdminEmail.mock.calls[0] as [string, string];
    expect(subject).toContain("Bank details changed");
    expect(html).toContain("0012-345678-9");
    expect(html).toContain("9999-000000-1");
  });

  it("stays quiet when the value is saved unchanged", async () => {
    await save("bank_transfer_account_number", "0012-345678-9");
    expect(state.sendAdminEmail).not.toHaveBeenCalled();
  });

  it("stays quiet for settings that are not bank details", async () => {
    await save("whatsapp_number", "6787114045");
    expect(state.sendAdminEmail).not.toHaveBeenCalled();
  });

  it("escapes what an admin typed", async () => {
    await save("bank_transfer_bank_name", "<img src=x onerror=alert(1)>");
    const html = state.sendAdminEmail.mock.calls[0][1] as string;
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});

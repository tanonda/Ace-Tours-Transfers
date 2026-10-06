import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import express, { Express } from "express";
import session from "express-session";
import { PERSON_NAME_ERROR } from "../../shared/person-name.js";

// Every storage method resolves to undefined, and the test can see what was called.
const calls: string[] = [];
vi.mock("../storage.js", () => ({
  storage: new Proxy({} as Record<string, unknown>, {
    get: (target, key: string) =>
      (target[key] ??= vi.fn(async (id?: unknown) => {
        calls.push(key);
        // requireAdmin re-reads the user rather than trusting the session.
        return key === "getUser" && id === "admin1" ? { id, role: "admin", isActive: true } : undefined;
      })),
  }),
}));

let app: Express;
beforeAll(async () => {
  const { registerAuthRoutes } = await import("../application/auth.routes.js");
  const { registerUserRoutes } = await import("../application/user.routes.js");
  const { registerSiteRoutes } = await import("./site.routes.js");
  app = express();
  app.use(express.json());
  app.use(session({ secret: "test", resave: false, saveUninitialized: true }));
  app.use((req, _res, next) => {
    if (req.get("x-test-user")) {
      (req.session as any).userId = req.get("x-test-user");
      (req.session as any).userRole = req.get("x-test-role") ?? "customer";
    }
    next();
  });
  registerAuthRoutes(app);
  registerUserRoutes(app);
  registerSiteRoutes(app);
});

const BAD = "<img src=x onerror=alert(1)>";
const writes = () => calls.filter((c) => /^(create|update|insert|upsert|add|save|set)/i.test(c));

// Each route that takes a person's name refuses < and > before writing anything.
describe("name fields refuse < and >", () => {
  it.each([
    ["POST /api/auth/register", () => request(app).post("/api/auth/register").send({ name: BAD, email: "a@b.com", password: "longenough1" })],
    ["PATCH /api/users/:id/profile (own profile)", () => request(app).patch("/api/users/u1/profile").set("x-test-user", "u1").send({ name: BAD })],
    ["POST /api/users (admin creates an account)", () => request(app).post("/api/users").set("x-test-user", "admin1").set("x-test-role", "admin").send({ name: BAD, email: "a@b.com", username: "ab", password: "longenough1", role: "customer" })],
    ["POST /api/newsletter/subscribe", () => request(app).post("/api/newsletter/subscribe").send({ email: "a@b.com", name: BAD })],
    ["PATCH /api/newsletter/subscribers/:id (admin)", () => request(app).patch("/api/newsletter/subscribers/s1").set("x-test-user", "admin1").set("x-test-role", "admin").send({ name: BAD })],
    ["POST /api/contact", () => request(app).post("/api/contact").send({ name: BAD, email: "a@b.com", subject: "Hi", message: "Hello there, a question about tours." })],
  ])("%s", async (_route, send) => {
    calls.length = 0;
    const res = await send();
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(PERSON_NAME_ERROR);
    expect(writes()).toEqual([]);
  });
});

import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import express, { Express } from "express";
import session from "express-session";
import bcrypt from "bcryptjs";

const FORBIDDEN = ["password", "passwordResetToken", "passwordResetTokenExpiry", "totpSecret"];
const CLIENT_FIELDS = ["id", "email", "name", "phone", "role"];

const row = (over: Record<string, unknown> = {}) => ({
  id: "u1",
  username: "jo",
  email: "jo@example.com",
  name: "Jo",
  phone: "+678 555",
  role: "customer",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  password: bcrypt.hashSync("correct-horse-1", 4),
  passwordResetToken: "RESET-TOKEN",
  passwordResetTokenExpiry: new Date(),
  totpSecret: "TOTP-SECRET",
  totpEnabled: false,
  ...over,
});

const admin = { id: "admin1", role: "admin", isActive: true };
const store = vi.hoisted(() => ({ users: [] as any[] }));

vi.mock("../storage.js", () => ({
  storage: new Proxy({} as Record<string, unknown>, {
    get: (target, key: string) =>
      (target[key] ??= vi.fn(async (arg?: any) => {
        if (key === "getUser") return arg === "admin1" ? admin : store.users.find((u) => u.id === arg);
        if (key === "getUserByEmail") return store.users.find((u) => u.email === arg);
        if (key === "getAllUsers" || key === "getCustomers") return store.users;
        if (key === "createUser") return { ...store.users[0], email: arg.email, name: arg.name };
        if (key === "updateUserProfile") return store.users[0];
        return undefined;
      })),
  }),
}));

let app: Express;
beforeAll(async () => {
  const { registerAuthRoutes } = await import("../application/auth.routes.js");
  const { registerUserRoutes } = await import("../application/user.routes.js");
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
}, 60_000);

const expectSafe = (u: Record<string, unknown>) => {
  for (const f of FORBIDDEN) expect(u).not.toHaveProperty(f);
  expect(JSON.stringify(u)).not.toMatch(/RESET-TOKEN|TOTP-SECRET|\$2[aby]\$/);
};
const asAdmin = (r: request.Test) => r.set("x-test-user", "admin1").set("x-test-role", "admin");

describe("user responses never carry secrets", () => {
  it("POST /api/auth/login", async () => {
    store.users = [row()];
    const res = await request(app).post("/api/auth/login").send({ email: "jo@example.com", password: "correct-horse-1" });
    expect(res.status).toBe(200);
    expectSafe(res.body);
    for (const f of CLIENT_FIELDS) expect(res.body).toHaveProperty(f);
    expect(res.body.role).toBe("customer");
  });

  it("GET /api/auth/me", async () => {
    store.users = [row()];
    const res = await request(app).get("/api/auth/me").set("x-test-user", "u1");
    expect(res.status).toBe(200);
    expectSafe(res.body);
    for (const f of CLIENT_FIELDS) expect(res.body).toHaveProperty(f);
  });

  it("GET /api/users (admin list)", async () => {
    store.users = [row(), row({ id: "u2", email: "b@example.com" })];
    const res = await asAdmin(request(app).get("/api/users"));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    res.body.forEach(expectSafe);
    expect(res.body[0]).toHaveProperty("isActive", true);
  });

  it("GET /api/customers (admin list)", async () => {
    store.users = [row()];
    const res = await asAdmin(request(app).get("/api/customers"));
    expect(res.status).toBe(200);
    res.body.forEach(expectSafe);
  });

  it("GET /api/users/:id (owner)", async () => {
    store.users = [row()];
    const res = await request(app).get("/api/users/u1").set("x-test-user", "u1");
    expect(res.status).toBe(200);
    expectSafe(res.body);
    expect(res.body.email).toBe("jo@example.com");
  });

  it("PATCH /api/users/:id/profile", async () => {
    store.users = [row()];
    const res = await request(app).patch("/api/users/u1/profile").set("x-test-user", "u1").send({ name: "Jo", email: "jo@example.com" });
    expect(res.status).toBe(200);
    expectSafe(res.body);
    for (const f of CLIENT_FIELDS) expect(res.body).toHaveProperty(f);
  });
});

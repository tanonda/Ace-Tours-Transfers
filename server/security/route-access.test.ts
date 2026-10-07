import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import express, { Express } from "express";
import session from "express-session";
import { createServer } from "http";

// Route-access policy over the real route table. Every storage call resolves to
// undefined except user lookups, so a route that forgets its guard falls through
// to its handler and shows up here as a non-401/403 response.
const USERS: Record<string, { id: string; role: string; isActive: boolean }> = {
  admin1: { id: "admin1", role: "admin", isActive: true },
  custA: { id: "custA", role: "customer", isActive: true },
};
vi.mock("../storage.js", () => ({
  storage: new Proxy({} as Record<string, unknown>, {
    get: (target, key: string) =>
      (target[key] ??= vi.fn(async (id?: unknown) => (key === "getUser" ? USERS[String(id)] : undefined))),
  }),
}));

// Write routes that are public on purpose (guest checkout, sign-in, provider callbacks).
// Adding a route here is a security decision: it must check ownership or input itself.
const PUBLIC_WRITE_ROUTES = new Set([
  "POST /api/auth/login",
  "POST /api/auth/logout",
  "POST /api/auth/register",
  "POST /api/auth/verify-email",
  "POST /api/auth/reset-password",
  "POST /api/availability/check",
  "POST /api/bookings",
  "POST /api/bookings/:id/cancel", // re-verifies email / last name / phone
  "POST /api/bookings/session",
  "POST /api/bookings/verify",
  "POST /api/cart/price",
  "POST /api/contact",
  "POST /api/holds",
  "POST /api/newsletter/subscribe",
  "POST /api/payments/callback/:gateway", // signature-verified per gateway
  "POST /api/payments/checkout", // ownership verified inside
  "POST /api/payments/webhook/:gateway", // signature-verified per gateway
  "POST /api/promotions/validate",
  "POST /api/reviews/guest",
]);

const SAMPLE_ID = "00000000-0000-4000-8000-000000000000";
const concrete = (path: string) => path.replace(/:[A-Za-z_]+/g, SAMPLE_ID).replace(/\*[A-Za-z_]+/g, "x");

type RouteEntry = { method: string; path: string };
let app: Express;
let routes: RouteEntry[] = [];

beforeAll(async () => {
  const { registerRoutes } = await import("../routes.js");
  app = express();
  app.use(express.json());
  app.use(session({ secret: "test", resave: false, saveUninitialized: true }));
  // Test identity: x-test-user signs in; x-test-session-role plants a role in the
  // session to prove guards re-read the role from the database.
  app.use((req, _res, next) => {
    const user = req.get("x-test-user");
    if (user) {
      (req.session as any).userId = user;
      (req.session as any).userRole = req.get("x-test-session-role") ?? USERS[user]?.role;
    }
    next();
  });
  await registerRoutes(createServer(app), app);
  const stack = ((app as any).router?.stack ?? []) as any[];
  routes = stack
    .filter((layer) => layer.route && typeof layer.route.path === "string" && layer.route.path.startsWith("/api/"))
    .filter((layer) => layer.route.path !== "/api/*any") // the catch-all 404
    .flatMap((layer) =>
      Object.keys(layer.route.methods)
        .filter((m) => m !== "_all")
        .map((m) => ({ method: m.toUpperCase(), path: layer.route.path as string })),
    );
}, 120_000);

// A dropped connection counts as a failure for that route, not for the whole loop.
const send = async (r: RouteEntry, headers: Record<string, string> = {}): Promise<{ status: number | string }> => {
  const req = (request(app) as any)[r.method.toLowerCase()](concrete(r.path)).timeout(10_000);
  for (const [k, v] of Object.entries(headers)) req.set(k, v);
  try {
    return await (r.method === "GET" || r.method === "DELETE" ? req : req.send({}));
  } catch (error) {
    return { status: (error as Error).message };
  }
};

describe("route access policy", () => {
  it("discovers the route table", () => {
    expect(routes.length).toBeGreaterThan(100);
    expect(routes.some((r) => r.path.startsWith("/api/admin/"))).toBe(true);
  });

  it("every admin route refuses visitors who are not signed in", async () => {
    const open: string[] = [];
    for (const r of routes.filter((r) => r.path.startsWith("/api/admin/"))) {
      const res = await send(r);
      if (![401, 403].includes(res.status as number)) open.push(`${r.method} ${r.path} → ${res.status}`);
    }
    expect(open).toEqual([]);
  });

  it("every admin route refuses a signed-in customer", async () => {
    const open: string[] = [];
    for (const r of routes.filter((r) => r.path.startsWith("/api/admin/"))) {
      const res = await send(r, { "x-test-user": "custA" });
      if (![401, 403].includes(res.status as number)) open.push(`${r.method} ${r.path} → ${res.status}`);
    }
    expect(open).toEqual([]);
  });

  it("an admin role planted in a customer's session is not trusted by admin routes", async () => {
    const open: string[] = [];
    for (const r of routes.filter((r) => r.path.startsWith("/api/admin/"))) {
      const res = await send(r, { "x-test-user": "custA", "x-test-session-role": "admin" });
      if (![401, 403].includes(res.status as number)) open.push(`${r.method} ${r.path} → ${res.status}`);
    }
    expect(open).toEqual([]);
  });

  it("every write route outside the reviewed public list refuses visitors who are not signed in", async () => {
    const open: string[] = [];
    for (const r of routes.filter((r) => r.method !== "GET" && !PUBLIC_WRITE_ROUTES.has(`${r.method} ${r.path}`))) {
      const res = await send(r);
      if (![401, 403].includes(res.status as number)) open.push(`${r.method} ${r.path} → ${res.status}`);
    }
    expect(open).toEqual([]);
  });

  it("the public list only names routes that exist", () => {
    const known = new Set(routes.map((r) => `${r.method} ${r.path}`));
    expect([...PUBLIC_WRITE_ROUTES].filter((r) => !known.has(r))).toEqual([]);
  });
});

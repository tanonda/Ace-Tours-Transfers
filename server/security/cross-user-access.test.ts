import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import request from "supertest";
import express, { Express } from "express";
import session from "express-session";
import { createServer } from "http";

// Customer B must never read or change customer A's booking, profile or password.
// Customer A (the owner) is the control: the same requests succeed for them.
const BOOKING_A = "11111111-1111-4111-8111-111111111111";
const fixtures = vi.hoisted(() => ({
  users: {
    custA: { id: "custA", role: "customer", isActive: true, email: "a@example.com", name: "Customer A", password: "$2a$10$x" },
    custB: { id: "custB", role: "customer", isActive: true, email: "b@example.com", name: "Customer B", password: "$2a$10$x" },
  } as Record<string, any>,
  bookingA: {
    id: "11111111-1111-4111-8111-111111111111",
    userId: "custA",
    bookingSessionId: "session-of-a",
    status: "pending",
    customerName: "Customer A",
    customerEmail: "a@example.com",
  },
  writes: [] as string[],
}));

vi.mock("../storage.js", () => ({
  storage: new Proxy({} as Record<string, unknown>, {
    get: (target, key: string) =>
      (target[key] ??= vi.fn(async (id?: unknown) => {
        if (/^(create|update|insert|upsert|delete|remove|add|save|set|cancel|release)/i.test(key)) fixtures.writes.push(key);
        if (key === "getUser") return fixtures.users[String(id)];
        if (key === "getBooking") return id === fixtures.bookingA.id ? fixtures.bookingA : undefined;
        if (key === "getUserBookings") return id === "custA" ? [fixtures.bookingA] : [];
        if (key === "getBookingItems") return [];
        return undefined;
      })),
  }),
}));

let app: Express;
beforeAll(async () => {
  const { registerRoutes } = await import("../routes.js");
  app = express();
  app.use(express.json());
  app.use(session({ secret: "test", resave: false, saveUninitialized: true }));
  app.use((req, _res, next) => {
    const user = req.get("x-test-user");
    if (user) {
      (req.session as any).userId = user;
      (req.session as any).userRole = fixtures.users[user]?.role;
    }
    next();
  });
  await registerRoutes(createServer(app), app);
}, 120_000);

beforeEach(() => {
  fixtures.writes.length = 0;
});

const as = (user: string) => ({
  get: (path: string) => request(app).get(path).set("x-test-user", user),
  patch: (path: string, body: object) => request(app).patch(path).set("x-test-user", user).send(body),
  post: (path: string, body: object) => request(app).post(path).set("x-test-user", user).send(body),
});

describe("customer B against customer A's data", () => {
  it("cannot read A's booking or its items", async () => {
    expect((await as("custB").get(`/api/bookings/${BOOKING_A}`)).status).toBe(401);
    expect((await as("custB").get(`/api/bookings/${BOOKING_A}/items`)).status).toBe(401);
  });

  it("cannot list A's bookings", async () => {
    expect((await as("custB").get("/api/bookings/user/custA")).status).toBe(403);
  });

  it("cannot edit A's booking", async () => {
    const res = await as("custB").patch(`/api/bookings/${BOOKING_A}`, { pickupLocation: "Somewhere else" });
    expect(res.status).toBe(403);
    expect(fixtures.writes).toEqual([]);
  });

  it("cannot cancel A's booking without A's details", async () => {
    const res = await as("custB").post(`/api/bookings/${BOOKING_A}/cancel`, { type: "email", value: "b@example.com" });
    expect(res.status).toBe(403);
    expect(fixtures.writes).toEqual([]);
  });

  it("cannot read A's account", async () => {
    expect((await as("custB").get("/api/users/custA")).status).toBe(403);
  });

  it("cannot change A's profile or password", async () => {
    const profile = await as("custB").patch("/api/users/custA/profile", { name: "Taken Over", email: "b@example.com" });
    const password = await as("custB").patch("/api/users/custA/change-password", { currentPassword: "x", newPassword: "new-password-123" });
    expect(profile.status).toBe(403);
    expect(password.status).toBe(403);
    expect(fixtures.writes).toEqual([]);
  });
});

describe("customer A (owner) as the control", () => {
  it("can read their own booking and account", async () => {
    expect((await as("custA").get(`/api/bookings/${BOOKING_A}`)).status).toBe(200);
    expect((await as("custA").get("/api/bookings/user/custA")).status).toBe(200);
    expect((await as("custA").get("/api/users/custA")).status).toBe(200);
  });

  it("never receives the password hash with their account", async () => {
    const res = await as("custA").get("/api/users/custA");
    expect(res.body.password).toBeUndefined();
  });
});

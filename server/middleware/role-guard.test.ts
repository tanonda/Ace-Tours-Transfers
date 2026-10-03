import { describe, expect, it, vi } from "vitest";
import { requireRole } from "./role-guard.js";

type FakeUser = { role: string; isActive: boolean } | undefined;

function run(session: Record<string, unknown>, user: FakeUser, roles = ["admin"]) {
  const req: any = { session, method: "GET", path: "/api/admin/x" };
  const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();
  return requireRole(async () => user, roles)(req, res, next).then(() => ({ req, res, next }));
}

describe("requireRole", () => {
  it("lets a current admin through", async () => {
    const { next } = await run({ userId: "u1", userRole: "admin" }, { role: "admin", isActive: true });
    expect(next).toHaveBeenCalled();
  });

  it("401s without a login", async () => {
    const { res, next } = await run({}, undefined);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("blocks an admin who was demoted after logging in", async () => {
    const { req, res, next } = await run({ userId: "u1", userRole: "admin" }, { role: "customer", isActive: true });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
    expect(req.session.userRole).toBe("customer"); // session corrected for later checks
  });

  it("blocks an admin who was deactivated after logging in", async () => {
    const { res, next } = await run({ userId: "u1", userRole: "admin" }, { role: "admin", isActive: false });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("blocks a deleted user", async () => {
    const { res, next } = await run({ userId: "u1", userRole: "admin" }, undefined);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("accepts any of several roles", async () => {
    const { next } = await run(
      { userId: "u1", userRole: "field_service" },
      { role: "field_service", isActive: true },
      ["admin", "field_service"],
    );
    expect(next).toHaveBeenCalled();
  });
});

import { describe, expect, it } from "vitest";
import { toSafeUser, SAFE_USER_FIELDS } from "./safe-user.js";

describe("toSafeUser", () => {
  it("returns only the allow-listed fields", () => {
    const now = new Date();
    const safe = toSafeUser({
      id: "u1",
      username: "staff",
      email: "staff@example.com",
      name: "Staff",
      phone: null,
      role: "admin",
      isActive: true,
      createdAt: now,
      updatedAt: now,
      totpEnabled: true,
      password: "$2a$10$hash",
      passwordResetToken: "reset-token",
      passwordResetTokenExpiry: now,
      totpSecret: "TOTPSECRET",
      someFutureSecretColumn: "x",
    });
    expect(Object.keys(safe).sort()).toEqual([...SAFE_USER_FIELDS].sort());
    expect(safe).not.toHaveProperty("password");
    expect(safe).not.toHaveProperty("totpSecret");
    expect(safe).not.toHaveProperty("passwordResetToken");
    expect(safe).not.toHaveProperty("someFutureSecretColumn");
  });
});

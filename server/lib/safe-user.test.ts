import { describe, expect, it } from "vitest";
import { toSafeUser } from "./safe-user";

describe("toSafeUser", () => {
  it("drops credentials and keeps the profile fields admin screens use", () => {
    const safe = toSafeUser({
      id: "u1",
      email: "staff@example.com",
      name: "Staff",
      role: "admin",
      isActive: true,
      password: "$2a$10$hash",
      passwordResetToken: "reset-token",
      passwordResetTokenExpiry: new Date(),
      totpSecret: "TOTPSECRET",
      totpEnabled: true,
    });
    expect(safe).toEqual({
      id: "u1",
      email: "staff@example.com",
      name: "Staff",
      role: "admin",
      isActive: true,
      totpEnabled: true,
    });
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { sealSecret, openSecret, isSealedSecret } from "./secret-crypto.js";

const KEY = Buffer.alloc(32, 7).toString("base64");

describe("secret-crypto", () => {
  beforeEach(() => { process.env.DATA_ENCRYPTION_KEY = KEY; });
  afterEach(() => { delete process.env.DATA_ENCRYPTION_KEY; delete process.env.PAYMENT_CREDENTIALS_KEY; });

  it("round-trips a TOTP-like secret with a version prefix", () => {
    const sealed = sealSecret("JBSWY3DPEHPK3PXP");
    expect(sealed.startsWith("v1.")).toBe(true);
    expect(sealed).not.toContain("JBSWY3DPEHPK3PXP");
    expect(isSealedSecret(sealed)).toBe(true);
    expect(openSecret(sealed)).toBe("JBSWY3DPEHPK3PXP");
  });

  it("uses a fresh IV per value", () => {
    expect(sealSecret("same")).not.toBe(sealSecret("same"));
  });

  it("passes legacy plaintext through unchanged", () => {
    expect(openSecret("JBSWY3DPEHPK3PXP")).toBe("JBSWY3DPEHPK3PXP");
    expect(isSealedSecret("JBSWY3DPEHPK3PXP")).toBe(false);
  });

  it("fails closed when the key is missing or the ciphertext is tampered with", () => {
    const sealed = sealSecret("secret");
    delete process.env.DATA_ENCRYPTION_KEY;
    expect(() => openSecret(sealed)).toThrow(/required/i);
    process.env.DATA_ENCRYPTION_KEY = KEY;
    const tampered = sealed.slice(0, -2) + "AA";
    expect(() => openSecret(tampered)).toThrow();
  });

  it("falls back to PAYMENT_CREDENTIALS_KEY", () => {
    delete process.env.DATA_ENCRYPTION_KEY;
    process.env.PAYMENT_CREDENTIALS_KEY = KEY;
    expect(openSecret(sealSecret("abc"))).toBe("abc");
  });
});

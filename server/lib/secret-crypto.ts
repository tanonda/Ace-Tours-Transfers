/**
 * Small AES-256-GCM helper for secrets that live in ordinary text columns
 * (currently the TOTP secret on `users`). The sealed value is self-describing:
 *
 *   v1.<iv base64>.<auth tag base64>.<ciphertext base64>
 *
 * Key resolution: DATA_ENCRYPTION_KEY, falling back to PAYMENT_CREDENTIALS_KEY
 * (both are documented as 32 random bytes, Base64). A non-Base64 passphrase is
 * hashed to 32 bytes so an operator cannot accidentally configure a weak length;
 * production should still use `openssl rand -base64 32`.
 *
 * Values written before this helper existed are returned unchanged, which lets
 * existing MFA users keep logging in; login re-seals them on success.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const PREFIX = "v1.";

function keyBytes(): Buffer {
  const raw = process.env.DATA_ENCRYPTION_KEY || process.env.PAYMENT_CREDENTIALS_KEY;
  if (!raw) {
    throw new Error("DATA_ENCRYPTION_KEY (or PAYMENT_CREDENTIALS_KEY) is required to encrypt MFA secrets.");
  }
  const bytes = Buffer.from(raw, "base64");
  return bytes.length === 32 ? bytes : createHash("sha256").update(raw, "utf8").digest();
}

export function isSealedSecret(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function sealSecret(plain: string): string {
  if (!plain) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${PREFIX}${[iv, cipher.getAuthTag(), ciphertext].map((b) => b.toString("base64")).join(".")}`;
}

/** Returns legacy plaintext unchanged; throws if a sealed value cannot be opened. */
export function openSecret(stored: string): string {
  if (!stored || !stored.startsWith(PREFIX)) return stored;
  const [version, iv, tag, ciphertext] = stored.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext) {
    throw new Error("Unrecognised sealed secret format.");
  }
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
}

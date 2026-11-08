/**
 * Signed, short-lived receipt links.
 *
 * A guest who pays through an admin-created bank payment link may return on a
 * different device with no session cookie. The callback appends this token to
 * the success URL; the receipt endpoint trades it for a sanitised booking view.
 * It only grants read access to one booking and expires quickly.
 */

import crypto from "crypto";

export const RECEIPT_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

type Opts = { secret?: string; now?: number; ttlMs?: number };

function key(secret: string | undefined): Buffer {
  if (!secret) throw new Error("SESSION_SECRET is required to sign receipt links");
  return crypto.createHmac("sha256", secret).update("booking-receipt:v1").digest();
}

const sign = (payload: string, k: Buffer) => crypto.createHmac("sha256", k).update(payload).digest("base64url");

export function signBookingReceiptToken(
  bookingId: string,
  { secret = process.env.SESSION_SECRET, now = Date.now(), ttlMs = RECEIPT_TOKEN_TTL_MS }: Opts = {},
): string {
  const expires = Math.floor((now + ttlMs) / 1000);
  const payload = Buffer.from(`${bookingId}.${expires}`).toString("base64url");
  return `${payload}.${sign(payload, key(secret))}`;
}

export function verifyBookingReceiptToken(
  token: string,
  { secret = process.env.SESSION_SECRET, now = Date.now() }: Opts = {},
): { bookingId: string } | null {
  const parts = typeof token === "string" ? token.split(".") : [];
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [payload, sig] = parts;
  const expected = Buffer.from(sign(payload, key(secret)));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;

  const decoded = Buffer.from(payload, "base64url").toString("utf8");
  const dot = decoded.lastIndexOf(".");
  if (dot <= 0) return null;
  const bookingId = decoded.slice(0, dot);
  const expires = Number(decoded.slice(dot + 1));
  if (!Number.isFinite(expires) || expires * 1000 < now) return null;
  return { bookingId };
}

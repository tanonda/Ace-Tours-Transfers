import crypto from "crypto";

// Invite links for "How was your tour?" emails. The token is
// base64url("<bookingId>.<expiresAtSeconds>") + "." + base64url(HMAC).
// No server state: the reviews (booking_id, tour_id) unique index is what makes
// a link single-use per product.
export const REVIEW_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

type Opts = { secret?: string; now?: number };

function key(secret: string | undefined): Buffer {
  if (!secret) throw new Error("SESSION_SECRET is required to sign review links");
  // Domain-separated so a review token can never pass as any other signed value.
  return crypto.createHmac("sha256", secret).update("review-invite:v1").digest();
}

const sign = (payload: string, k: Buffer) => crypto.createHmac("sha256", k).update(payload).digest("base64url");

export function signReviewToken(bookingId: string, { secret = process.env.SESSION_SECRET, now = Date.now() }: Opts = {}): string {
  const expires = Math.floor((now + REVIEW_TOKEN_TTL_MS) / 1000);
  const payload = Buffer.from(`${bookingId}.${expires}`).toString("base64url");
  return `${payload}.${sign(payload, key(secret))}`;
}

export function verifyReviewToken(token: string, { secret = process.env.SESSION_SECRET, now = Date.now() }: Opts = {}): { bookingId: string } | null {
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

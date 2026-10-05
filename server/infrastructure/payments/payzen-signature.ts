// server/infrastructure/payments/payzen-signature.ts

import { createHmac, timingSafeEqual } from 'crypto';

/**
 * PayZen (Lyra) form signature — Hosted Payment Page guide, chapter 13.
 * Values of every vads_ field, sorted by field name, joined with "+", then
 * "+<key>" appended; HMAC-SHA-256 with the same key, Base64-encoded.
 * The same computation verifies the Instant Payment Notification (IPN).
 */
export function computePayzenSignature(fields: Record<string, string>, key: string): string {
  const values = Object.keys(fields)
    .filter((name) => name.startsWith('vads_'))
    .sort()
    .map((name) => fields[name]);
  const message = [...values, key].join('+');
  return createHmac('sha256', key).update(message, 'utf8').digest('base64');
}

export function verifyPayzenSignature(fields: Record<string, string>, key: string): boolean {
  const received = fields.signature;
  if (!received) return false;
  const expected = Buffer.from(computePayzenSignature(fields, key));
  const actual = Buffer.from(received);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * vpc-secure-hash.ts
 *
 * Isolated, fully-tested VPC/MIGS secure-hash module.
 *
 * Used by MastercardGatewayAdapter (and therefore ANZ eGate, BSP eGate, and
 * BRED Bank eGate which all delegate to that shared adapter).
 *
 * ## Protocol background
 *
 * MIGS (Mastercard Internet Gateway Service) signs request and response
 * parameters using HMAC-SHA256 over the vpc_* fields. The exact format has
 * two variants — the newer KEY_VALUE format (recommended, default here) and
 * the legacy VALUE_CONCAT fallback:
 *
 *   KEY_VALUE   — sort vpc_* keys alphabetically, build `key=value&…` string,
 *                 HMAC-SHA256 the UTF-8 bytes, output uppercase hex.
 *
 *   VALUE_CONCAT — sort vpc_* keys alphabetically, concatenate values only,
 *                  HMAC-SHA256, uppercase hex.  (Legacy MIGS implementations.)
 *
 * In BOTH formats the following fields are EXCLUDED from the digest:
 *   - vpc_SecureHash      (the hash field itself)
 *   - vpc_SecureHashType  (the algorithm indicator — omitted in old impls, ← BUG)
 *   - any non-vpc_ prefixed key
 *   - any key whose value is an empty string
 *
 * ## Uncertain seams (confirm against BRED's integration guide)
 *
 * // CONFIRM-WITH-BRED: which hash format does BRED require?
 *   Default here is KEY_VALUE (standard HMAC-SHA256). Change the `hashFormat`
 *   field in the gateway config to 'VALUE_CONCAT' if BRED uses legacy format.
 *
 * // CONFIRM-WITH-BRED: is the secureHashSecret used as a UTF-8 string key
 *   (current implementation) or must it be hex-decoded first?
 *   If hex-decoded: replace Buffer.from(secret) with Buffer.from(secret, 'hex').
 */

import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Hash format variants for VPC/MIGS secure hash computation.
 *
 * KEY_VALUE   — HMAC-SHA256 over sorted `key=value&…` (standard, recommended)
 * VALUE_CONCAT — HMAC-SHA256 over sorted concatenated values (legacy fallback)
 *
 * // CONFIRM-WITH-BRED: verify which format their gateway requires.
 */
export type HashFormat = 'KEY_VALUE' | 'VALUE_CONCAT';

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Fields that must always be excluded from the hash digest, regardless of format. */
const EXCLUDED_FIELDS = new Set(['vpc_SecureHash', 'vpc_SecureHashType']);

/**
 * Returns the sorted, filtered list of vpc_* keys that participate in the
 * hash digest.  A key is included only when:
 *   - it starts with 'vpc_'
 *   - it is not in EXCLUDED_FIELDS
 *   - its value is a non-empty string
 */
function digestKeys(params: Record<string, string>): string[] {
  return Object.keys(params)
    .filter(k =>
      k.startsWith('vpc_') &&
      !EXCLUDED_FIELDS.has(k) &&
      params[k] !== '' &&
      params[k] !== undefined &&
      params[k] !== null,
    )
    .sort();
}

/**
 * Builds the raw string that will be fed to HMAC-SHA256.
 *
 * KEY_VALUE   → 'vpc_Amount=1000&vpc_Command=pay&…'
 * VALUE_CONCAT → '1000pay…'
 */
function buildDigestInput(
  params: Record<string, string>,
  keys: string[],
  format: HashFormat,
): string {
  if (format === 'KEY_VALUE') {
    return keys.map(k => `${k}=${params[k]}`).join('&');
  }
  // VALUE_CONCAT — legacy: values only, no separators
  return keys.map(k => params[k]).join('');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates a VPC/MIGS secure hash for the supplied params.
 *
 * @param params  - All vpc_* parameters for the request or response.
 *                  May include vpc_SecureHash / vpc_SecureHashType — they are
 *                  automatically excluded from the digest.
 * @param secret  - The secureHashSecret provided by the bank.
 *                  // CONFIRM-WITH-BRED: UTF-8 string key (current) or hex-decoded?
 * @param format  - Hash format to use (default: 'KEY_VALUE').
 * @returns Uppercase hex HMAC-SHA256 digest (64 characters).
 */
export function generate(
  params: Record<string, string>,
  secret: string,
  format: HashFormat = 'KEY_VALUE',
): string {
  const keys  = digestKeys(params);
  const input = buildDigestInput(params, keys, format);

  // // CONFIRM-WITH-BRED: if the secret must be hex-decoded use:
  //   Buffer.from(secret, 'hex')
  return crypto
    .createHmac('sha256', Buffer.from(secret))
    .update(input, 'utf8')
    .digest('hex')
    .toUpperCase();
}

/**
 * Verifies an incoming VPC/MIGS secure hash in a timing-safe manner.
 *
 * Call this on every callback/webhook from the bank before processing the
 * payment status. If it returns false, reject the request — do not update
 * any payment state.
 *
 * @param params        - All vpc_* parameters received from the bank callback.
 *                        May include vpc_SecureHash / vpc_SecureHashType — they
 *                        are excluded from the digest automatically.
 * @param receivedHash  - The hash value received in vpc_SecureHash.
 *                        Accepted in both uppercase and lowercase.
 * @param secret        - The secureHashSecret provided by the bank.
 * @param format        - Hash format to use (must match what was used to generate).
 * @returns true if the hash is valid, false otherwise.
 */
export function verify(
  params: Record<string, string>,
  receivedHash: string,
  secret: string,
  format: HashFormat = 'KEY_VALUE',
): boolean {
  const expected = generate(params, secret, format);

  // Normalise both sides to uppercase before timing-safe compare
  const expectedBuf = Buffer.from(expected.toUpperCase());
  const receivedBuf = Buffer.from(receivedHash.toUpperCase());

  // Length mismatch → different — but don't short-circuit before the alloc so
  // the constant-time guarantee isn't undermined by a branch.
  if (expectedBuf.length !== receivedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

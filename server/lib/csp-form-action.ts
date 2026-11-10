// server/lib/csp-form-action.ts

/**
 * CSP `form-action` sources. Without this directive helmet sends `form-action 'self'`,
 * which stops the browser posting the signed BRED (PayZen) payment form to PayZen.
 *
 * The PayZen hosted page origin is NOT hardcoded to one address: the adapter posts
 * to the "Payment URL" saved in Admin → Payments → BRED Bank (blank = the standard
 * page). This module keeps the allowlist in memory; `server/index.ts` rebuilds the
 * CSP header per request from it, and the value is refreshed at boot and whenever
 * an admin saves the gateway credentials. So pointing the field at a BRED-specific
 * page never requires a code change.
 *
 * The helmet configuration leaves FORM_ACTION_PLACEHOLDER in the static header;
 * the per-request middleware replaces it with the live sources below. A placeholder
 * is used (rather than rewriting the directive) so the replacement never depends on
 * helmet's serialization format.
 */
export const HOSTED_PAYMENT_FORM_ORIGINS = [
  "https://secure.payzen.eu", // standard Lyra PayZen hosted payment page
];

/** Marker in the static helmet directive; replaced with the live allowlist per request. */
export const FORM_ACTION_PLACEHOLDER = "https://form-action.invalid";

/**
 * The https origin of a payment-page URL, or null when it is blank, not a URL, or
 * not https. A plain-http origin is deliberately refused: the checkout page is
 * https, so the browser would block the POST anyway, and we never widen CSP to
 * plain http.
 */
export function httpsOrigin(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.origin : null;
  } catch {
    return null;
  }
}

let configuredPaymentUrl: string | null = null;

/** Records the PayZen "Payment URL" currently saved in the admin gateway row. */
export function setConfiguredHostedPaymentUrl(url: string | null | undefined): void {
  configuredPaymentUrl = url ?? null;
}

/** The configured Payment URL (blank/undefined when the standard page is used). */
export function getConfiguredHostedPaymentUrl(): string | null {
  return configuredPaymentUrl;
}

/** The live `form-action` allowlist: the site itself plus every known hosted payment page. */
export function getFormActionSources(): string[] {
  const sources = ["'self'", ...HOSTED_PAYMENT_FORM_ORIGINS];
  const configuredOrigin = httpsOrigin(configuredPaymentUrl);
  if (configuredOrigin && !sources.includes(configuredOrigin)) {
    sources.push(configuredOrigin);
  }
  return sources;
}

/**
 * Swap the sentinel in helmet's `Content-Security-Policy` header for the live
 * allowlist. Returns the header unchanged when the sentinel is absent (for example
 * a response whose CSP was not produced by this app's helmet config).
 */
export function applyFormActionSources(header: string): string {
  if (!header.includes(FORM_ACTION_PLACEHOLDER)) return header;
  const hostedOrigins = getFormActionSources().filter((source) => source !== "'self'");
  return header.replace(FORM_ACTION_PLACEHOLDER, hostedOrigins.join(" "));
}

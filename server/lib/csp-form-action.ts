/**
 * CSP form-action sources. Without this directive helmet sends form-action 'self',
 * which stops the browser posting the signed BRED (PayZen) payment form to PayZen.
 *
 * If BRED gives its own payment page address (the "Payment URL" field in
 * Admin → Payments), add that origin here too, or its card payments are blocked.
 */
export const HOSTED_PAYMENT_FORM_ORIGINS = [
  "https://secure.payzen.eu", // BRED Bank (Lyra PayZen) hosted payment page
];

export const formActionSources = ["'self'", ...HOSTED_PAYMENT_FORM_ORIGINS];

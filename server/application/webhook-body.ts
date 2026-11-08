/**
 * Webhook body normalisation.
 *
 * The HTTP layer reads every webhook as a raw Buffer so gateway signatures can be
 * checked over the exact bytes received (Stripe, mobile money). The adapters,
 * however, expect different shapes:
 *
 *   Stripe                  raw Buffer               (signature over bytes)
 *   BRED / PayZen           form fields object       (signature inside the fields)
 *   MPGS (ANZ/BSP/NBV)      JSON object              (body is only a trigger; order is re-read)
 *   WanTok/Digicel/KwikPay  raw string               (HMAC over the exact body)
 *   PayPal                  JSON object              (verified through the PayPal API)
 *
 * `parseWebhookBody` is the single place that knows this mapping, so the route and
 * its tests cannot drift apart again.
 */

import { isMpgsGateway } from "../infrastructure/payments/mpgs.adapter.js";

/** Gateways whose webhook endpoint is implemented. Anything else is a 405. */
export const WEBHOOK_GATEWAYS = new Set([
  "stripe",
  "bred-bank",
  "anz-egate",
  "bsp-bank",
  "nbv-bank",
  "paypal",
  "google-pay",
  "apple-pay",
  "wantok-money",
  "digicel-mobile-money",
  "kwikpay",
]);

export function isSupportedWebhookGateway(slug: string): boolean {
  return WEBHOOK_GATEWAYS.has(slug) || isMpgsGateway(slug);
}

/** Gateways whose callbacks are answered in plain text because that is what they log. */
export function wantsTextWebhookReply(slug: string): boolean {
  return slug === "bred-bank" || slug === "google-pay" || slug === "apple-pay" || isMpgsGateway(slug);
}

export function parseWebhookBody(gatewaySlug: string, body: unknown): any {
  // Tests, or a future middleware, may already have parsed the body.
  if (!Buffer.isBuffer(body)) return body;

  const text = body.toString("utf8");
  if (!text) return {};

  if (gatewaySlug === "stripe") return body;

  if (gatewaySlug === "bred-bank" || gatewaySlug === "google-pay" || gatewaySlug === "apple-pay") {
    const fields: Record<string, string> = {};
    new URLSearchParams(text).forEach((value, key) => {
      fields[key] = value;
    });
    return fields;
  }

  if (isMpgsGateway(gatewaySlug)) {
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  // Mobile money adapters HMAC the exact request body, so keep it as a string.
  if (gatewaySlug === "paypal") {
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }

  return text;
}

/**
 * The signature a gateway sends. Header lookup is case-insensitive in Express,
 * but the adapters also accept the value through `signature`.
 */
export function webhookSignature(gatewaySlug: string, headers: Record<string, unknown>): string | undefined {
  const header = (name: string) => {
    const value = headers[name];
    return typeof value === "string" ? value : undefined;
  };

  if (gatewaySlug === "stripe") return header("stripe-signature");

  return (
    header("x-signature") ||
    header("x-notification-secret") ||
    header(`x-${gatewaySlug}-signature`) ||
    header("x-wantok-signature") ||
    header("x-digicel-signature") ||
    header("x-kwikpay-signature")
  );
}

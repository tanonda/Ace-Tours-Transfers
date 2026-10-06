import type { PaymentGateway } from "../../shared/schema.js";
import { isGatewayEnabledByEnv } from "../config.js";

/**
 * The only shape of a payment gateway that may leave the server on a public route.
 * `credentials` (merchant secrets, e.g. the VPC secure-hash secret) and `config`
 * are stored in plain JSON, so returning a raw row would let anyone forge callbacks.
 */
export function toPublicGateway(g: PaymentGateway) {
  return {
    id: g.id,
    slug: g.slug,
    displayName: g.displayName,
    description: g.description,
    active: g.active,
    isDefault: g.isDefault,
    supportedCurrencies: g.supportedCurrencies,
  };
}

/**
 * A gateway whose bank credentials are in TEST mode takes only test cards, whose
 * numbers are published: a guest using one would get a booking confirmed unpaid.
 * Such a gateway is for admins running the bank's test payments only.
 */
export function isTestModeGateway(g: PaymentGateway): boolean {
  return (g.credentials as { mode?: string } | null)?.mode === "TEST";
}

/** The gateways a visitor may see and pay with, shared by every public payment list. */
export function visibleGateways(
  gateways: PaymentGateway[],
  flags: { slug: string; enabled: boolean }[],
  viewer: { isAdmin: boolean },
): PaymentGateway[] {
  const isFlagEnabled = (slug: string, defaultValue = true) => flags.find((f) => f.slug === slug)?.enabled ?? defaultValue;
  const stripeExplicitlyEnabled = process.env.STRIPE_ENABLED === "true";

  return gateways.filter((g) => {
    if (!g.active) return false;
    // Switched off on the server (PAYMENTS_<KEY>_ENABLED): checkout would refuse it.
    if (!isGatewayEnabledByEnv(g.slug)) return false;
    if (isTestModeGateway(g) && !viewer.isAdmin) return false;
    const slug = g.slug.toLowerCase();

    if (slug === "stripe") return stripeExplicitlyEnabled && isFlagEnabled("payment-stripe", false);
    if (slug === "manual" || slug === "manual_transfer") return isFlagEnabled("payment-bank-transfer");
    if (slug === "cash") return isFlagEnabled("payment-cash-on-delivery");
    return true;
  });
}

import type { PaymentGateway } from "../../shared/schema.js";

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

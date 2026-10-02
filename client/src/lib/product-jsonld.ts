export interface OfferInput {
  /** Whole VUV. Product "*PriceCents" fields hold whole vatu, not cents. */
  price: number;
  currency: string;
  availability?: "InStock" | "OutOfStock" | "LimitedAvailability";
}

/** Build the schema.org Offer for a product detail page's JSON-LD. */
export function buildOfferJsonLd(offer: OfferInput, url: string, sellerName: string) {
  return {
    "@type": "Offer",
    // VUV has no minor unit, so the stored amount is the price as-is.
    price: String(Math.round(offer.price)),
    priceCurrency: offer.currency,
    availability: `https://schema.org/${offer.availability ?? "InStock"}`,
    url,
    seller: { "@type": "Organization", name: sellerName },
  };
}

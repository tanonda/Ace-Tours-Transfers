export interface OfferInput {
  /** Whole VUV. Product "*PriceCents" fields hold whole vatu, not cents. */
  price: number;
  currency: string;
  availability?: "InStock" | "OutOfStock" | "LimitedAvailability";
}

// Tours and transfers are services delivered in Vanuatu. Google's merchant
// listings report still asks every Offer for shipping and return details, so
// state the truth: no shipping cost or delay, and no returns once delivered
// (the 24h free-cancellation window happens before delivery, not after).
const SERVICE_COUNTRY = "VU";
const ZERO_DAYS = { "@type": "QuantitativeValue", minValue: 0, maxValue: 0, unitCode: "DAY" };

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
    shippingDetails: {
      "@type": "OfferShippingDetails",
      shippingRate: { "@type": "MonetaryAmount", value: 0, currency: offer.currency },
      shippingDestination: { "@type": "DefinedRegion", addressCountry: SERVICE_COUNTRY },
      deliveryTime: {
        "@type": "ShippingDeliveryTime",
        handlingTime: ZERO_DAYS,
        transitTime: ZERO_DAYS,
      },
    },
    hasMerchantReturnPolicy: {
      "@type": "MerchantReturnPolicy",
      applicableCountry: SERVICE_COUNTRY,
      returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
    },
  };
}

export interface RatedReview {
  author: string;
  rating: number;
  body?: string | null;
  datePublished?: string;
}

/**
 * Product rating markup from approved first-party reviews. Returns null when
 * there are none — Google treats an empty or invented rating as spam. Never
 * attach this to LocalBusiness/Organization (self-serving ratings are ignored
 * there and risk a manual action).
 */
export function buildRatingJsonLd(reviews: RatedReview[]) {
  if (reviews.length === 0) return null;
  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  return {
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: avg.toFixed(1),
      bestRating: "5",
      reviewCount: reviews.length,
    },
    review: reviews.slice(0, 5).map((r) => ({
      "@type": "Review",
      reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
      author: { "@type": "Person", name: r.author },
      ...(r.body ? { reviewBody: r.body } : {}),
      ...(r.datePublished ? { datePublished: r.datePublished } : {}),
    })),
  };
}

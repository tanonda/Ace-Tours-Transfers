const TEXT_CONTAMINATED_IMAGE_PATTERNS = [
  "events_transport",
  "vila_city_market",
  "dinner_transfer",
  "hospitality_transfer",
  "blue_lagoon_turtle",
  "events-transfer",
  "port-vila-city-market",
  "dinner-transfer",
  "hospitality-transfer",
  "blue-lagoon-turtle",
];

// Temporary neutral fallback until clean replacements are uploaded for these products.
const TEXT_FREE_PRODUCT_FALLBACK = "/assets/hero_bg.png";

export function hasTextContaminatedImage(imageUrl: string | null | undefined): boolean {
  if (!imageUrl) return false;
  const normalizedUrl = imageUrl.toLowerCase();
  return TEXT_CONTAMINATED_IMAGE_PATTERNS.some((pattern) => normalizedUrl.includes(pattern));
}

export function getProductImage(imageUrl: string | null | undefined): string {
  return hasTextContaminatedImage(imageUrl) ? TEXT_FREE_PRODUCT_FALLBACK : imageUrl || TEXT_FREE_PRODUCT_FALLBACK;
}

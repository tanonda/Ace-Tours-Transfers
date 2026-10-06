export const DEFAULT_SITE_URL = "https://acetoursvanuatu.com";

// Must be spelled out in full: the URL parser would quietly accept "https:acetoursvanuatu.com".
const FULL_ORIGIN = /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(:\d+)?\/?$/i;
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i;

/**
 * The canonical site address for SEO tags (canonical link, Open Graph, JSON-LD).
 * VITE_APP_URL is used only when it is a complete https:// origin (or a local dev
 * address); anything else (a typo, a path, a missing "//") falls back to the default,
 * so a bad build variable cannot point Google at broken addresses.
 */
export function resolveSiteUrl(raw: string | undefined): string {
  const value = raw?.trim() ?? "";
  if (FULL_ORIGIN.test(value) || LOCAL_ORIGIN.test(value)) return value.replace(/\/$/, "");
  if (value) console.warn(`[site-url] Ignoring VITE_APP_URL "${value}": expected e.g. ${DEFAULT_SITE_URL}`);
  return DEFAULT_SITE_URL;
}

export const SITE_URL = resolveSiteUrl(import.meta.env.VITE_APP_URL as string | undefined);

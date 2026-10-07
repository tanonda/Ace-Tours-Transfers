/**
 * Site settings are served on public routes because the storefront needs some of them
 * (contact details, analytics IDs, payment instructions). Only allow-listed keys reach
 * visitors: a new setting stays admin-only until it is added here, so a secret saved
 * under an innocent name (smtp_host, booking_alert_email) is never published by default.
 */
const PUBLIC_SETTING_KEYS = new Set([
  "app_url",
  "booking_cutoff_hours",
  "booking_terms",
  "business_info",
  "business_name",
  "cancellation_note",
  "cancellation_policy",
  "cancellation_weather",
  "contact_for_price",
  "default_capacity",
  "default_currency",
  "email_from_name",
  "email_reply_time",
  "footer_backlinks",
  "ga4_measurement_id",
  "gtm_container_id",
  "hero_image",
  "launch_date",
  "review_provider",
  "site_email",
  "site_phone",
]);
// Families of storefront settings: coming-soon page, SEO, structured data, social links,
// contact details, and the instructions shown for each offline payment method.
const PUBLIC_SETTING_PREFIXES = [
  "bank_transfer_",
  "cash_",
  "contact_",
  "cs_",
  "ewallet_",
  "schema_",
  "seo_",
  "social_",
  "whatsapp",
];
const PRIVATE_KEY_PATTERN = /(secret|password|token|api_?key)/i;

export function isPrivateSettingKey(key: string): boolean {
  if (PRIVATE_KEY_PATTERN.test(key)) return true;
  return !(PUBLIC_SETTING_KEYS.has(key) || PUBLIC_SETTING_PREFIXES.some((prefix) => key.startsWith(prefix)));
}

export function visibleSettings<T extends { key: string }>(settings: T[], isAdmin: boolean): T[] {
  return isAdmin ? settings : settings.filter((s) => !isPrivateSettingKey(s.key));
}

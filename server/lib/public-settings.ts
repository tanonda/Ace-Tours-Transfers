/**
 * Site settings are served on public routes because the storefront needs most of them
 * (contact details, analytics IDs, payment instructions). These must stay admin-only.
 */
const PRIVATE_SETTING_KEYS = new Set(["admin_email"]);
const PRIVATE_KEY_PATTERN = /(secret|password|token|api_?key)/i;

export function isPrivateSettingKey(key: string): boolean {
  return PRIVATE_SETTING_KEYS.has(key) || PRIVATE_KEY_PATTERN.test(key);
}

export function visibleSettings<T extends { key: string }>(settings: T[], isAdmin: boolean): T[] {
  return isAdmin ? settings : settings.filter((s) => !isPrivateSettingKey(s.key));
}

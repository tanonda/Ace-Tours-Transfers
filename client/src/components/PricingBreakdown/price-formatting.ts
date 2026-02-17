// Fix #13: Use Intl.NumberFormat for correct international currency formatting.
// The old implementation always appended ".00" which is wrong for currencies like
// VUV (Vanuatu Vatu) that have no decimal places, and JPY, KRW, etc.
//
// Currency symbol mapping for currencies not supported well by all browsers
const CURRENCY_LOCALE_MAP: Record<string, string> = {
  VUV: 'en-VU',
  USD: 'en-US',
  AUD: 'en-AU',
  NZD: 'en-NZ',
  EUR: 'fr-FR',
  GBP: 'en-GB',
  JPY: 'ja-JP',
};

// Currencies that store values in whole units (no cents subdivision)
// VUV is the primary case here — amounts are already in Vatu, not centimes
const WHOLE_UNIT_CURRENCIES = new Set(['VUV', 'JPY', 'KRW', 'IDR', 'PYG', 'VND']);

export function formatCurrency(amountCents: number, currency: string = 'VUV'): string {
  // For whole-unit currencies, the amount is already in the base unit (not cents)
  const amount = WHOLE_UNIT_CURRENCIES.has(currency.toUpperCase())
    ? amountCents        // e.g. 7500 VUV → "VT 7,500"
    : amountCents / 100; // e.g. 2400 USD cents → "$24.00"

  const locale = CURRENCY_LOCALE_MAP[currency.toUpperCase()] || 'en-US';

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: WHOLE_UNIT_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2,
      maximumFractionDigits: WHOLE_UNIT_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2,
    }).format(amount);
  } catch {
    // Fallback for unrecognised currency codes
    return `${currency} ${amount.toFixed(WHOLE_UNIT_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2)}`;
  }
}

export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function centsToBaseUnit(amountCents: number, currency: string = 'VUV'): number {
  return WHOLE_UNIT_CURRENCIES.has(currency.toUpperCase())
    ? amountCents
    : amountCents / 100;
}

export function baseUnitToCents(amount: number, currency: string = 'VUV'): number {
  return WHOLE_UNIT_CURRENCIES.has(currency.toUpperCase())
    ? Math.round(amount)
    : Math.round(amount * 100);
}

// Keep the old helpers as typed aliases for backwards compatibility
/** @deprecated Use centsToBaseUnit() instead */
export function centsToEuros(amountCents: number): number {
  return amountCents / 100;
}

/** @deprecated Use baseUnitToCents() instead */
export function eurosToCents(amountEuros: number): number {
  return Math.round(amountEuros * 100);
}

/**
 * Discount and surcharge rules applied at checkout, edited in Admin → Pricing.
 *
 * Stored as one site setting (`pricing_rules`). The server's PricingEngine charges
 * with these rules; the client reads the same setting to label them. Defaults
 * match the rules that were hard-coded before they moved into the admin.
 */

export const PRICING_RULES_SETTING_KEY = 'pricing_rules';

export interface PricingRules {
  /** Percentage off per-person tours when a booking reaches `minAdults`. Never applies to flat group packages. */
  groupDiscount: { enabled: boolean; minAdults: number; percent: number };
  /** Percentage added for bookings dated in `months` (0 = January … 11 = December). */
  peakSeason: { enabled: boolean; months: number[]; percent: number };
  /** Vanuatu VAT. `included`: advertised prices already contain it (the brochure and site labels say so). */
  vat: { percent: number; included: boolean };
}

export const DEFAULT_PRICING_RULES: PricingRules = {
  groupDiscount: { enabled: true, minAdults: 7, percent: 10 },
  peakSeason: { enabled: true, months: [0, 11], percent: 20 },
  vat: { percent: 15, included: true },
};

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

function num(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Never throws: anything malformed falls back to the default for that field. */
export function parsePricingRules(value: unknown): PricingRules {
  const root = obj(value);
  const gd = obj(root.groupDiscount);
  const ps = obj(root.peakSeason);
  const vat = obj(root.vat);
  const d = DEFAULT_PRICING_RULES;

  const months = Array.isArray(ps.months)
    ? Array.from(new Set(ps.months.filter((m): m is number => Number.isInteger(m) && m >= 0 && m <= 11))).sort((a, b) => a - b)
    : d.peakSeason.months;

  return {
    groupDiscount: {
      enabled: bool(gd.enabled, d.groupDiscount.enabled),
      minAdults: Math.round(num(gd.minAdults, d.groupDiscount.minAdults, 1, 100)),
      percent: num(gd.percent, d.groupDiscount.percent, 0, 100),
    },
    peakSeason: {
      enabled: bool(ps.enabled, d.peakSeason.enabled),
      months,
      percent: num(ps.percent, d.peakSeason.percent, 0, 100),
    },
    vat: {
      percent: num(vat.percent, d.vat.percent, 0, 50),
      included: bool(vat.included, d.vat.included),
    },
  };
}

export function pricingRulesFromSettings(rows: ReadonlyArray<{ key: string; value: unknown }> | undefined): PricingRules {
  return parsePricingRules(rows?.find((r) => r.key === PRICING_RULES_SETTING_KEY)?.value);
}

/** True when a booking qualifies for the group discount. Flat group packages never do. */
export function groupDiscountApplies(rules: PricingRules, pricingType: string | null | undefined, adultPax: number): boolean {
  const gd = rules.groupDiscount;
  return gd.enabled && gd.percent > 0 && pricingType !== 'group' && adultPax >= gd.minAdults;
}

/** True when the booking date falls in an active peak-season month. */
export function peakSeasonApplies(rules: PricingRules, date: Date | string | null | undefined): boolean {
  const ps = rules.peakSeason;
  if (!date || !ps.enabled || ps.percent <= 0) return false;
  const month = (date instanceof Date ? date : new Date(date)).getMonth();
  return ps.months.includes(month);
}

export function groupDiscountLabel(rules: PricingRules): string {
  return `${rules.groupDiscount.percent}% group discount (${rules.groupDiscount.minAdults}+ adults)`;
}

export function peakSeasonLabel(rules: PricingRules): string {
  const months = rules.peakSeason.months.map((m) => MONTH_NAMES[m].slice(0, 3)).join('/');
  return `${rules.peakSeason.percent}% peak season surcharge (${months})`;
}

/** Client-side estimate (the server's PricingEngine is authoritative at checkout). */
export function estimateWithRules(
  rules: PricingRules,
  subtotal: number,
  booking: { pricingType?: string | null; adultPax: number; date?: Date | string | null },
): { total: number; appliedRules: string[] } {
  let total = subtotal;
  const appliedRules: string[] = [];
  if (groupDiscountApplies(rules, booking.pricingType, booking.adultPax)) {
    total = Math.round(total * (1 - rules.groupDiscount.percent / 100));
    appliedRules.push(groupDiscountLabel(rules));
  }
  if (peakSeasonApplies(rules, booking.date)) {
    total = Math.round(total * (1 + rules.peakSeason.percent / 100));
    appliedRules.push(peakSeasonLabel(rules));
  }
  return { total, appliedRules };
}

/**
 * Split a charged amount into net + VAT. With VAT-inclusive pricing the customer
 * pays the advertised amount and the VAT is the share inside it; otherwise VAT
 * is added on top.
 */
export function vatBreakdown(rules: PricingRules, amountCents: number): { netCents: number; vatCents: number; totalCents: number } {
  const rate = rules.vat.percent / 100;
  if (rules.vat.included) {
    const vatCents = Math.round((amountCents * rate) / (1 + rate));
    return { netCents: amountCents - vatCents, vatCents, totalCents: amountCents };
  }
  const vatCents = Math.round(amountCents * rate);
  return { netCents: amountCents, vatCents, totalCents: amountCents + vatCents };
}

/** "Incl. 15% VAT" or "+ 15% VAT" (empty when VAT is 0%). */
export function vatLabel(rules: PricingRules): string {
  if (rules.vat.percent <= 0) return '';
  return rules.vat.included ? `Incl. ${rules.vat.percent}% VAT` : `+ ${rules.vat.percent}% VAT`;
}

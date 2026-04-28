/**
 * Product Types & Pricing Utilities
 *
 * INVARIANT: All prices stored/calculated in VUV integer units (1 unit = 1 VUV).
 * INVARIANT: Product type determined by `category` field, never by ID matching.
 * INVARIANT: `pricingType` controls how the checkout calculates total:
 *   - "per_person" → adultPriceCents × adults + childPriceCents × children
 *   - "group"      → flat groupPriceCents regardless of pax (e.g. private tour)
 */

import { CURRENCIES, formatInCurrency, type CurrencyCode } from '@/lib/currency-context';

// ─── Re-export for consumers that import from here ───────────────────────────
export { CURRENCIES, formatInCurrency };
// Legacy alias used by older code
export const EXCHANGE_RATES = Object.fromEntries(
  Object.entries(CURRENCIES).map(([k, v]) => [k, { rate: v.rateFromVUV, symbol: v.symbol }])
);

// ─── Pricing Type ─────────────────────────────────────────────────────────────

/**
 * per_person  — classic per-head pricing (adult + child rates)
 * group       — flat rate for the whole booking/group (e.g. private charter)
 *               The admin can optionally still specify an "included pax" hint for display.
 */
export type PricingType = 'per_person' | 'group';

// ─── Core Types ───────────────────────────────────────────────────────────────

export type ProductCategory = 'tour' | 'transfer';

export interface Addon {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  active: boolean;
}

export interface ProductData {
  id: string;
  title: string;
  category: ProductCategory;
  /** Controls checkout calculation mode */
  pricingType: PricingType;
  /** Per-person pricing — used when pricingType === 'per_person' */
  adultPriceCents: number;
  childPriceCents: number;
  /** Flat group/package pricing — used when pricingType === 'group' */
  groupPriceCents: number;
  /** Optional: max pax included in group price (display hint only) */
  groupMaxPax?: number;
  duration: string;
  minPax: string | null;
  image: string;
  description: string | string[];
  capacity: number;
  defaultCapacity?: number;
  addons?: Addon[];
  // Legacy fields — do not use for calculations
  price?: string;
  childPrice?: string;
}

// ─── Formatting Helpers ───────────────────────────────────────────────────────

/**
 * Format a VUV integer amount in the given display currency.
 * Replacement for the old formatPrice() which had a /100 bug for VUV.
 *
 * @param vuvAmount  - Amount in VUV integer units
 * @param currency   - Display currency (defaults to 'VUV')
 */
export function formatPriceDisplay(vuvAmount: number, currency: CurrencyCode | string = 'VUV'): string {
  return formatInCurrency(vuvAmount, currency);
}

/**
 * @deprecated Use formatPriceDisplay() instead.
 * This version had a /100 bug for VUV (VUV is not a cent-based currency).
 * Kept only for backward compatibility during migration.
 */
export function formatPrice(
  cents: number,
  options: { includeDecimals?: boolean; includeCurrency?: boolean; currencyCode?: string } = {}
): string {
  const { currencyCode = 'VUV' } = options;
  // Fix: VUV amounts should NOT be divided by 100
  const cur = CURRENCIES[currencyCode.toUpperCase()];
  const amount = cur?.isWholeUnit ? cents : cents / 100;
  const converted = amount * (cur?.rateFromVUV ?? 1);
  const sym = cur?.symbol ?? currencyCode;
  if (cur?.isWholeUnit) {
    return `${sym} ${Math.round(converted).toLocaleString('en-US')}`;
  }
  return `${sym}${converted.toFixed(2)}`;
}

// ─── Pricing Calculation (client-side estimate only) ─────────────────────────

/**
 * @deprecated Use backend API (POST /api/cart/price) for authoritative pricing.
 * This client-side function is for UI preview only. Does NOT apply group discounts,
 * seasonal surcharges, or VAT. Those are enforced server-side.
 */
export function estimateBookingTotal(
  product: Pick<ProductData, 'pricingType' | 'adultPriceCents' | 'childPriceCents' | 'groupPriceCents'>,
  adultPax: number,
  childPax: number
): number {
  if (product.pricingType === 'group') {
    return product.groupPriceCents;
  }
  return adultPax * product.adultPriceCents + childPax * product.childPriceCents;
}

/**
 * Product Types & Pricing Utilities
 * 
 * This module provides the shared type contract for products (tours, transfers, vehicles)
 * and utility functions for consistent price formatting across the application.
 * 
 * INVARIANT: All prices are stored and calculated in VUV cents.
 * INVARIANT: Product type is determined by `category` field, never by ID matching.
 */

export type ProductCategory = "tour" | "transfer" | "vehicle";

export interface Addon {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  active: boolean;
}

export interface VehicleDetails {
  make?: string;
  model?: string;
  year?: number;
  fuelType?: string;
  transmission?: string;
  seats?: number;
  features?: string[];
}

export interface ProductData {
  id: string;
  title: string;
  category: ProductCategory;
  adultPriceCents: number;
  childPriceCents: number;
  duration: string;
  minPax: string | null;
  image: string;
  description: string | string[];
  capacity: number;
  defaultCapacity?: number;
  vehicleDetails?: VehicleDetails;
  addons?: Addon[];
  // Legacy fields (deprecated - do not use for calculations)
  price?: string;
  childPrice?: string;
}

/**
 * Exchange rates relative to VUV (matching server-side CurrencyService)
 */
export const EXCHANGE_RATES: Record<string, { rate: number; symbol: string }> = {
  VUV: { rate: 1, symbol: 'VT' },
  USD: { rate: 0.0084, symbol: '$' },
  AUD: { rate: 0.013, symbol: 'A$' },
  EUR: { rate: 0.0078, symbol: '€' },
};

/**
 * Formats a price in VUV cents to a display string with optional currency conversion.
 */
export function formatPrice(
  cents: number,
  options: {
    includeDecimals?: boolean;
    includeCurrency?: boolean;
    currencyCode?: string;
  } = {}
): string {
  const { includeDecimals = false, includeCurrency = true, currencyCode = 'VUV' } = options;
  const exchange = EXCHANGE_RATES[currencyCode.toUpperCase()] || EXCHANGE_RATES.VUV;

  const amount = (cents / 100) * exchange.rate;

  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: includeDecimals ? (currencyCode === 'VUV' ? 0 : 2) : 0,
    maximumFractionDigits: includeDecimals ? (currencyCode === 'VUV' ? 0 : 2) : 0,
  });

  if (!includeCurrency) return formatted;

  if (currencyCode === 'VUV') {
    return `VUV ${formatted}`;
  }

  return `${exchange.symbol}${formatted}`;
}

/**
 * @deprecated Use backend pricing API (POST /api/cart/price) instead
 * This client-side calculation does NOT include group discounts, seasonal surcharges, or VAT.
 * The backend PricingEngine is the single source of truth for all pricing rules.
 * 
 * This function is kept for backward compatibility during frontend migration (Phase 2C).
 * It will be removed in Phase 2E once all frontend code uses backend pricing.
 * 
 * @param adultPriceCents - Adult price in cents
 * @param childPriceCents - Child price in cents  
 * @param adultCount - Number of adults
 * @param childCount - Number of children
 * @param addonTotalCents - Add-ons total in cents (default: 0)
 * @returns Base total price in cents (without rules applied)
 * 
 * Migration Path:
 * Replace: calculateLineTotal(adultPrice, childPrice, adults, children, addons)
 * With:    const pricing = await fetchPricing({productId, date, adultPax, childPax, addonIds})
 *          Use: pricing.breakdown.finalTotalCents
 */
export function calculateLineTotal(
  adultPriceCents: number,
  childPriceCents: number,
  adultCount: number,
  childCount: number,
  addonTotalCents: number = 0
): number {
  console.warn(
    '[DEPRECATED] calculateLineTotal() is deprecated. Use backend pricing API instead (POST /api/cart/price). ' +
    'This function does not include discounts, surcharges, or VAT.'
  );
  return (adultPriceCents * adultCount) + (childPriceCents * childCount) + addonTotalCents;
}

/**
 * Type guard to check if a product is a vehicle
 */
export function isVehicle(product: ProductData): boolean {
  return product.category === "vehicle";
}

/**
 * Type guard to check if a product is a transfer
 */
export function isTransfer(product: ProductData): boolean {
  return product.category === "transfer";
}

/**
 * Type guard to check if a product is a tour
 */
export function isTour(product: ProductData): boolean {
  return product.category === "tour";
}

/**
 * Formats price in standard display format: "VUV 12,000"
 * Use this for product detail pages, booking forms, and modal views.
 */
export function formatPriceDisplay(cents: number, currencyCode: string = 'VUV'): string {
  return formatPrice(cents, { includeCurrency: true, includeDecimals: false, currencyCode });
}

/**
 * Formats price in short format: "12,000 VT"
 * Use this for cart, payment, and checkout views for consistency.
 */
export function formatPriceShort(cents: number, currencyCode: string = 'VUV'): string {
  const exchange = EXCHANGE_RATES[currencyCode.toUpperCase()] || EXCHANGE_RATES.VUV;
  const amount = (cents / 100) * exchange.rate;

  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  return currencyCode === 'VUV' ? `${formatted} VT` : `${exchange.symbol}${formatted}`;
}

/**
 * Backend Pricing Result - from PricingEngine (Phase 2B)
 */
export interface PriceBreakdown {
  baseTotalCents: number;           // Before discounts/surcharges
  adultSubtotalCents: number;       // Adults only (before rules)
  childSubtotalCents: number;       // Children only (before rules)
  addonsSubtotalCents: number;      // Add-ons total
  discountsCents: number;           // Negative value
  surchargesCents: number;          // Positive value
  finalTotalCents: number;          // After all rules → USE THIS FOR PRICES
  appliedRules: string[];           // Human-readable rules
}

export interface PricingResult {
  breakdown: PriceBreakdown;
  appliedDiscounts?: string[];
}

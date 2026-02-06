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
 * Calculates the total price for a booking line item.
 * 
 * @param adultPriceCents - Adult price in cents
 * @param childPriceCents - Child price in cents  
 * @param adultCount - Number of adults
 * @param childCount - Number of children
 * @returns Total price in cents
 */
export function calculateLineTotal(
  adultPriceCents: number,
  childPriceCents: number,
  adultCount: number,
  childCount: number,
  addonTotalCents: number = 0
): number {
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

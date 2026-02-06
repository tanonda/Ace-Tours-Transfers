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
  // Legacy fields (deprecated - do not use for calculations)
  price?: string;
  childPrice?: string;
}

/**
 * Formats a price in VUV cents to a display string.
 * 
 * @param cents - Price in VUV cents (e.g., 1200000 = 12,000 VUV)
 * @param options - Formatting options
 * @returns Formatted price string (e.g., "VUV 12,000")
 */
export function formatPrice(
  cents: number,
  options: {
    includeDecimals?: boolean;
    includeCurrency?: boolean;
  } = {}
): string {
  const { includeDecimals = false, includeCurrency = true } = options;
  const amount = cents / 100;

  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0,
  });

  return includeCurrency ? `VUV ${formatted}` : formatted;
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
  childCount: number
): number {
  return (adultPriceCents * adultCount) + (childPriceCents * childCount);
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
export function formatPriceDisplay(cents: number): string {
  return formatPrice(cents, { includeCurrency: true, includeDecimals: false });
}

/**
 * Formats price in short format: "12,000 VT"
 * Use this for cart, payment, and checkout views for consistency.
 */
export function formatPriceShort(cents: number): string {
  const amount = cents / 100;
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${formatted} VT`;
}

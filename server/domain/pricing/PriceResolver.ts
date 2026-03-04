// server/domain/pricing/PriceResolver.ts

import { IStorage } from '../../storage.js';
import { Tour } from '../../../shared/schema.js';
import { PricingEngine, TourRate, formatVUVInCurrency } from './PricingEngine.js';

/**
 * PriceResolver: PHASE 2B - NOW DELEGATES TO PRICINGENGINE
 * 
 * (Backward compatibility wrapper maintained for existing code)
 * ALL pricing logic has moved to PricingEngine.ts - the single source of truth
 * 
 * This class is now a thin wrapper that delegates to PricingEngine.
 * All prices are handled in CENTS (e.g., 12000 = VUV 120.00).
 */
export class PriceResolver {
  private storage: IStorage;
  private engine: PricingEngine;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.engine = new PricingEngine(storage);
  }

  /**
   * Fetch the effective rates for a tour at a given point in time.
   * DELEGATES to PricingEngine.getTourRate()
   * @param tourId Product ID
   * @param date Optional booking date (YYYY-MM-DD) for versioned pricing lookup
   */
  async getTourRate(tourId: string, date?: string): Promise<TourRate | null> {
    return this.engine.getTourRate(tourId, date);
  }

  /**
   * Calculate the total for a booking item
   * DELEGATES to PricingEngine.calculateSimple()
   * 
   * NOTE: This is a simple calculation without full breakdown.
   * For full pricing with breakdown, use PricingEngine.calculateLineItem() instead.
   */
  calculateItemTotal(
    adultPax: number,
    childPax: number,
    rates: TourRate,
    addonTotalCents: number = 0,
    date?: string
  ): number {
    // Use engine's simple calculation
    let total = this.engine.calculateSimple(adultPax, childPax, rates, date);

    // Add add-ons (if any)  
    total += addonTotalCents;

    return total;
  }

  /**
   * Calculate the grand total across multiple items.
   * @deprecated Use PricingEngine.calculateCartTotal() instead
   */
  calculateCartTotal(items: Array<{ subtotalCents: number }>): number {
    return items.reduce((sum, item) => sum + item.subtotalCents, 0);
  }

  /**
   * Format cents as currency string for display only.
   */
  static formatCentsAsVUV(cents: number): string {
    // C1 Fix: Delegate to engine which now correctly handles VUV as zero-decimal
    return formatVUVInCurrency(cents, 'VUV');
  }

  /**
   * Helper to parse legacy text prices during backfill
   * Convert "VUV 15,000" or "$120" -> cents
   */
  static parseAmountTextToCents(text: string | null | undefined): number {
    if (!text) return 0;

    // Remove currency symbols, commas, and anything after "/"
    let cleaned = text
      .replace(/[VUV$]/g, '')
      .replace(/\/.*/, '') // Remove " / adult" etc
      .replace(/,/g, '')   // Remove commas
      .trim();

    const parsed = parseFloat(cleaned);
    if (isNaN(parsed)) return 0;

    // Assume the input was in whole currency units, convert to cents
    return Math.round(parsed * 100);
  }
}

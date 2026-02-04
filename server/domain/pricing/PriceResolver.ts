// server/domain/pricing/PriceResolver.ts

import { IStorage } from '../../storage.js';
import { Tour } from '../../../shared/schema.js';

export interface TourRate {
  adultPriceCents: number;
  childPriceCents: number;
}

/**
 * PriceResolver: Single source of truth for pricing calculations.
 * 
 * All prices are handled in CENTS (e.g., 12000 = VUV 120.00).
 */
export class PriceResolver {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Fetch the current rates for a tour.
   */
  async getTourRate(tourId: string): Promise<TourRate | null> {
    const tour = await this.storage.getTour(tourId);
    if (!tour) return null;

    // Use cents if available, otherwise fallback to parsing deprecated text fields
    let adultPriceCents = tour.adultPriceCents;
    let childPriceCents = tour.childPriceCents;

    if (!adultPriceCents || adultPriceCents === 0) {
      adultPriceCents = PriceResolver.parseAmountTextToCents(tour.price);
    }

    if (!childPriceCents || childPriceCents === 0) {
      childPriceCents = PriceResolver.parseAmountTextToCents(tour.childPrice);
    }

    return {
      adultPriceCents: adultPriceCents || 0,
      childPriceCents: childPriceCents || 0,
    };
  }

  /**
   * Calculate the total for a booking item: (adult_pax * adult_rate) + (child_pax * child_rate)
   */
  calculateItemTotal(
    adultPax: number,
    childPax: number,
    rates: TourRate
  ): number {
    const adultSubtotal = adultPax * rates.adultPriceCents;
    const childSubtotal = childPax * rates.childPriceCents;
    return adultSubtotal + childSubtotal;
  }

  /**
   * Calculate the grand total across multiple items.
   */
  calculateCartTotal(items: Array<{ subtotalCents: number }>): number {
    return items.reduce((sum, item) => sum + item.subtotalCents, 0);
  }

  /**
   * Format cents as currency string for display only.
   */
  static formatCentsAsVUV(cents: number): string {
    const amount = (cents / 100).toFixed(0); // VUV usually doesn't have decimals in display
    return `VUV ${parseInt(amount).toLocaleString()}`;
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

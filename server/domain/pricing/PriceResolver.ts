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
   * Fetch the effective rates for a tour at a given point in time.
   * Phase 5: First checks pricing_versions for a versioned rate,
   * then falls back to the product's current price columns.
   * @param tourId Product ID
   * @param date Optional booking date (YYYY-MM-DD) for versioned pricing lookup
   */
  async getTourRate(tourId: string, date?: string): Promise<TourRate | null> {
    const tour = await this.storage.getTour(tourId);
    if (!tour) return null;

    // Phase 5: Try versioned pricing first
    if (date) {
      const version = await this.storage.getEffectivePricingVersion(tourId, date);
      if (version) {
        return {
          adultPriceCents: version.adultPriceCents,
          childPriceCents: version.childPriceCents,
        };
      }
    }

    // Fallback: Use product's current price (cents if available, otherwise parse text)
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
   * Applies group discounts and seasonal surcharges.
   */
  calculateItemTotal(
    adultPax: number,
    childPax: number,
    rates: TourRate,
    addonTotalCents: number = 0,
    date?: string
  ): number {
    let adultSubtotal = adultPax * rates.adultPriceCents;
    let childSubtotal = childPax * rates.childPriceCents;
    let total = adultSubtotal + childSubtotal + addonTotalCents;

    // RULE: Group Discount - 10% off for 7+ adults
    if (adultPax >= 7) {
      total = Math.round(total * 0.9);
    }

    // RULE: Seasonal Pricing - 20% surcharge in Peak Season (December & January)
    if (date) {
      const bookingDate = new Date(date);
      const month = bookingDate.getMonth(); // 0-indexed, 11 = Dec, 0 = Jan
      if (month === 11 || month === 0) {
        total = Math.round(total * 1.2);
      }
    }

    return total;
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

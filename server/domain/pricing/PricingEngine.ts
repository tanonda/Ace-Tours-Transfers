/**
 * PricingEngine: Unified, single source of truth for ALL pricing calculations
 * 
 * **CRITICAL:** This is the ONLY place where pricing logic lives. All pricing
 * calculations across the entire application (frontend, backend, availability,
 * checkout, invoicing) funnel through this service.
 * 
 * This solves the "4 different calculators" problem from Phase 1 audit.
 * 
 * All prices handled in CENTS (e.g., 12000 = VUV 120.00) for precision.
 */

import { IStorage } from '../../storage.js';
import { Tour } from '../../../shared/schema.js';

/**
 * Base rates for a product at a point in time
 */
export interface TourRate {
  adultPriceCents: number;
  childPriceCents: number;
}

/**
 * Detailed breakdown of a price calculation
 */
export interface PriceBreakdown {
  baseTotalCents: number;           // (adultPax * adultRate) + (childPax * childRate)
  adultSubtotalCents: number;       // adultPax * adultRate (before rules)
  childSubtotalCents: number;       // childPax * childRate (before rules)
  addonsSubtotalCents: number;      // Sum of all add-on prices
  discountsCents: number;           // Negative value (e.g., -5000 = 5000 VUV discount)
  surchargesCents: number;          // Positive value (e.g., 2400 = 2400 VUV surcharge)
  finalTotalCents: number;          // After all rules applied
  appliedRules: string[];           // Human-readable rule descriptions
}

/**
 * Result of a complete pricing calculation
 */
export interface PricingResult {
  breakdown: PriceBreakdown;
  /**
   * For display/audit purposes only - NOT for calculations
   * e.g., ["10% group discount (7+ adults)", "20% peak surcharge (Dec/Jan)"]
   */
  appliedDiscounts?: string[];
}

/**
 * Configuration for pricing calculation
 */
interface PricingRulesConfig {
  groupDiscountThreshold: number;    // 7+ adults
  groupDiscountPercent: number;      // 10%
  peakSeasonMonths: number[];        // [0, 11] = Jan, Dec
  peakSeasonSurchargePercent: number; // 20%
  vatRate: number;                   // 15%
}

/**
 * PricingEngine: Single source of truth for pricing
 * 
 * Consolidates logic from:
 * - PriceResolver.calculateItemTotal()
 * - calculateLineTotal() (frontend)
 * - AvailabilityDomainService.calculatePricing()
 * - PricingService snapshot creation
 * - Inline calculations in various services
 */
export class PricingEngine {
  private storage: IStorage;
  private config: PricingRulesConfig;

  constructor(storage: IStorage, config?: Partial<PricingRulesConfig>) {
    this.storage = storage;
    this.config = {
      groupDiscountThreshold: 7,
      groupDiscountPercent: 10,
      peakSeasonMonths: [0, 11],      // Jan (0), Dec (11)
      peakSeasonSurchargePercent: 20,
      vatRate: 0.15,
      ...config,
    };
  }

  /**
   * Fetch the effective rates for a product at a point in time
   * 
   * First checks pricing_versions for a versioned rate,
   * then falls back to the product's current price columns.
   */
  async getTourRate(tourId: string, date?: string): Promise<TourRate | null> {
    const tour = await this.storage.getTour(tourId);
    if (!tour) return null;

    // Try versioned pricing first (Phase 5)
    if (date) {
      const version = await this.storage.getEffectivePricingVersion(tourId, date);
      if (version) {
        return {
          adultPriceCents: version.adultPriceCents,
          childPriceCents: version.childPriceCents,
        };
      }
    }

    // Fallback: Use product's current price
    let adultPriceCents = tour.adultPriceCents;
    let childPriceCents = tour.childPriceCents;

    if (!adultPriceCents || adultPriceCents === 0) {
      adultPriceCents = this.parseAmountTextToCents(tour.price);
    }

    if (!childPriceCents || childPriceCents === 0) {
      childPriceCents = this.parseAmountTextToCents(tour.childPrice);
    }

    return {
      adultPriceCents: adultPriceCents || 0,
      childPriceCents: childPriceCents || 0,
    };
  }

  /**
   * Calculate final price for a booking line item
   * 
   * Comprehensive calculation that handles:
   * - Base pricing (adult + child)
   * - Add-ons
   * - Group discounts
   * - Seasonal surcharges
   * 
   * @param adultPax Number of adults
   * @param childPax Number of children
   * @param rates Base rates
   * @param date Optional booking date (for seasonal rules)
   * @param addonIds Optional add-on IDs
   * @returns PricingResult with breakdown
   */
  async calculateLineItem(
    adultPax: number,
    childPax: number,
    rates: TourRate,
    date?: string,
    addonIds?: string[]
  ): Promise<PricingResult> {
    // 1. Calculate base subtotals
    const adultSubtotalCents = adultPax * rates.adultPriceCents;
    const childSubtotalCents = childPax * rates.childPriceCents;
    const baseTotalCents = adultSubtotalCents + childSubtotalCents;

    // 2. Calculate add-ons
    let addonsSubtotalCents = 0;
    if (addonIds && addonIds.length > 0) {
      const addons = await Promise.all(
        addonIds.map((id) => this.storage.getAddon(id))
      );
      addonsSubtotalCents = addons.reduce(
        (sum, addon) => sum + (addon?.priceCents || 0),
        0
      );
    }

    // 3. Start with base + addons, then apply rules
    let totalCents = baseTotalCents + addonsSubtotalCents;
    let discountsCents = 0;
    let surchargesCents = 0;
    const appliedRules: string[] = [];

    // 4. Apply group discount (10% off for 7+ adults)
    if (adultPax >= this.config.groupDiscountThreshold) {
      const discountAmount = Math.round(totalCents * (this.config.groupDiscountPercent / 100));
      totalCents -= discountAmount;
      discountsCents -= discountAmount;
      appliedRules.push(`${this.config.groupDiscountPercent}% group discount (${this.config.groupDiscountThreshold}+ adults)`);
    }

    // 5. Apply seasonal surcharge (20% in Dec/Jan)
    if (date) {
      const bookingDate = new Date(date);
      const month = bookingDate.getMonth();
      if (this.config.peakSeasonMonths.includes(month)) {
        const surchargeAmount = Math.round(
          (baseTotalCents + addonsSubtotalCents + discountsCents) * (this.config.peakSeasonSurchargePercent / 100)
        );
        totalCents += surchargeAmount;
        surchargesCents += surchargeAmount;
        appliedRules.push(`${this.config.peakSeasonSurchargePercent}% peak season surcharge (Dec/Jan)`);
      }
    }

    const breakdown: PriceBreakdown = {
      baseTotalCents,
      adultSubtotalCents,
      childSubtotalCents,
      addonsSubtotalCents,
      discountsCents,
      surchargesCents,
      finalTotalCents: totalCents,
      appliedRules,
    };

    return {
      breakdown,
      appliedDiscounts: appliedRules.length > 0 ? appliedRules : undefined,
    };
  }

  /**
   * Simple calculation for a booking item without add-ons
   * Used by legacy code paths and quick calculations
   */
  calculateSimple(
    adultPax: number,
    childPax: number,
    rates: TourRate,
    date?: string
  ): number {
    const adultSubtotal = adultPax * rates.adultPriceCents;
    const childSubtotal = childPax * rates.childPriceCents;
    let total = adultSubtotal + childSubtotal;

    // Apply group discount
    if (adultPax >= this.config.groupDiscountThreshold) {
      total = Math.round(total * (1 - this.config.groupDiscountPercent / 100));
    }

    // Apply seasonal surcharge
    if (date) {
      const bookingDate = new Date(date);
      const month = bookingDate.getMonth();
      if (this.config.peakSeasonMonths.includes(month)) {
        total = Math.round(total * (1 + this.config.peakSeasonSurchargePercent / 100));
      }
    }

    return total;
  }

  /**
   * Calculate VAT for an amount
   */
  calculateVAT(amountCents: number): number {
    return Math.round(amountCents * this.config.vatRate);
  }

  /**
   * Calculate total including VAT
   */
  calculateWithVAT(amountCents: number): number {
    return amountCents + this.calculateVAT(amountCents);
  }

  /**
   * Calculate cart total from multiple items
   */
  calculateCartTotal(items: Array<{ finalTotalCents: number }>): number {
    return items.reduce((sum, item) => sum + item.finalTotalCents, 0);
  }

  /**
   * Format cents as currency string for display
   */
  static formatCentsAsVUV(cents: number): string {
    const amount = (cents / 100).toFixed(0);
    return `VUV ${parseInt(amount).toLocaleString()}`;
  }

  /**
   * Helper to parse legacy text prices
   * Convert "VUV 15,000" or "$120" -> cents
   */
  private parseAmountTextToCents(text: string | null | undefined): number {
    if (!text) return 0;

    let cleaned = text
      .replace(/[VUV$]/g, '')
      .replace(/\/.*/, '')  // Remove " / adult" etc
      .replace(/,/g, '')    // Remove commas
      .trim();

    const parsed = parseFloat(cleaned);
    if (isNaN(parsed)) return 0;

    // Assume input was in whole currency units, convert to cents
    return Math.round(parsed * 100);
  }
}

/**
 * Export singleton instance factory
 */
export function createPricingEngine(storage: IStorage, config?: Partial<PricingRulesConfig>): PricingEngine {
  return new PricingEngine(storage, config);
}

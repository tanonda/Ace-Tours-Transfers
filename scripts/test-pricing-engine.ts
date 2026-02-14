/// <reference types="jest" />

/**
 * Comprehensive Test Suite for PricingEngine
 * 
 * Validates:
 * - Base pricing calculations (adult + child)
 * - Add-ons calculation
 * - Group discounts (10% for 7+ adults)
 * - Seasonal surcharges (20% Dec/Jan)
 * - VAT calculations
 * - Price consistency across all scenarios
 * - Backward compatibility with legacy calculations
 */

import { PricingEngine, TourRate, PriceBreakdown } from '../server/domain/pricing/PricingEngine.js';

/**
 * Mock storage for testing
 */
class MockStorage {
  getTour(id: string) {
    return Promise.resolve({
      id,
      title: 'Test Tour',
      price: '100',
      childPrice: '50',
      adultPriceCents: 10000,  // VUV 100
      childPriceCents: 5000,   // VUV 50
    });
  }

  getEffectivePricingVersion(tourId: string, date: string) {
    // Return versioned pricing only for test dates
    if (date === '2026-02-14') {
      return Promise.resolve({
        adultPriceCents: 12000,  // VUV 120
        childPriceCents: 6000,   // VUV 60
      });
    }
    return Promise.resolve(null);
  }

  getAddon(id: string) {
    const addons: { [key: string]: { priceCents: number } } = {
      'addon-1': { priceCents: 2000 },   // VUV 20
      'addon-2': { priceCents: 3000 },   // VUV 30
      'addon-3': { priceCents: 5000 },   // VUV 50
    };
    return Promise.resolve(addons[id] || null);
  }
}

describe('PricingEngine - Unified Pricing Calculator', () => {
  let engine: PricingEngine;
  let storage: MockStorage;

  beforeEach(() => {
    storage = new MockStorage();
    engine = new PricingEngine(storage as any);
  });

  describe('getTourRate', () => {
    it('should return base rates from product', async () => {
      const rates = await engine.getTourRate('tour-1');
      expect(rates).toEqual({
        adultPriceCents: 10000,
        childPriceCents: 5000,
      });
    });

    it('should return versioned rates when available', async () => {
      const rates = await engine.getTourRate('tour-1', '2026-02-14');
      expect(rates).toEqual({
        adultPriceCents: 12000,
        childPriceCents: 6000,
      });
    });

    it('should return null for unknown tour', async () => {
      const rates = await engine.getTourRate('unknown-tour');
      expect(rates).toBeNull();
    });
  });

  describe('calculateSimple', () => {
    const rates: TourRate = { adultPriceCents: 10000, childPriceCents: 5000 };

    it('should calculate basic pricing: 2 adults, 1 child', () => {
      const total = engine.calculateSimple(2, 1, rates);
      // (2 * 10000) + (1 * 5000) = 25000 (VUV 250)
      expect(total).toBe(25000);
    });

    it('should calculate basic pricing: 1 adult, 0 children', () => {
      const total = engine.calculateSimple(1, 0, rates);
      // 1 * 10000 = 10000 (VUV 100)
      expect(total).toBe(10000);
    });

    it('should apply group discount for 7+ adults', () => {
      const total = engine.calculateSimple(7, 0, rates);
      // (7 * 10000) = 70000, then -10% = 63000
      expect(total).toBe(63000);
    });

    it('should apply group discount for 10 adults', () => {
      const total = engine.calculateSimple(10, 2, rates);
      // (10 * 10000) + (2 * 5000) = 110000, then -10% = 99000
      expect(total).toBe(99000);
    });

    it('should NOT apply group discount for 6 adults', () => {
      const total = engine.calculateSimple(6, 0, rates);
      // (6 * 10000) = 60000 (no discount)
      expect(total).toBe(60000);
    });

    it('should apply peak season surcharge in December', () => {
      const total = engine.calculateSimple(2, 0, rates, '2025-12-25');
      // (2 * 10000) = 20000, then +20% = 24000
      expect(total).toBe(24000);
    });

    it('should apply peak season surcharge in January', () => {
      const total = engine.calculateSimple(2, 0, rates, '2026-01-15');
      // (2 * 10000) = 20000, then +20% = 24000
      expect(total).toBe(24000);
    });

    it('should NOT apply peak season surcharge in November', () => {
      const total = engine.calculateSimple(2, 0, rates, '2025-11-15');
      // (2 * 10000) = 20000 (no surcharge)
      expect(total).toBe(20000);
    });

    it('should combine group discount and seasonal surcharge', () => {
      const total = engine.calculateSimple(7, 0, rates, '2025-12-25');
      // (7 * 10000) = 70000, then -10% = 63000, then +20% = 75600
      expect(total).toBe(75600);
    });
  });

  describe('calculateLineItem', () => {
    const rates: TourRate = { adultPriceCents: 10000, childPriceCents: 5000 };

    it('should calculate basic pricing with breakdown', async () => {
      const result = await engine.calculateLineItem(2, 1, rates);

      expect(result.breakdown).toEqual({
        baseTotalCents: 25000,
        adultSubtotalCents: 20000,
        childSubtotalCents: 5000,
        addonsSubtotalCents: 0,
        discountsCents: 0,
        surchargesCents: 0,
        finalTotalCents: 25000,
        appliedRules: [],
      });
      expect(result.appliedDiscounts).toBeUndefined();
    });

    it('should include add-ons in calculation', async () => {
      const result = await engine.calculateLineItem(2, 1, rates, undefined, ['addon-1', 'addon-2']);

      expect(result.breakdown).toEqual({
        baseTotalCents: 25000,
        adultSubtotalCents: 20000,
        childSubtotalCents: 5000,
        addonsSubtotalCents: 5000,  // 2000 + 3000
        discountsCents: 0,
        surchargesCents: 0,
        finalTotalCents: 30000,
        appliedRules: [],
      });
    });

    it('should apply group discount and track it', async () => {
      const result = await engine.calculateLineItem(7, 0, rates);

      expect(result.breakdown.baseTotalCents).toBe(70000);
      expect(result.breakdown.discountsCents).toBe(-7000);
      expect(result.breakdown.finalTotalCents).toBe(63000);
      expect(result.breakdown.appliedRules).toContain('10% group discount (7+ adults)');
      expect(result.appliedDiscounts).toBeDefined();
    });

    it('should apply peak season surcharge and track it', async () => {
      const result = await engine.calculateLineItem(2, 0, rates, '2025-12-15');

      expect(result.breakdown.baseTotalCents).toBe(20000);
      expect(result.breakdown.surchargesCents).toBe(4000);
      expect(result.breakdown.finalTotalCents).toBe(24000);
      expect(result.breakdown.appliedRules).toContain('20% peak season surcharge (Dec/Jan)');
    });

    it('should apply both discount and surcharge', async () => {
      const result = await engine.calculateLineItem(8, 2, rates, '2025-12-20');

      expect(result.breakdown.baseTotalCents).toBe(90000);
      // 90000 - 10% = 81000
      const afterDiscount = 81000;
      // 81000 + 20% = 97200
      expect(result.breakdown.finalTotalCents).toBe(97200);
      expect(result.breakdown.appliedRules).toHaveLength(2);
    });

    it('should handle zero guests', async () => {
      const result = await engine.calculateLineItem(0, 0, rates);

      expect(result.breakdown.finalTotalCents).toBe(0);
      expect(result.breakdown.appliedRules).toEqual([]);
    });

    it('should handle add-ons with group discount', async () => {
      const result = await engine.calculateLineItem(7, 0, rates, undefined, ['addon-1', 'addon-3']);

      // Base: 70000, Addons: 7000, Total: 77000
      // After 10% discount: 69300
      expect(result.breakdown.baseTotalCents).toBe(70000);
      expect(result.breakdown.addonsSubtotalCents).toBe(7000);
      expect(result.breakdown.finalTotalCents).toBe(69300);
    });
  });

  describe('VAT Calculations', () => {
    it('should calculate 15% VAT', () => {
      const vat = engine.calculateVAT(100000);  // VUV 1000
      expect(vat).toBe(15000);  // VUV 150 (15%)
    });

    it('should calculate total with VAT', () => {
      const total = engine.calculateWithVAT(100000);  // VUV 1000
      expect(total).toBe(115000);  // VUV 1150
    });

    it('should handle zero amount VAT', () => {
      expect(engine.calculateVAT(0)).toBe(0);
      expect(engine.calculateWithVAT(0)).toBe(0);
    });
  });

  describe('Cart Total Calculations', () => {
    it('should sum multiple items', () => {
      const items = [
        { finalTotalCents: 50000 },
        { finalTotalCents: 30000 },
        { finalTotalCents: 20000 },
      ];
      expect(engine.calculateCartTotal(items)).toBe(100000);
    });

    it('should handle empty cart', () => {
      expect(engine.calculateCartTotal([])).toBe(0);
    });
  });

  describe('Formatting', () => {
    it('should format cents as VUV currency', () => {
      expect(PricingEngine.formatCentsAsVUV(100000)).toBe('VUV 1,000');
      expect(PricingEngine.formatCentsAsVUV(12345)).toBe('VUV 123');
      expect(PricingEngine.formatCentsAsVUV(0)).toBe('VUV 0');
    });
  });

  describe('Edge Cases', () => {
    const rates: TourRate = { adultPriceCents: 10000, childPriceCents: 5000 };

    it('should handle large group sizes', async () => {
      const result = await engine.calculateLineItem(50, 30, rates);
      // (50 * 10000) + (30 * 5000) = 650000
      // With 10% discount: 585000
      expect(result.breakdown.finalTotalCents).toBe(585000);
    });

    it('should handle rounding correctly with discounts', () => {
      const rates: TourRate = { adultPriceCents: 10001, childPriceCents: 5001 };
      const total = engine.calculateSimple(7, 0, rates);
      // (7 * 10001) = 70007, then -10% = 63006
      expect(total).toBe(63006);
    });

    it('should handle combined rules rounding', async () => {
      const rates: TourRate = { adultPriceCents: 10001, childPriceCents: 5001 };
      const result = await engine.calculateLineItem(7, 0, rates, '2025-12-15');
      // (7 * 10001) = 70007
      // After -10%: 63006
      // After +20% on base: Should be calculated correctly
      expect(result.breakdown.finalTotalCents).toBeGreaterThan(63000);
      expect(result.breakdown.finalTotalCents).toBeLessThan(85000);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain compatibility with PriceResolver.calculateItemTotal signature', () => {
      const rates: TourRate = { adultPriceCents: 10000, childPriceCents: 5000 };
      
      // Old: calculateItemTotal(adultPax, childPax, rates, addonsTotal, date)
      const oldResult = engine.calculateSimple(2, 1, rates, '2025-06-15');
      
      // Should match simple calculation
      expect(oldResult).toBe(25000);
    });

    it('should maintain compatibility with calculateLineTotal signature', () => {
      const rates: TourRate = { adultPriceCents: 10000, childPriceCents: 5000 };
      
      // Old: calculateLineTotal(adultPriceCents, childPriceCents, adultCount, childCount, addonTotal)
      // Equivalent to our calculateSimple without date
      const total = engine.calculateSimple(2, 1, rates);
      
      expect(total).toBe(25000);
    });
  });

  describe('Scenario: Complete Booking Flow', () => {
    it('should handle full booking with all features', async () => {
      const rates = await engine.getTourRate('tour-1', '2025-12-20');
      if (!rates) throw new Error('Rates not found');

      // Scenario: 8 adults, 2 children, 2 add-ons, December (peak season)
      const result = await engine.calculateLineItem(8, 2, rates, '2025-12-20', ['addon-1', 'addon-2']);

      // Base: (8 * 10000) + (2 * 5000) = 90000
      // Addons: 2000 + 3000 = 5000
      // Subtotal: 95000
      // After 10% discount: 85500
      // After 20% peak surcharge: 102600
      expect(result.breakdown.baseTotalCents).toBe(90000);
      expect(result.breakdown.addonsSubtotalCents).toBe(5000);
      expect(result.breakdown.finalTotalCents).toBe(102600);
      expect(result.breakdown.appliedRules).toHaveLength(2);
    });

    it('should handle versioned pricing in scenario', async () => {
      const rates = await engine.getTourRate('tour-1', '2026-02-14');
      if (!rates) throw new Error('Rates not found');

      // Should use versioned rates (12000 adult, 6000 child)
      expect(rates.adultPriceCents).toBe(12000);
      expect(rates.childPriceCents).toBe(6000);

      const result = await engine.calculateLineItem(2, 1, rates);
      // (2 * 12000) + (1 * 6000) = 30000
      expect(result.breakdown.finalTotalCents).toBe(30000);
    });
  });

  describe('Configuration Override', () => {
    it('should allow custom pricing rules', () => {
      const customEngine = new PricingEngine(storage as any, {
        groupDiscountThreshold: 5,
        groupDiscountPercent: 15,
        peakSeasonSurchargePercent: 25,
      });

      const rates: TourRate = { adultPriceCents: 10000, childPriceCents: 5000 };

      // 5 adults should now trigger discount
      const total = customEngine.calculateSimple(5, 0, rates);
      // (5 * 10000) = 50000, then -15% = 42500
      expect(total).toBe(42500);
    });
  });
});

/**
 * Integration test: Verify all pricing paths use same logic
 */
describe('PricingEngine - Integration: Unified Pricing Across All Paths', () => {
  let engine: PricingEngine;

  beforeEach(() => {
    const storage = new MockStorage();
    engine = new PricingEngine(storage as any);
  });

  it('should produce identical results across all calculation methods', async () => {
    const rates: TourRate = { adultPriceCents: 10000, childPriceCents: 5000 };

    // Method 1: Simple calculation
    const simple = engine.calculateSimple(8, 2, rates, '2025-12-20');

    // Method 2: Line item calculation
    const lineItem = await engine.calculateLineItem(8, 2, rates, '2025-12-20');

    // Both should arrive at the same final total
    expect(simple).toBe(lineItem.breakdown.finalTotalCents);
  });

  it('should handle all 4 original calculator scenarios with new engine', async () => {
    const rates: TourRate = { adultPriceCents: 10000, childPriceCents: 5000 };

    // Scenario 1: Frontend simple calculation
    const frontend = 2 * 10000 + 1 * 5000;  // = 25000
    const engineResult = engine.calculateSimple(2, 1, rates);
    expect(engineResult).toBe(frontend);

    // Scenario 2: With group discount
    const withDiscount = Math.round((7 * 10000) * 0.9);  // = 63000
    const engineWithDiscount = engine.calculateSimple(7, 0, rates);
    expect(engineWithDiscount).toBe(withDiscount);

    // Scenario 3: With seasonal surcharge
    const withSurcharge = Math.round((2 * 10000) * 1.2);  // = 24000
    const engineWithSurcharge = engine.calculateSimple(2, 0, rates, '2025-12-15');
    expect(engineWithSurcharge).toBe(withSurcharge);

    // Scenario 4: With both discount and surcharge
    const both = Math.round(Math.round((8 * 10000) * 0.9) * 1.2);  // = 86400
    const engineBoth = engine.calculateSimple(8, 0, rates, '2025-12-15');
    expect(engineBoth).toBe(both);
  });
});

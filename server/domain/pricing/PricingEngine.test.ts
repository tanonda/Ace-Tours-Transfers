import { describe, it, expect, beforeEach } from 'vitest';
import { PricingEngine, formatVUVInCurrency, invalidatePricingRulesCache, TourRate } from './PricingEngine.js';

// Create an engine with a mock storage (pure calculation tests don't use storage)
const mockStorage = {} as any;

describe('PricingEngine', () => {
    describe('calculateSimple', () => {
        const engine = new PricingEngine(mockStorage);

        it('calculates basic adult + child price', () => {
            const rates: TourRate = { pricingType: 'per_person', groupPriceCents: 0, adultPriceCents: 10000, childPriceCents: 5000 };
            const result = engine.calculateSimple(2, 1, rates);
            // 2 * 10000 + 1 * 5000 = 25000
            expect(result).toBe(25000);
        });

        it('returns 0 when no pax', () => {
            const rates: TourRate = { pricingType: 'per_person', groupPriceCents: 0, adultPriceCents: 10000, childPriceCents: 5000 };
            expect(engine.calculateSimple(0, 0, rates)).toBe(0);
        });

        it('handles child-only booking', () => {
            const rates: TourRate = { pricingType: 'per_person', groupPriceCents: 0, adultPriceCents: 10000, childPriceCents: 5000 };
            expect(engine.calculateSimple(0, 3, rates)).toBe(15000);
        });
    });

    describe('calculateSimple with group discount', () => {
        // Default groupDiscountThreshold is 7, groupDiscountPercent is 10
        const engine = new PricingEngine(mockStorage);
        const rates: TourRate = { pricingType: 'per_person', groupPriceCents: 0, adultPriceCents: 1000, childPriceCents: 500 };

        it('does not apply discount below threshold', () => {
            const result = engine.calculateSimple(6, 0, rates);
            expect(result).toBe(6000); // 6 * 1000, below 7 threshold
        });

        it('applies group discount at threshold', () => {
            const result = engine.calculateSimple(7, 0, rates);
            // 7 * 1000 = 7000 → 10% off = 6300
            expect(result).toBe(6300);
        });

        it('applies group discount above threshold', () => {
            const result = engine.calculateSimple(10, 0, rates);
            // 10 * 1000 = 10000 → 10% off = 9000
            expect(result).toBe(9000);
        });

        it('applies discount only based on adultPax count', () => {
            const result = engine.calculateSimple(7, 3, rates);
            // (7 * 1000 + 3 * 500) = 8500 → 10% off = 7650
            expect(result).toBe(7650);
        });
    });

    describe('group (flat) pricing', () => {
        // A flat package price is the advertised price: the 7+ adult discount is for per-person tours only.
        const engine = new PricingEngine(mockStorage);
        const busHire: TourRate = { pricingType: 'group', groupPriceCents: 32000, adultPriceCents: 32000, childPriceCents: 0 };

        it('charges the flat price with no discount (calculateSimple)', () => {
            expect(engine.calculateSimple(1, 0, busHire)).toBe(32000);
            expect(engine.calculateSimple(12, 2, busHire)).toBe(32000);
        });

        it('charges the flat price with no discount (calculateLineItem)', async () => {
            const result = await engine.calculateLineItem(12, 2, busHire);
            expect(result.breakdown.finalTotalCents).toBe(32000);
            expect(result.breakdown.discountsCents).toBe(0);
        });
    });

    describe('rules from Admin → Pricing', () => {
        const tour: TourRate = { pricingType: 'per_person', groupPriceCents: 0, adultPriceCents: 1000, childPriceCents: 500 };
        const storageWith = (value: unknown) => ({
            getSiteSetting: async (key: string) => (key === 'pricing_rules' ? { key, value } : undefined),
        }) as any;

        beforeEach(() => invalidatePricingRulesCache());

        it('uses the saved discount size and threshold', async () => {
            const engine = new PricingEngine(storageWith({ groupDiscount: { enabled: true, minAdults: 4, percent: 15 } }));
            const { breakdown } = await engine.calculateLineItem(4, 0, tour);
            expect(breakdown.finalTotalCents).toBe(3400); // 4000 - 15%
            expect(breakdown.appliedRules).toEqual(['15% group discount (4+ adults)']);
        });

        it('applies no discount when the admin switches it off', async () => {
            const engine = new PricingEngine(storageWith({ groupDiscount: { enabled: false } }));
            const { breakdown } = await engine.calculateLineItem(10, 0, tour);
            expect(breakdown.finalTotalCents).toBe(10000);
        });

        it('uses the saved peak-season months and rate', async () => {
            const engine = new PricingEngine(storageWith({ peakSeason: { enabled: true, months: [6], percent: 5 } }));
            expect((await engine.calculateLineItem(1, 0, tour, '2026-07-15')).breakdown.finalTotalCents).toBe(1050);
            expect((await engine.calculateLineItem(1, 0, tour, '2026-12-15')).breakdown.finalTotalCents).toBe(1000);
        });

        it('falls back to the default rules when the settings read fails', async () => {
            const engine = new PricingEngine({ getSiteSetting: async () => { throw new Error('db down'); } } as any);
            expect((await engine.calculateLineItem(7, 0, tour)).breakdown.finalTotalCents).toBe(6300);
        });

        it('picks up a new save after the cache is invalidated', async () => {
            let saved: unknown = { groupDiscount: { enabled: true, minAdults: 7, percent: 10 } };
            const engine = new PricingEngine({ getSiteSetting: async () => ({ value: saved }) } as any);
            expect((await engine.calculateLineItem(7, 0, tour)).breakdown.finalTotalCents).toBe(6300);
            saved = { groupDiscount: { enabled: false } };
            invalidatePricingRulesCache();
            expect((await engine.calculateLineItem(7, 0, tour)).breakdown.finalTotalCents).toBe(7000);
        });
    });

    describe('formatVUVInCurrency', () => {
        it('formats simple amount', () => {
            expect(formatVUVInCurrency(15000, 'VUV')).toBe('VT 15,000');
        });

        it('formats zero', () => {
            expect(formatVUVInCurrency(0, 'VUV')).toBe('VT 0');
        });

        it('formats small value', () => {
            expect(formatVUVInCurrency(500, 'VUV')).toBe('VT 500');
        });
    });
});


import { describe, it, expect } from 'vitest';
import { PricingEngine } from './PricingEngine.js';

// Create an engine with a mock storage (pure calculation tests don't use storage)
const mockStorage = {} as any;

describe('PricingEngine', () => {
    describe('calculateSimple', () => {
        const engine = new PricingEngine(mockStorage);

        it('calculates basic adult + child price', () => {
            const rates = { adultPriceCents: 10000, childPriceCents: 5000 };
            const result = engine.calculateSimple(2, 1, rates);
            // 2 * 10000 + 1 * 5000 = 25000
            expect(result).toBe(25000);
        });

        it('returns 0 when no pax', () => {
            const rates = { adultPriceCents: 10000, childPriceCents: 5000 };
            expect(engine.calculateSimple(0, 0, rates)).toBe(0);
        });

        it('handles child-only booking', () => {
            const rates = { adultPriceCents: 10000, childPriceCents: 5000 };
            expect(engine.calculateSimple(0, 3, rates)).toBe(15000);
        });
    });

    describe('calculateSimple with group discount', () => {
        // Default groupDiscountThreshold is 7, groupDiscountPercent is 10
        const engine = new PricingEngine(mockStorage);
        const rates = { adultPriceCents: 1000, childPriceCents: 500 };

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

    describe('calculateVAT', () => {
        const engine = new PricingEngine(mockStorage);

        it('calculates 15% VAT correctly', () => {
            expect(engine.calculateVAT(10000)).toBe(1500);
        });

        it('rounds to nearest integer', () => {
            expect(engine.calculateVAT(100)).toBe(15);
        });

        it('handles 0', () => {
            expect(engine.calculateVAT(0)).toBe(0);
        });
    });

    describe('formatCentsAsVUV', () => {
        it('formats simple amount', () => {
            expect(PricingEngine.formatCentsAsVUV(15000)).toBe('VUV 15,000');
        });

        it('formats zero', () => {
            expect(PricingEngine.formatCentsAsVUV(0)).toBe('VUV 0');
        });

        it('formats small value', () => {
            expect(PricingEngine.formatCentsAsVUV(500)).toBe('VUV 500');
        });
    });
});

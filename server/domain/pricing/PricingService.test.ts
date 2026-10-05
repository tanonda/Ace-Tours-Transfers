import { describe, it, expect } from 'vitest';
import { PricingService } from './PricingService.js';
import { DEFAULT_PRICING_RULES, parsePricingRules } from '../../../shared/pricing-rules.js';

const airportTransfer = [{ productId: 'p1', name: 'Premium Airport Transfer', unitPriceCents: 1200, adultPax: 1, childPax: 0, quantity: 1 }];

describe('PricingService.createSnapshot', () => {
  it('charges the advertised price when prices include VAT (the default)', () => {
    // Regression: the snapshot used to add 15% on top, so a VT 1,200 transfer charged VT 1,380.
    const snapshot = PricingService.createSnapshot(airportTransfer, 'VUV', DEFAULT_PRICING_RULES);
    expect(snapshot.totalCents).toBe(1200);
    expect(snapshot.vatAmountCents).toBe(157);
    expect(snapshot.baseAmountCents).toBe(1043);
  });

  it('adds VAT on top only when the admin says prices exclude it', () => {
    const snapshot = PricingService.createSnapshot(airportTransfer, 'VUV', parsePricingRules({ vat: { percent: 15, included: false } }));
    expect(snapshot.totalCents).toBe(1380);
    expect(snapshot.vatAmountCents).toBe(180);
  });
});

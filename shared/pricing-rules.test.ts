import { describe, it, expect } from 'vitest';
import { DEFAULT_PRICING_RULES, PRICING_RULES_SETTING_KEY, estimateWithRules, parsePricingRules, pricingRulesFromSettings, vatBreakdown, vatLabel } from './pricing-rules.js';

describe('parsePricingRules', () => {
  it('falls back to defaults when nothing is saved', () => {
    expect(parsePricingRules(undefined)).toEqual(DEFAULT_PRICING_RULES);
    expect(parsePricingRules(null)).toEqual(DEFAULT_PRICING_RULES);
    expect(parsePricingRules('garbage')).toEqual(DEFAULT_PRICING_RULES);
  });

  it('keeps a valid admin configuration', () => {
    const saved = {
      groupDiscount: { enabled: false, minAdults: 10, percent: 15 },
      peakSeason: { enabled: true, months: [6, 7], percent: 5 },
      vat: { percent: 12.5, included: false },
    };
    expect(parsePricingRules(saved)).toEqual(saved);
  });

  it('fills missing fields from defaults', () => {
    const rules = parsePricingRules({ groupDiscount: { percent: 12 } });
    expect(rules.groupDiscount).toEqual({ ...DEFAULT_PRICING_RULES.groupDiscount, percent: 12 });
    expect(rules.peakSeason).toEqual(DEFAULT_PRICING_RULES.peakSeason);
  });

  it('clamps out-of-range numbers instead of trusting them', () => {
    const rules = parsePricingRules({
      groupDiscount: { enabled: true, minAdults: 0, percent: 250 },
      peakSeason: { enabled: true, months: [0, 11, 12, -1, 3.5, 11], percent: -10 },
    });
    expect(rules.groupDiscount.minAdults).toBe(1);
    expect(rules.groupDiscount.percent).toBe(100);
    expect(rules.peakSeason.months).toEqual([0, 11]);
    expect(rules.peakSeason.percent).toBe(0);
  });

  it('accepts numbers sent as strings by form inputs', () => {
    const rules = parsePricingRules({ groupDiscount: { minAdults: '8', percent: '7.5' } });
    expect(rules.groupDiscount.minAdults).toBe(8);
    expect(rules.groupDiscount.percent).toBe(7.5);
  });
});

describe('pricingRulesFromSettings', () => {
  it('reads the pricing_rules row from the settings list', () => {
    const rows = [
      { key: 'contact_phone', value: '7114045' },
      { key: PRICING_RULES_SETTING_KEY, value: { groupDiscount: { enabled: false } } },
    ];
    expect(pricingRulesFromSettings(rows).groupDiscount.enabled).toBe(false);
  });

  it('uses defaults when the row is absent', () => {
    expect(pricingRulesFromSettings([])).toEqual(DEFAULT_PRICING_RULES);
    expect(pricingRulesFromSettings(undefined)).toEqual(DEFAULT_PRICING_RULES);
  });
});

describe('estimateWithRules', () => {
  const rules = DEFAULT_PRICING_RULES;

  it('discounts per-person bookings at the threshold', () => {
    expect(estimateWithRules(rules, 7000, { adultPax: 7 })).toEqual({ total: 6300, appliedRules: ['10% group discount (7+ adults)'] });
    expect(estimateWithRules(rules, 6000, { adultPax: 6 }).total).toBe(6000);
  });

  it('never discounts flat group packages', () => {
    expect(estimateWithRules(rules, 32000, { pricingType: 'group', adultPax: 12 }).total).toBe(32000);
  });

  it('adds the peak surcharge after the discount', () => {
    const { total, appliedRules } = estimateWithRules(rules, 7000, { adultPax: 7, date: '2026-12-20' });
    expect(total).toBe(7560); // 7000 → 6300 → +20%
    expect(appliedRules[1]).toBe('20% peak season surcharge (Jan/Dec)');
  });

  it('respects rules the admin switched off', () => {
    const off = parsePricingRules({ groupDiscount: { enabled: false }, peakSeason: { enabled: false } });
    expect(estimateWithRules(off, 7000, { adultPax: 7, date: '2026-12-20' }).total).toBe(7000);
  });
});

describe('VAT rules', () => {
  it('defaults to 15% included in the advertised price', () => {
    expect(DEFAULT_PRICING_RULES.vat).toEqual({ percent: 15, included: true });
  });

  it('splits the VAT out of a VAT-inclusive price instead of adding it', () => {
    // VT 1,200 airport transfer: the customer pays 1,200, of which 157 is VAT.
    expect(vatBreakdown(DEFAULT_PRICING_RULES, 1200)).toEqual({ netCents: 1043, vatCents: 157, totalCents: 1200 });
  });

  it('adds VAT on top when the admin says prices exclude it', () => {
    const rules = parsePricingRules({ vat: { percent: 15, included: false } });
    expect(vatBreakdown(rules, 1200)).toEqual({ netCents: 1200, vatCents: 180, totalCents: 1380 });
  });

  it('labels the price the way it is charged', () => {
    expect(vatLabel(DEFAULT_PRICING_RULES)).toBe('Incl. 15% VAT');
    expect(vatLabel(parsePricingRules({ vat: { percent: 12.5, included: false } }))).toBe('+ 12.5% VAT');
    expect(vatLabel(parsePricingRules({ vat: { percent: 0 } }))).toBe('');
  });

  it('keeps the VAT rate in range', () => {
    expect(parsePricingRules({ vat: { percent: 80 } }).vat.percent).toBe(50);
    expect(parsePricingRules({ vat: { percent: -1, included: 'yes' } }).vat).toEqual({ percent: 0, included: true });
  });
});

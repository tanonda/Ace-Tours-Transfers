import { describe, it, expect } from 'vitest';
import { getDisplayPrice } from './product.types';

describe('getDisplayPrice', () => {
  it('shows the per-person adult rate for per_person products', () => {
    expect(getDisplayPrice({ pricingType: 'per_person', adultPriceCents: 9500, groupPriceCents: 0 }))
      .toEqual({ amount: 9500, isPackage: false });
  });

  it('defaults to per-person when pricingType is missing (legacy rows)', () => {
    expect(getDisplayPrice({ adultPriceCents: 4500 })).toEqual({ amount: 4500, isPackage: false });
  });

  it('shows the flat package rate for group products, not the adult rate', () => {
    // Hospitality Package: adult rate 0, package VT 25,000 → card must not say "VT 0"
    expect(getDisplayPrice({ pricingType: 'group', adultPriceCents: 0, groupPriceCents: 25000 }))
      .toEqual({ amount: 25000, isPackage: true });
    // Events Transfer Package: stale adult 5,000 must not undersell the 25,000 package
    expect(getDisplayPrice({ pricingType: 'group', adultPriceCents: 5000, groupPriceCents: 25000 }))
      .toEqual({ amount: 25000, isPackage: true });
  });

  it('falls back to the adult rate if a group product has no package price set', () => {
    expect(getDisplayPrice({ pricingType: 'group', adultPriceCents: 5000, groupPriceCents: 0 }))
      .toEqual({ amount: 5000, isPackage: false });
  });
});

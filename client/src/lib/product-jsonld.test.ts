import { describe, it, expect } from 'vitest';
import { buildOfferJsonLd } from './product-jsonld';

const url = 'https://acetoursvanuatu.com/transfers/hospitality';
const seller = 'Ace Tours & Transfers';

describe('buildOfferJsonLd', () => {
  it('emits the price in whole vatu, not divided by 100', () => {
    // Prices are stored as whole VUV despite the *PriceCents field names.
    // Hospitality Package (VT 25,000) previously reached Google as "250.00".
    const offer = buildOfferJsonLd({ price: 25000, currency: 'VUV' }, url, seller);
    expect(offer.price).toBe('25000');
    expect(offer.priceCurrency).toBe('VUV');
  });

  it('keeps per-person tour prices intact', () => {
    expect(buildOfferJsonLd({ price: 9500, currency: 'VUV' }, url, seller).price).toBe('9500');
  });

  it('defaults availability to InStock and includes url and seller', () => {
    expect(buildOfferJsonLd({ price: 1500, currency: 'VUV' }, url, seller)).toEqual({
      '@type': 'Offer',
      price: '1500',
      priceCurrency: 'VUV',
      availability: 'https://schema.org/InStock',
      url,
      seller: { '@type': 'Organization', name: seller },
    });
  });

  it('passes through an explicit availability', () => {
    const offer = buildOfferJsonLd({ price: 1500, currency: 'VUV', availability: 'OutOfStock' }, url, seller);
    expect(offer.availability).toBe('https://schema.org/OutOfStock');
  });
});

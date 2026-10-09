import { describe, it, expect } from 'vitest';
import { buildOfferJsonLd, buildRatingJsonLd } from './product-jsonld';

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
      shippingDetails: expect.any(Object),
      hasMerchantReturnPolicy: expect.any(Object),
    });
  });

  // Search Console merchant listings flags offers without these two fields.
  // Tours/transfers are services: nothing ships, nothing is returned after delivery.
  it('declares free, instant, in-Vanuatu "shipping" for a service', () => {
    const { shippingDetails } = buildOfferJsonLd({ price: 1500, currency: 'VUV' }, url, seller);
    expect(shippingDetails).toMatchObject({
      '@type': 'OfferShippingDetails',
      shippingRate: { '@type': 'MonetaryAmount', value: 0, currency: 'VUV' },
      shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'VU' },
      deliveryTime: {
        '@type': 'ShippingDeliveryTime',
        handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 0, unitCode: 'DAY' },
        transitTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 0, unitCode: 'DAY' },
      },
    });
  });

  it('declares that a delivered service cannot be returned', () => {
    const { hasMerchantReturnPolicy } = buildOfferJsonLd({ price: 1500, currency: 'VUV' }, url, seller);
    expect(hasMerchantReturnPolicy).toEqual({
      '@type': 'MerchantReturnPolicy',
      applicableCountry: 'VU',
      returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
    });
  });

  it('passes through an explicit availability', () => {
    const offer = buildOfferJsonLd({ price: 1500, currency: 'VUV', availability: 'OutOfStock' }, url, seller);
    expect(offer.availability).toBe('https://schema.org/OutOfStock');
  });
});

describe('buildRatingJsonLd', () => {
  it('returns null with no approved reviews (no empty ratings in markup)', () => {
    expect(buildRatingJsonLd([])).toBeNull();
  });

  it('averages to one decimal and counts every review', () => {
    const out = buildRatingJsonLd([
      { author: 'Sarah M.', rating: 5, body: 'Wonderful', datePublished: '2026-10-01' },
      { author: 'Tom K.', rating: 4 },
      { author: 'Ana P.', rating: 4 },
    ])!;
    expect(out.aggregateRating).toEqual({ '@type': 'AggregateRating', ratingValue: '4.3', bestRating: '5', reviewCount: 3 });
  });

  it('includes at most 5 reviews with named authors', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ author: `R${i}`, rating: 5 }));
    const out = buildRatingJsonLd(many)!;
    expect(out.review).toHaveLength(5);
    expect(out.review[0]).toEqual({
      '@type': 'Review',
      reviewRating: { '@type': 'Rating', ratingValue: 5, bestRating: 5 },
      author: { '@type': 'Person', name: 'R0' },
    });
    expect(out.aggregateRating).toMatchObject({ reviewCount: 8 });
  });

  it('omits empty body and date fields', () => {
    const out = buildRatingJsonLd([{ author: 'A', rating: 3, body: null }])!;
    expect(out.review[0]).not.toHaveProperty('reviewBody');
    expect(out.review[0]).not.toHaveProperty('datePublished');
  });
});

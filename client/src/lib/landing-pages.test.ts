import { describe, it, expect } from 'vitest';
import { LANDING_PAGES, LANDING_SLUGS, findLandingPage } from './landing-pages';

describe('LANDING_PAGES config', () => {
  it('has 6 pages with unique, slash-free slugs', () => {
    expect(LANDING_PAGES).toHaveLength(6);
    const slugs = LANDING_PAGES.map(p => p.slug);
    expect(new Set(slugs).size).toBe(6);
    for (const s of slugs) expect(s).not.toMatch(/^\/|\/$|\s/);
  });

  it('every page has required non-empty content', () => {
    for (const p of LANDING_PAGES) {
      expect(p.seoTitle.length).toBeGreaterThan(0);
      expect(p.seoDescription.length).toBeGreaterThan(0);
      expect(p.h1.length).toBeGreaterThan(0);
      expect(p.intro.length).toBeGreaterThan(0);
      expect(p.sections.length).toBeGreaterThan(0);
      expect(p.faqs.length).toBeGreaterThan(0);
      expect(p.keywords.length).toBeGreaterThan(0);
      expect(['tour', 'transfer']).toContain(p.category);
    }
  });

  it('ctaListingPath agrees with category', () => {
    for (const p of LANDING_PAGES) {
      const expected = p.category === 'tour' ? '/tours' : '/transfers';
      expect(p.ctaListingPath).toBe(expected);
    }
  });

  it('LANDING_SLUGS lists exactly the config slugs', () => {
    expect([...LANDING_SLUGS].sort()).toEqual(LANDING_PAGES.map(p => p.slug).sort());
  });

  it('findLandingPage resolves known slugs and rejects unknown', () => {
    expect(findLandingPage('port-vila-airport-transfers')?.category).toBe('transfer');
    expect(findLandingPage('mele-cascades-tour')?.category).toBe('tour');
    expect(findLandingPage('/port-vila-airport-transfers')).toBeUndefined();
    expect(findLandingPage('does-not-exist')).toBeUndefined();
  });

  it('featuredMatch is a RegExp that matches its intended product', () => {
    const air = findLandingPage('port-vila-airport-transfers')!;
    expect(air.featuredMatch.test('Premium Airport Transfer')).toBe(true);
    const mele = findLandingPage('mele-cascades-tour')!;
    expect(mele.featuredMatch.test('Mele Cascades Waterfall Tour')).toBe(true);
  });
});

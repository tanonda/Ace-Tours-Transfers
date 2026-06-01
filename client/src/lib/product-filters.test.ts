import { describe, it, expect } from 'vitest';
import { cleanProductList } from './product-filters';

interface P { title: string; isActive?: boolean; }

describe('cleanProductList', () => {
  it('drops inactive products', () => {
    const out = cleanProductList<P>([
      { title: 'Blue Lagoon Tour', isActive: true },
      { title: 'Hidden Tour', isActive: false },
    ]);
    expect(out.map(p => p.title)).toEqual(['Blue Lagoon Tour']);
  });

  it('drops test/verification data by title', () => {
    const out = cleanProductList<P>([
      { title: 'Real Tour', isActive: true },
      { title: 'Verification Tour', isActive: true },
      { title: 'concurrent test', isActive: true },
      { title: 'TEST_TOUR alpha', isActive: true },
      { title: 'phase4 thing', isActive: true },
    ]);
    expect(out.map(p => p.title)).toEqual(['Real Tour']);
  });

  it('de-dupes by normalized title (ignores trailing " Package")', () => {
    const out = cleanProductList<P>([
      { title: 'Mele Cascades', isActive: true },
      { title: 'Mele Cascades Package', isActive: true },
    ]);
    expect(out).toHaveLength(1);
  });

  it('prefers the active entry when a duplicate exists', () => {
    const out = cleanProductList<P>([
      { title: 'City Tour Package', isActive: false },
      { title: 'City Tour', isActive: true },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].isActive).toBe(true);
  });
});

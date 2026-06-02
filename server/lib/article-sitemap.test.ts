import { describe, it, expect } from 'vitest';
import { publishedArticleSitemapEntries } from './article-sitemap';

const now = '2026-06-02';
const rows = [
  { slug: 'a', status: 'published', updatedAt: new Date('2026-06-01T00:00:00Z') },
  { slug: 'b', status: 'draft',     updatedAt: new Date('2026-06-01T00:00:00Z') },
  { slug: 'c', status: 'published', updatedAt: null },
] as any[];

describe('publishedArticleSitemapEntries', () => {
  it('emits only published articles as /blog/<slug> with priority 0.7', () => {
    const out = publishedArticleSitemapEntries(rows, now);
    expect(out.map(e => e.loc)).toEqual(['/blog/a', '/blog/c']);
    expect(out.every(e => e.priority === '0.7')).toBe(true);
    expect(out.every(e => e.changefreq === 'monthly')).toBe(true);
  });
  it('uses updatedAt date for lastmod, falling back to now', () => {
    const out = publishedArticleSitemapEntries(rows, now);
    expect(out[0].lastmod).toBe('2026-06-01');
    expect(out[1].lastmod).toBe(now);
  });
});

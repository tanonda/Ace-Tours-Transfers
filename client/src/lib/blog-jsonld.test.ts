import { describe, it, expect } from 'vitest';
import { buildBlogPostingJsonLd } from './blog-jsonld';

const article = {
  title: 'Things to do in Port Vila',
  excerpt: 'A guide.',
  coverImage: 'https://img/x.jpg',
  author: 'Jane',
  tags: ['Travel tips', 'Things to do'],
  publishedAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-02T00:00:00.000Z',
  seoDescription: null,
} as any;

describe('buildBlogPostingJsonLd', () => {
  it('builds a BlogPosting object with the key fields', () => {
    const ld = buildBlogPostingJsonLd(article, 'https://acetoursvanuatu.com/blog/things-to-do-in-port-vila');
    expect(ld['@type']).toBe('BlogPosting');
    expect(ld.headline).toBe('Things to do in Port Vila');
    expect(ld.url).toBe('https://acetoursvanuatu.com/blog/things-to-do-in-port-vila');
    expect(ld.inLanguage).toBe('en');
    expect(ld.image).toBe('https://img/x.jpg');
    expect(ld.datePublished).toBe('2026-06-01T00:00:00.000Z');
    expect(ld.dateModified).toBe('2026-06-02T00:00:00.000Z');
    expect((ld.author as any).name).toBe('Jane');
    expect((ld.mainEntityOfPage as any)['@id']).toBe('https://acetoursvanuatu.com/blog/things-to-do-in-port-vila');
    expect(ld.keywords).toBe('Travel tips, Things to do');
  });
  it('identifies the company as an Organization when it authors a guide', () => {
    const ld = buildBlogPostingJsonLd(
      { ...article, author: 'Ace Tours & Transfers Vanuatu' },
      'https://acetoursvanuatu.com/blog/guide',
    );
    expect((ld.author as any)['@type']).toBe('Organization');
    expect((ld.publisher as any).url).toBe('https://acetoursvanuatu.com');
  });
  it('falls back to excerpt for description and omits author when absent', () => {
    const ld = buildBlogPostingJsonLd({ ...article, author: null, seoDescription: null }, 'https://x/y');
    expect(ld.description).toBe('A guide.');
    expect('author' in ld).toBe(false);
  });
});

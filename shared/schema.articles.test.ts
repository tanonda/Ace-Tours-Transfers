import { describe, it, expect } from 'vitest';
import { insertArticleSchema } from './schema';

const valid = {
  slug: 'things-to-do-in-port-vila',
  title: 'Things to do in Port Vila',
  bodyHtml: '<p>Lots to do.</p>',
  status: 'draft' as const,
};

describe('insertArticleSchema', () => {
  it('accepts a minimal valid article', () => {
    const parsed = insertArticleSchema.parse(valid);
    expect(parsed.slug).toBe('things-to-do-in-port-vila');
    expect(parsed.title).toBe('Things to do in Port Vila');
  });
  it('rejects missing title', () => {
    const { title, ...rest } = valid;
    expect(() => insertArticleSchema.parse(rest)).toThrow();
  });
  it('rejects missing slug', () => {
    const { slug, ...rest } = valid;
    expect(() => insertArticleSchema.parse(rest)).toThrow();
  });
  it('rejects missing bodyHtml', () => {
    const { bodyHtml, ...rest } = valid;
    expect(() => insertArticleSchema.parse(rest)).toThrow();
  });
  it('rejects an invalid status', () => {
    expect(() => insertArticleSchema.parse({ ...valid, status: 'archived' })).toThrow();
  });
});

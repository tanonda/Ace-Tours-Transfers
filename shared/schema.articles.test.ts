import { describe, it, expect } from 'vitest';
import { insertArticleSchema } from './schema.js';

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
  it('defaults status to draft; tags/relatedProductIds are undefined (SQL default applied at DB insert)', () => {
    const { status, ...noStatus } = valid;
    const parsed = insertArticleSchema.parse(noStatus);
    expect(parsed.status).toBe('draft');
    // drizzle-zod treats SQL-defaulted array columns as optional; the DB default ('{}'::text[])
    // is applied at insert time, not at parse time — so parsed values are undefined here.
    expect(parsed.tags).toBeUndefined();
    expect(parsed.relatedProductIds).toBeUndefined();
  });
});

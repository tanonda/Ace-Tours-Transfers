import { describe, it, expect } from 'vitest';
import { slugify, uniqueSlug } from './slugify';

describe('slugify', () => {
  it('lowercases, hyphenates, strips punctuation', () => {
    expect(slugify('Things To Do in Port Vila!')).toBe('things-to-do-in-port-vila');
  });
  it('collapses whitespace and trims hyphens', () => {
    expect(slugify('  Blue   Lagoon & Turtle Bay  ')).toBe('blue-lagoon-turtle-bay');
  });
  it('handles accents/diacritics', () => {
    expect(slugify('Café Efaté')).toBe('cafe-efate');
  });
  it('returns a fallback for empty/punctuation-only input', () => {
    expect(slugify('!!!')).toBe('article');
    expect(slugify('')).toBe('article');
  });
});

describe('uniqueSlug', () => {
  it('returns the base slug when unused', () => {
    expect(uniqueSlug('blue-lagoon', new Set())).toBe('blue-lagoon');
  });
  it('suffixes -2, -3 when taken', () => {
    expect(uniqueSlug('blue-lagoon', new Set(['blue-lagoon']))).toBe('blue-lagoon-2');
    expect(uniqueSlug('blue-lagoon', new Set(['blue-lagoon', 'blue-lagoon-2']))).toBe('blue-lagoon-3');
  });
});

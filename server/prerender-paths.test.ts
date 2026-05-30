import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { routeToRelFile, outputPathFor } from './prerender-paths';

describe('routeToRelFile', () => {
  it('maps root to index.html', () => {
    expect(routeToRelFile('/')).toBe('index.html');
    expect(routeToRelFile('')).toBe('index.html');
  });

  it('maps a top-level route to <route>/index.html', () => {
    expect(routeToRelFile('/tours')).toBe(path.join('tours', 'index.html'));
  });

  it('maps a nested detail route to <route>/index.html', () => {
    expect(routeToRelFile('/tours/abc-123')).toBe(path.join('tours', 'abc-123', 'index.html'));
  });

  it('ignores query strings and trailing slashes', () => {
    expect(routeToRelFile('/tours/abc-123/?x=1')).toBe(path.join('tours', 'abc-123', 'index.html'));
  });
});

describe('outputPathFor', () => {
  it('joins the relative file under the dist dir', () => {
    expect(outputPathFor('/tours/abc', '/tmp/dist')).toBe(path.join('/tmp/dist', 'tours', 'abc', 'index.html'));
  });
});

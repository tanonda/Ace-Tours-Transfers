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

import { prerenderFileFor } from './prerender-paths';

describe('prerenderFileFor', () => {
  const dist = '/tmp/dist';

  it('resolves a normal page route to its snapshot path', () => {
    expect(prerenderFileFor('/', dist)).toBe(path.join(dist, 'index.html'));
    expect(prerenderFileFor('/tours', dist)).toBe(path.join(dist, 'tours', 'index.html'));
    expect(prerenderFileFor('/tours/abc-123', dist)).toBe(path.join(dist, 'tours', 'abc-123', 'index.html'));
  });

  it('returns null for asset-like paths (segment with a dot)', () => {
    expect(prerenderFileFor('/assets/index-abc.js', dist)).toBeNull();
    expect(prerenderFileFor('/robots.txt', dist)).toBeNull();
    expect(prerenderFileFor('/sitemap.xml', dist)).toBeNull();
  });

  it('returns null for API and admin paths', () => {
    expect(prerenderFileFor('/api/availability', dist)).toBeNull();
    expect(prerenderFileFor('/admin/dashboard', dist)).toBeNull();
  });

  it('returns null for path traversal attempts', () => {
    expect(prerenderFileFor('/../secrets', dist)).toBeNull();
    expect(prerenderFileFor('/tours/..%2f..', dist)).toBeNull();
  });
});

import os from 'node:os';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { parseSitemapRoutes, writeSnapshot } from './prerender-paths';

describe('parseSitemapRoutes', () => {
  it('extracts unique pathnames from sitemap <loc> entries', () => {
    const xml = `<?xml version="1.0"?>
<urlset>
  <url><loc>https://acetoursvanuatu.com/</loc></url>
  <url><loc>https://acetoursvanuatu.com/tours</loc></url>
  <url><loc>https://acetoursvanuatu.com/tours/abc-123</loc></url>
  <url><loc>https://acetoursvanuatu.com/tours</loc></url>
</urlset>`;
    expect(parseSitemapRoutes(xml)).toEqual(['/', '/tours', '/tours/abc-123']);
  });
});

describe('writeSnapshot', () => {
  it('writes the html to the snapshot path, creating directories', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'prerender-'));
    const file = await writeSnapshot('<html><body>hi</body></html>', '/tours/xyz', dir);
    expect(file).toBe(path.join(dir, 'tours', 'xyz', 'index.html'));
    expect(await readFile(file, 'utf-8')).toContain('<body>hi</body>');
    await rm(dir, { recursive: true, force: true });
  });
});

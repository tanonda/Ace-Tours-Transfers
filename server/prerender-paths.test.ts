import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { routeToRelFile, outputPathFor, attachSnapshotState } from './prerender-paths.js';
import { MAX_STATE_BYTES, SNAPSHOT_STATE_ID } from '../shared/snapshot-state.js';

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

import { prerenderFileFor } from './prerender-paths.js';

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
import { hasPrerenderBypass, orderRoutesForPrerender, parseSitemapRoutes, swapAssetTags, writeSnapshot } from './prerender-paths.js';

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

describe('orderRoutesForPrerender', () => {
  // Safe now that the SPA fallback is a separate spa-shell.html: the homepage is the
  // most important page for crawlers, so it gets a fresh snapshot first.
  it('renders the homepage first', () => {
    expect(orderRoutesForPrerender(['/blog', '/', '/blog/guide'])).toEqual(['/', '/blog', '/blog/guide']);
  });

  it('leaves the order alone when there is no homepage', () => {
    expect(orderRoutesForPrerender(['/blog', '/tours'])).toEqual(['/blog', '/tours']);
  });
});

describe('hasPrerenderBypass', () => {
  it('detects the prerender bypass cookie among others', () => {
    expect(hasPrerenderBypass('a=1; prerender_bypass=1; b=2')).toBe(true);
    expect(hasPrerenderBypass('prerender_bypass=1')).toBe(true);
  });

  it('ignores missing or look-alike cookies', () => {
    expect(hasPrerenderBypass(undefined)).toBe(false);
    expect(hasPrerenderBypass('xprerender_bypass=1')).toBe(false);
    expect(hasPrerenderBypass('prerender_bypass=0')).toBe(false);
  });
});

describe('swapAssetTags', () => {
  const shell = `<html><head>
<script type="module" crossorigin src="/assets/index-NEW.js"></script>
<link rel="modulepreload" crossorigin href="/assets/vendor-NEW.js">
<link rel="stylesheet" crossorigin href="/assets/index-NEW.css">
</head><body><div id="root"></div></body></html>`;

  const oldSnapshot = `<html><head><title>Tours | Ace</title>
<script type="module" crossorigin src="/assets/index-OLD.js"></script>
<link rel="modulepreload" crossorigin href="/assets/vendor-OLD.js">
<link rel="stylesheet" crossorigin href="/assets/index-OLD.css">
<link rel="stylesheet" href="/assets/tours-OLD.css">
<link rel="canonical" href="https://acetoursvanuatu.com/tours">
</head><body><div id="root"><h1>Tours</h1><img src="https://res.cloudinary.com/x.jpg"></div></body></html>`;

  it("replaces the previous build's bundles with the current build's", () => {
    const out = swapAssetTags(oldSnapshot, shell);
    expect(out).not.toMatch(/-OLD\.(js|css)/);
    expect(out).toContain('src="/assets/index-NEW.js"');
    expect(out).toContain('href="/assets/vendor-NEW.js"');
    expect(out).toContain('href="/assets/index-NEW.css"');
  });

  it('keeps the page content, title and canonical', () => {
    const out = swapAssetTags(oldSnapshot, shell);
    expect(out).toContain('<title>Tours | Ace</title>');
    expect(out).toContain('<link rel="canonical" href="https://acetoursvanuatu.com/tours">');
    expect(out).toContain('<h1>Tours</h1><img src="https://res.cloudinary.com/x.jpg">');
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

describe('attachSnapshotState', () => {
  const page = '<html><head></head><body><div id="root"><h1>Tour</h1></div></body></html>';

  it('inserts the state block just before </body>', () => {
    const result = attachSnapshotState(page, '{"queries":[],"mutations":[]}');
    expect(result.skipped).toBeUndefined();
    expect(result.stateBytes).toBe(29);
    expect(result.html).toContain(
      `<script type="application/json" id="${SNAPSHOT_STATE_ID}">{"queries":[],"mutations":[]}</script></body>`,
    );
  });

  it('leaves the page unchanged when the app exposed no hook', () => {
    expect(attachSnapshotState(page, null)).toEqual({ html: page, stateBytes: 0, skipped: 'no dehydrate hook' });
  });

  it('leaves the page unchanged when the state is over the size cap', () => {
    const big = `{"queries":[{"x":"${'a'.repeat(MAX_STATE_BYTES)}"}],"mutations":[]}`;
    const result = attachSnapshotState(page, big);
    expect(result.html).toBe(page);
    expect(result.skipped).toMatch(/too large/);
  });

  it('survives swapAssetTags when snapshots are re-pointed at a new build', () => {
    const withState = attachSnapshotState(page, '{"queries":[],"mutations":[]}').html;
    const shell = '<html><head><script type="module" crossorigin src="/assets/index-NEW.js"></script></head><body></body></html>';
    expect(swapAssetTags(withState, shell)).toContain(`id="${SNAPSHOT_STATE_ID}"`);
  });
});

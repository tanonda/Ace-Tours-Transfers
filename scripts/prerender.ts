import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { chromium, type Browser, type Page } from 'playwright';
import { orderRoutesForPrerender, parseSitemapRoutes, writeSnapshot } from '../server/prerender-paths.js';
import { validatePrerenderSnapshots, validateSnapshotHtml } from '../server/prerender-validation.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const DIST_PUBLIC = path.join(REPO_ROOT, 'dist', 'public');
const SERVER_ENTRY = path.join(REPO_ROOT, 'dist', 'index.cjs');

const PORT = Number(process.env.PRERENDER_PORT ?? 5055);
const BASE_URL = process.env.PRERENDER_BASE_URL ?? `http://localhost:${PORT}`;
const SPAWN_SERVER = process.env.PRERENDER_SKIP_SPAWN !== '1';
const HEALTH_TIMEOUT_MS = 60_000;
const NAV_TIMEOUT_MS = 45_000;
const RENDER_DELAY_MS = Number(process.env.PRERENDER_RENDER_DELAY_MS ?? 2500);
// How long to wait for real content (the JSON-LD marker) after the app mounts,
// before falling back to snapshotting whatever is rendered. Generous because a
// cold Render container's first API calls can be slow.
const CONTENT_TIMEOUT_MS = Number(process.env.PRERENDER_CONTENT_TIMEOUT_MS ?? 30_000);

function browserExecutable(): string | undefined {
  const candidates = [
    process.env.PRERENDER_BROWSER_EXECUTABLE,
    chromium.executablePath(),
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  return candidates.find((candidate): candidate is string => Boolean(candidate && existsSync(candidate)));
}

async function waitForHealth(base: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) return;
    } catch {
      // server not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server did not become healthy within ${timeoutMs}ms at ${base}`);
}

function spawnServer(): ChildProcess {
  const child = spawn(process.execPath, ['--import', './dist/instrument.cjs', SERVER_ENTRY], {
    cwd: REPO_ROOT,
    env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT) },
    stdio: 'inherit',
  });
  return child;
}

async function getRoutes(base: string): Promise<string[]> {
  const res = await fetch(`${base}/sitemap.xml`);
  if (!res.ok) throw new Error(`Could not fetch sitemap: HTTP ${res.status}`);
  const xml = await res.text();
  return parseSitemapRoutes(xml);
}

async function waitForRouteContent(page: Page, route: string, timeoutMs: number): Promise<void> {
  const expectedRoute = route.length > 1 ? route.replace(/\/+$/, '') : '/';
  const requireArticleSchema = expectedRoute.startsWith('/blog/');
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const canonical = await page.locator('link[rel="canonical"]').first().getAttribute('href', { timeout: 500 }).catch(() => null);
    const h1 = await page.locator('h1').first().textContent({ timeout: 500 }).catch(() => null);
    const schemas = await page.locator('script[type="application/ld+json"]').allTextContents().catch(() => []);
    let canonicalPath: string | null = null;
    try {
      const pathname = new URL(canonical ?? '', page.url()).pathname;
      canonicalPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : '/';
    } catch {
      canonicalPath = null;
    }
    const hasArticleSchema = schemas.some((schema) => /"@type"\s*:\s*"(?:BlogPosting|Article)"/i.test(schema));
    if (canonicalPath === expectedRoute && Boolean(h1?.trim()) && (!requireArticleSchema || hasArticleSchema)) return;
    await page.waitForTimeout(250);
  }

  throw new Error(`route-specific content did not become ready within ${timeoutMs}ms`);
}

async function renderAll(base: string, routes: string[], browser: Browser): Promise<number> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  let ok = 0;
  const writtenRoutes: string[] = [];
  const failedRoutes: Array<{ route: string; error: string }> = [];
  for (const route of orderRoutesForPrerender(routes)) {
    try {
      // Use 'load' (not 'networkidle'): this SPA holds persistent connections
      // (Trustpilot widget, live currency API, Sentry) so networkidle rarely
      // fires and each page would stall near NAV_TIMEOUT. Mirrors the proven
      // approach in scripts/capture-user-manual-screenshots.ts.
      await page.goto(`${base}${route}`, { timeout: NAV_TIMEOUT_MS, waitUntil: 'load' });
      // Wait until React has mounted *something* into #root. Use state:'attached'
      // (DOM presence) — NOT the default 'visible': the first child React renders is
      // the toast region (pointer-events:none, zero-size), which Playwright deems
      // invisible, so a visibility wait would time out even though the app mounted.
      await page.waitForSelector('#root > *', { state: 'attached', timeout: NAV_TIMEOUT_MS });
      // A generic JSON-LD marker is not enough: the SPA shell already contains
      // homepage schema and previously caused article URLs to be snapshotted as
      // the homepage. Require this route's canonical plus real heading content;
      // article routes must additionally expose article-specific JSON-LD.
      await waitForRouteContent(page, route, CONTENT_TIMEOUT_MS);
      await page.waitForTimeout(RENDER_DELAY_MS);
      const html = await page.content();
      const validation = validateSnapshotHtml(html, route);
      if (validation.issues.length > 0) {
        throw new Error(validation.issues.join('; '));
      }
      const file = await writeSnapshot(html, route, DIST_PUBLIC);
      console.log(`[ok] ${route} -> ${path.relative(REPO_ROOT, file)}`);
      ok++;
      writtenRoutes.push(route);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`[fail] ${route}: ${error}`);
      failedRoutes.push({ route, error });
    }
  }
  await writeFile(
    path.join(DIST_PUBLIC, '.prerender-manifest.json'),
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      baseUrl: base,
      expectedRoutes: routes,
      writtenRoutes,
      failedRoutes,
      coverage: routes.length > 0 ? writtenRoutes.length / routes.length : 0,
    }, null, 2),
    'utf-8',
  );
  await context.close();
  return ok;
}

/** Orchestrate a full prerender pass. Resolves true if at least one page was written. */
export async function runPrerender(): Promise<boolean> {
  let server: ChildProcess | undefined;
  let browser: Browser | undefined;
  try {
    if (SPAWN_SERVER) {
      console.log(`[prerender] starting built server on port ${PORT}...`);
      server = spawnServer();
    }
    await waitForHealth(BASE_URL, HEALTH_TIMEOUT_MS);

    const routes = await getRoutes(BASE_URL);
    console.log(`[prerender] ${routes.length} routes from sitemap`);

    const executablePath = browserExecutable();
    console.log(`[prerender] browser: ${executablePath ?? 'Playwright default'}`);
    browser = await chromium.launch({ headless: true, ...(executablePath && { executablePath }) });
    const written = await renderAll(BASE_URL, routes, browser);
    console.log(`[prerender] wrote ${written}/${routes.length} snapshots`);
    const validation = await validatePrerenderSnapshots(routes, DIST_PUBLIC);
    const invalid = validation.filter((result) => result.issues.length > 0);
    if (invalid.length > 0) {
      const details = invalid.map((result) => `${result.route}: ${result.issues.join('; ')}`).join('\n');
      throw new Error(`Prerender validation failed for ${invalid.length}/${routes.length} sitemap routes:\n${details}`);
    }
    console.log(`[prerender] validated ${validation.length}/${routes.length} sitemap snapshots`);
    return validation.length === routes.length && validation.length > 0;
  } finally {
    await browser?.close();
    if (server) {
      // Track real process exit — `server.killed` only reflects that a signal
      // was sent, not that the process died, so it can't gate a SIGKILL fallback.
      let exited = false;
      server.once('exit', () => { exited = true; });
      server.kill('SIGTERM');
      // Give it a moment to shut down, then force-kill if still alive.
      await new Promise((r) => setTimeout(r, 2000));
      if (!exited) server.kill('SIGKILL');
    }
  }
}

// CLI entry — run directly with: tsx scripts/prerender.ts
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  runPrerender()
    .then((didWrite) => process.exit(didWrite ? 0 : 1))
    .catch((err) => {
      console.error('[prerender] fatal:', err);
      process.exit(1);
    });
}

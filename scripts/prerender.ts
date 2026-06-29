import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, type ChildProcess } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { chromium, type Browser } from 'playwright';
import { parseSitemapRoutes, writeSnapshot } from '../server/prerender-paths.js';

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
const CONTENT_TIMEOUT_MS = Number(process.env.PRERENDER_CONTENT_TIMEOUT_MS ?? 15_000);

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

async function renderAll(base: string, routes: string[], browser: Browser): Promise<number> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  let ok = 0;
  const writtenRoutes: string[] = [];
  const failedRoutes: Array<{ route: string; error: string }> = [];
  for (const route of routes) {
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
      // Then wait for real CONTENT, not just the loading spinner. The <SEO>
      // component injects a JSON-LD <script> into <head> only after the page's
      // data (react-query) has loaded and the page body renders — so it's the
      // reliable "content ready" signal we actually care about for SEO. Without
      // this, a slow API (cold Render container) gets snapshotted mid-spinner:
      // populated #root but no <h1>/JSON-LD. Fall back to a settle delay if the
      // marker never appears, so a page that legitimately lacks JSON-LD (or a
      // transient slow load) still produces a best-effort snapshot rather than
      // failing outright.
      try {
        await page.waitForSelector('head script[type="application/ld+json"]', {
          state: 'attached',
          timeout: CONTENT_TIMEOUT_MS,
        });
      } catch {
        console.warn(`[warn] ${route}: no JSON-LD after ${CONTENT_TIMEOUT_MS}ms — snapshotting current DOM`);
      }
      await page.waitForTimeout(RENDER_DELAY_MS);
      const html = await page.content();
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

    browser = await chromium.launch({ headless: true });
    const written = await renderAll(BASE_URL, routes, browser);
    console.log(`[prerender] wrote ${written}/${routes.length} snapshots`);
    return written > 0;
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

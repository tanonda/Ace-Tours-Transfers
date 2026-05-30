# SEO Prerender of Public Pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every public page serve complete, unique, crawler-readable HTML (title, meta, canonical, body copy, JSON-LD) *before* JavaScript runs, by generating static prerendered snapshots at build time and serving them ahead of the SPA fallback.

**Architecture:** After the normal client build, a Playwright pass starts the freshly-built production server as a child process, reads the route list from the existing `/sitemap.xml` (single source of truth), renders each route in a real browser (so React + react-helmet-async produce the full DOM), and writes `dist/public/<route>/index.html` snapshots. The Express static server is taught to serve a matching snapshot for any GET request, falling back to the SPA shell when none exists. Everyone — crawlers and humans — gets real HTML; the React app then hydrates as before. Snapshots refresh on every build/deploy.

**Tech Stack:** TypeScript (ESM), Vite, esbuild, Express 5, Playwright (chromium, already a dependency), Vitest, tsx.

---

## Background the engineer needs

- **Why this exists:** A live crawl proved that `curl -A Googlebot https://acetoursvanuatu.com/` returns only `<div id="root"></div>` with no JSON-LD, no `<h1>`, and detail pages (`/tours/<id>`) return the *homepage* `<title>`. The production build itself is healthy (hashed `/assets/*.js`, no dev-server markers) — the problem is pure client-side rendering. All the good SEO code in `client/src/components/seo.tsx` only runs after JS, so crawlers and non-JS bots never see it. This is the single biggest reason the site does not rank for "tours Port Vila", "transfers Vanuatu", etc.
- **Build entry:** `package.json` script `"build": "tsx script/build.ts"` (note: `script/` singular for the build, `scripts/` plural for everything else). `script/build.ts` runs `viteBuild()` then bundles the server with esbuild to `dist/index.cjs`. Client assets land in `dist/public/`.
- **Serving:** `package.json` `"start": "NODE_ENV=production node --import ./dist/instrument.cjs dist/index.cjs"`. In production `server/index.ts:614` calls `serveStatic(app)` from `server/static.ts`, which does `express.static(distPath)` then a catch-all `sendFile(index.html)`. `distPath` resolves to `dist/public` (it's `path.resolve(__dirname, "public")` relative to the bundled `dist/index.cjs`).
- **Route source of truth:** `server/routes.ts:272` already serves `/sitemap.xml` with exactly the public routes we want to prerender (6 static pages + every active non-vehicle product as `/tours/<id>` or `/transfers/<id>`). We reuse it instead of re-querying the DB — DRY.
- **Playwright usage pattern:** see `scripts/capture-user-manual-screenshots.ts` (`chromium.launch({ headless: true })`, `context.newPage()`, `page.goto(url, { waitUntil: 'load' })`, `page.waitForTimeout(...)`).
- **Test pattern:** Vitest with `describe/it/expect`, temp dirs via `mkdtemp(path.join(os.tmpdir(), ...))`; see `scripts/build-user-manual.test.ts`. Run a single file with `npx vitest run <path>`.

## Decisions locked in (from brainstorming)

- Build-time prerender for **all** visitors (not bot-only cloaking, not an SSR framework migration).
- Freshness: snapshots regenerate on each build/deploy. No live re-snapshot endpoint in this plan.
- **English only.** No per-language URLs or hreflang in this plan (separate later plan).
- If prerendering can't run (e.g. server won't start at build time), the build must **still succeed** and simply ship without snapshots (current behavior) — prerender failure is non-fatal.

## File structure

- **Create** `server/prerender-paths.ts` — dependency-free pure helpers shared by the writer (script) and the reader (static server): route→file mapping, request→snapshot resolution with safety guards, sitemap parsing, snapshot writing. One responsibility: path/route logic.
- **Create** `server/prerender-paths.test.ts` — unit tests for the pure helpers.
- **Create** `scripts/prerender.ts` — the orchestration runner: spawn built server, wait for health, fetch routes from sitemap, render with Playwright, write snapshots, clean up. Exports `runPrerender()` and has a CLI `main()`.
- **Modify** `server/static.ts` — serve a matching prerendered snapshot before the SPA fallback; disable static directory indexing/redirects so canonical (no-trailing-slash) URLs are preserved.
- **Modify** `script/build.ts` — call `runPrerender()` after the esbuild step, guarded so failure never breaks the build.
- **Modify** `Dockerfile` — install the Playwright chromium binary so prerender can run in the build/deploy image.

---

## Task 1: Pure route→file mapping helpers

**Files:**
- Create: `server/prerender-paths.ts`
- Test: `server/prerender-paths.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// server/prerender-paths.test.ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/prerender-paths.test.ts`
Expected: FAIL — `Cannot find module './prerender-paths'`.

- [ ] **Step 3: Write the minimal implementation**

```ts
// server/prerender-paths.ts
import path from 'node:path';

/** Strip query/hash, normalise trailing slash. '/tours/abc/?x=1' -> '/tours/abc' */
function cleanRoute(route: string): string {
  let r = route.split('?')[0].split('#')[0];
  if (r.length > 1 && r.endsWith('/')) r = r.replace(/\/+$/, '');
  return r;
}

/** Map a URL path to the relative snapshot file. '/' -> 'index.html', '/tours/abc' -> 'tours/abc/index.html'. */
export function routeToRelFile(route: string): string {
  const r = cleanRoute(route);
  if (r === '' || r === '/') return 'index.html';
  return path.join(r.replace(/^\/+/, ''), 'index.html');
}

/** Absolute path to the snapshot file under distPath for a given route. */
export function outputPathFor(route: string, distPath: string): string {
  return path.join(distPath, routeToRelFile(route));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run server/prerender-paths.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add server/prerender-paths.ts server/prerender-paths.test.ts
git commit -m "feat(seo): add route-to-file mapping for prerender snapshots"
```

---

## Task 2: Request→snapshot resolver with safety guards

**Files:**
- Modify: `server/prerender-paths.ts`
- Modify: `server/prerender-paths.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `server/prerender-paths.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/prerender-paths.test.ts`
Expected: FAIL — `prerenderFileFor is not a function`.

- [ ] **Step 3: Implement `prerenderFileFor`**

Append to `server/prerender-paths.ts`:

```ts
const BLOCKED_PREFIXES = ['/api', '/admin', '/assets'];

/**
 * Given an incoming GET request path, return the snapshot file path to serve,
 * or null if the path must not be served from a snapshot (assets, api, admin,
 * traversal, or any segment containing a dot — i.e. a real file extension).
 * Existence on disk is the caller's responsibility.
 */
export function prerenderFileFor(reqPath: string, distPath: string): string | null {
  if (!reqPath.startsWith('/')) return null;
  if (reqPath.includes('\0')) return null;
  // Reject encoded or literal traversal before normalising.
  const lower = reqPath.toLowerCase();
  if (lower.includes('..') || lower.includes('%2f') || lower.includes('%2e')) return null;

  const clean = reqPath.split('?')[0].split('#')[0];
  if (BLOCKED_PREFIXES.some((p) => clean === p || clean.startsWith(p + '/'))) return null;

  // Any segment containing a dot is treated as a real file (e.g. .js, .txt, .xml).
  const segments = clean.split('/').filter(Boolean);
  if (segments.some((s) => s.includes('.'))) return null;

  const candidate = outputPathFor(clean, distPath);
  // Traversal guard: resolved candidate must stay within distPath.
  const resolvedDist = path.resolve(distPath);
  const resolvedCandidate = path.resolve(candidate);
  if (resolvedCandidate !== resolvedDist + path.sep + 'index.html'
      && !resolvedCandidate.startsWith(resolvedDist + path.sep)) {
    return null;
  }
  return candidate;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run server/prerender-paths.test.ts`
Expected: PASS (all Task 1 + Task 2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/prerender-paths.ts server/prerender-paths.test.ts
git commit -m "feat(seo): add guarded request-to-snapshot resolver"
```

---

## Task 3: Sitemap route parser + snapshot writer

**Files:**
- Modify: `server/prerender-paths.ts`
- Modify: `server/prerender-paths.test.ts`

- [ ] **Step 1: Add the failing tests**

Append to `server/prerender-paths.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/prerender-paths.test.ts`
Expected: FAIL — `parseSitemapRoutes is not a function`.

- [ ] **Step 3: Implement both functions**

Append to `server/prerender-paths.ts`:

```ts
import { mkdir, writeFile } from 'node:fs/promises';

/** Extract unique URL pathnames from sitemap XML, preserving first-seen order. */
export function parseSitemapRoutes(xml: string): string[] {
  const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1].trim());
  const seen = new Set<string>();
  const routes: string[] = [];
  for (const loc of locs) {
    let pathname: string;
    try {
      pathname = new URL(loc).pathname || '/';
    } catch {
      pathname = loc.startsWith('/') ? loc : '/' + loc;
    }
    if (!seen.has(pathname)) {
      seen.add(pathname);
      routes.push(pathname);
    }
  }
  return routes;
}

/** Write a snapshot HTML string to its computed path, creating parent dirs. Returns the path written. */
export async function writeSnapshot(html: string, route: string, distPath: string): Promise<string> {
  const file = outputPathFor(route, distPath);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, html, 'utf-8');
  return file;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run server/prerender-paths.test.ts`
Expected: PASS (all tests across Tasks 1–3).

- [ ] **Step 5: Commit**

```bash
git add server/prerender-paths.ts server/prerender-paths.test.ts
git commit -m "feat(seo): add sitemap route parser and snapshot writer"
```

---

## Task 4: Serve snapshots from the static server

**Files:**
- Modify: `server/static.ts`

- [ ] **Step 1: Replace the body of `serveStatic`**

Edit `server/static.ts` to this exact content:

```ts
import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { prerenderFileFor } from "./prerender-paths.js";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Serve real files (hashed assets, robots.txt, etc.) but never auto-index a
  // directory or 301-redirect to a trailing slash — we control HTML responses
  // ourselves below so canonical (no-trailing-slash) URLs stay intact.
  app.use(express.static(distPath, { index: false, redirect: false }));

  // Serve a prerendered HTML snapshot for matching GET routes, if one exists.
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const snapshot = prerenderFileFor(req.path, distPath);
    if (snapshot && fs.existsSync(snapshot)) {
      return res.sendFile(snapshot);
    }
    next();
  });

  // SPA fallback: serve the app shell (or prerendered home) for anything else.
  app.use((_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
```

- [ ] **Step 2: Type-check the server**

Run: `npx tsc --project server/tsconfig.json --noEmit`
Expected: PASS (no errors). If `server/tsconfig.json` is not directly checkable this way, run `npm run check`.

- [ ] **Step 3: Re-run the unit tests to confirm nothing regressed**

Run: `npx vitest run server/prerender-paths.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/static.ts
git commit -m "feat(seo): serve prerendered snapshots ahead of SPA fallback"
```

---

## Task 5: Prerender runner script

**Files:**
- Create: `scripts/prerender.ts`

- [ ] **Step 1: Write the runner**

Create `scripts/prerender.ts` with this exact content:

```ts
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, type ChildProcess } from 'node:child_process';
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
  for (const route of routes) {
    try {
      await page.goto(`${base}${route}`, { timeout: NAV_TIMEOUT_MS, waitUntil: 'networkidle' });
      await page.waitForTimeout(RENDER_DELAY_MS);
      const html = await page.content();
      const file = await writeSnapshot(html, route, DIST_PUBLIC);
      console.log(`[ok] ${route} -> ${path.relative(REPO_ROOT, file)}`);
      ok++;
    } catch (err) {
      console.error(`[fail] ${route}: ${err instanceof Error ? err.message : err}`);
    }
  }
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
      server.kill('SIGTERM');
      // Give it a moment, then force-kill if still alive.
      await new Promise((r) => setTimeout(r, 2000));
      if (!server.killed) server.kill('SIGKILL');
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
```

- [ ] **Step 2: Type-check the script**

Run: `npx tsc --noEmit scripts/prerender.ts` (or `npm run check`).
Expected: PASS. If `fetch` is flagged as undefined, confirm `@types/node` is v20+ (it is: `^20.19.32`) and that `lib` includes a recent target; `fetch` is global in Node 18+. If tsc still complains, add `// @ts-expect-error global fetch` is NOT allowed — instead ensure `tsconfig.json` `lib` includes `"DOM"` or use `import { fetch } from 'undici'`. Prefer the global; only fall back to undici if the check fails.

- [ ] **Step 3: Commit**

```bash
git add scripts/prerender.ts
git commit -m "feat(seo): add Playwright build-time prerender runner"
```

---

## Task 6: Add an npm script and wire prerender into the build

**Files:**
- Modify: `package.json`
- Modify: `script/build.ts`

- [ ] **Step 1: Add the npm script**

In `package.json` `scripts`, add after the `"build"` line:

```json
    "prerender": "tsx scripts/prerender.ts",
```

- [ ] **Step 2: Call the runner from the build, non-fatally**

Edit `script/build.ts`. Add the import at the top (after the existing imports):

```ts
import { runPrerender } from "../scripts/prerender.js";
```

Then, inside `buildAll()`, after the `await esbuild({ ... })` call completes (just before the end of the function), add:

```ts
  if (process.env.PRERENDER !== "0") {
    console.log("prerendering public pages...");
    try {
      const didWrite = await runPrerender();
      if (!didWrite) {
        console.warn(
          "[build] prerender produced no snapshots — shipping SPA shell only. " +
          "Set PRERENDER=0 to silence, or check DATABASE_URL / server startup.",
        );
      }
    } catch (err) {
      console.warn(
        "[build] prerender failed (non-fatal); shipping SPA shell only:",
        err instanceof Error ? err.message : err,
      );
    }
  }
```

- [ ] **Step 3: Type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add package.json script/build.ts
git commit -m "feat(seo): run prerender as a non-fatal build step"
```

---

## Task 7: Ensure chromium + DATABASE_URL are available where the build runs

**Files:**
- Modify: `Dockerfile`

**Context:** The `Dockerfile` is multi-stage. The `builder` stage runs `RUN npm run build`, which is where the prerender step (Task 6) executes. Two things must be true *in that stage* for prerender to actually produce snapshots: (a) the chromium browser binary is installed, and (b) `DATABASE_URL` is reachable so the spawned production server can start and serve `/sitemap.xml`. At image-build time `DATABASE_URL` is usually absent — in that case prerender degrades gracefully (non-fatal, Task 6) and the deploy still ships the SPA shell. Whichever host environment has DB access at build time is where snapshots will be produced. The snapshots live in `dist/public/`, which the existing `COPY --from=builder /app/dist ./dist` already carries into the production stage — no extra copy needed.

- [ ] **Step 1: Install chromium and accept DATABASE_URL in the builder stage**

In `Dockerfile`, change the builder stage from:

```dockerfile
# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build
```

to:

```dockerfile
# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm install

# Chromium for the build-time SEO prerender step (scripts/prerender.ts).
RUN npx playwright install --with-deps chromium

# Copy source and build. DATABASE_URL is passed at build time (--build-arg or
# BuildKit secret) so prerender can start the server and read /sitemap.xml.
# Absent DB => prerender is skipped non-fatally and the SPA shell ships as before.
COPY . .
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
RUN npm run build
```

- [ ] **Step 2: Note for the actual host (Render etc.)**

If the production host builds from `render.yaml` rather than this Dockerfile, the same two requirements apply to that host's build command: add `npx playwright install --with-deps chromium` **before** `npm run build`, and ensure `DATABASE_URL` is present in the *build* environment (not just runtime). Document this in the PR description. Because prerender is non-fatal, a missing browser or DB degrades to today's SPA-shell behavior rather than breaking the deploy — but then snapshots won't be produced, so the SEO fix won't take effect until the build environment has both.

- [ ] **Step 3: Commit**

```bash
git add Dockerfile
git commit -m "build(seo): install chromium and pass DATABASE_URL for prerender build step"
```

---

## Task 8: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Full build with prerender against the local DB**

Ensure `.env` has a working `DATABASE_URL`. Run:

```bash
npm run build
```

Expected: client + server build, then `[prerender] N routes from sitemap` and several `[ok] /tours/<id> -> dist/public/tours/<id>/index.html` lines, ending with `[prerender] wrote N/N snapshots`. If you see the non-fatal warning instead, debug `npm run prerender` directly before continuing.

- [ ] **Step 2: Confirm snapshots contain real content (no browser)**

```bash
grep -c 'application/ld+json' dist/public/index.html
grep -o '<title>[^<]*</title>' dist/public/tours/*/index.html | head
grep -c '<div id="root">' dist/public/index.html
```

Expected: home `index.html` has at least one `application/ld+json` block; each tour snapshot has a **unique, product-specific** `<title>` (not the generic homepage title); the home `#root` div is **non-empty** (rendered markup inside it).

- [ ] **Step 3: Serve the build and curl like a crawler**

```bash
NODE_ENV=production PORT=5060 node --import ./dist/instrument.cjs dist/index.cjs &
SERVER_PID=$!
# wait for health
until curl -sf http://localhost:5060/api/health >/dev/null; do sleep 1; done

# a detail page must now return its own title + JSON-LD with NO JS executed:
TOUR=$(curl -s http://localhost:5060/sitemap.xml | grep -o '/tours/[a-z0-9-]*' | head -1)
echo "Testing $TOUR"
curl -s "http://localhost:5060$TOUR" | grep -o '<title>[^<]*</title>'
curl -s "http://localhost:5060$TOUR" | grep -c 'application/ld+json'
# canonical must be the no-trailing-slash URL (no 301):
curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:5060$TOUR"

kill $SERVER_PID
```

Expected: the tour URL returns HTTP `200` (not `301`), a **unique** `<title>`, and `>=1` `application/ld+json` block — all without executing JavaScript. This is the core success criterion.

- [ ] **Step 4: Confirm assets and SPA fallback still work**

```bash
NODE_ENV=production PORT=5061 node --import ./dist/instrument.cjs dist/index.cjs &
SERVER_PID=$!
until curl -sf http://localhost:5061/api/health >/dev/null; do sleep 1; done
# robots.txt still served as a real file:
curl -s -o /dev/null -w 'robots:%{http_code}\n' http://localhost:5061/robots.txt
# a hashed asset still 200s:
ASSET=$(grep -o '/assets/[A-Za-z0-9_-]*\.js' dist/public/index.html | head -1)
curl -s -o /dev/null -w "asset:%{http_code}\n" "http://localhost:5061$ASSET"
# an unknown route falls back to the app shell (200, has #root):
curl -s -o /dev/null -w 'fallback:%{http_code}\n' http://localhost:5061/some/unknown/path
kill $SERVER_PID
```

Expected: `robots:200`, `asset:200`, `fallback:200`.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all tests pass (existing suite + the new `prerender-paths` tests).

- [ ] **Step 6: Final commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "test(seo): verify prerendered public pages end-to-end"
```

---

## Post-merge (not code — operational follow-ups, tracked in later plans)

- Deploy, then re-run the live crawl: `curl -s https://acetoursvanuatu.com/tours/<id> | grep -o '<title>[^<]*</title>'` must show the tour's own title.
- Resubmit `sitemap.xml` in Google Search Console; use the URL Inspection / Rich Results tests on a tour URL.
- Proceed to **Phase 2** (canonical domain fix, `VITE_APP_URL`, per-product SEO fields), then Phases 3–6 from `~/.claude/plans/resume-calm-mccarthy.md`.

## Self-review notes

- **Spec coverage:** Phase 1 of the approved plan = "crawlers must see real content via build-time prerender, all visitors, refresh-on-deploy, English-only." Tasks 1–8 cover route enumeration (reuse sitemap), rendering (Playwright), writing snapshots, serving them without trailing-slash redirects, build wiring (non-fatal), browser availability, and end-to-end verification. Phases 2–6 are explicitly deferred to separate plans.
- **Type consistency:** `routeToRelFile`, `outputPathFor`, `prerenderFileFor`, `parseSitemapRoutes`, `writeSnapshot`, `runPrerender` are named identically in their definitions, tests, and call sites (`server/static.ts`, `scripts/prerender.ts`, `script/build.ts`).
- **Non-fatal guarantee:** build wiring (Task 6) and the host note (Task 7) ensure a prerender failure degrades to today's SPA-shell behavior rather than breaking deploys.

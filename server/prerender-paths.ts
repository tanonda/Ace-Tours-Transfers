import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { MAX_STATE_BYTES, SNAPSHOT_STATE_ID } from '../shared/snapshot-state.js';

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
  if (!resolvedCandidate.startsWith(resolvedDist + path.sep)) {
    return null;
  }
  return candidate;
}

/** Extract unique URL pathnames from sitemap XML, preserving first-seen order. */
export function parseSitemapRoutes(xml: string): string[] {
  const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/gs)].map((m) => m[1].trim());
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

/**
 * Pristine copy of the built app shell. The `/` snapshot overwrites index.html,
 * so the SPA fallback (and the prerenderer itself) uses this file instead.
 */
export const SPA_SHELL_FILE = 'spa-shell.html';

/**
 * Cookie the prerenderer's browser carries so the server hands it the bare app
 * shell rather than an existing snapshot (fresh snapshots must never be rendered
 * on top of old ones). A cookie, not a header, so it never reaches third parties.
 */
export const PRERENDER_BYPASS_COOKIE = 'prerender_bypass';

export function hasPrerenderBypass(cookieHeader: string | undefined): boolean {
  return (cookieHeader ?? '').split(';').some((c) => c.trim() === `${PRERENDER_BYPASS_COOKIE}=1`);
}

/**
 * Homepage first: it is the page crawlers care about most. Safe because the SPA
 * fallback is SPA_SHELL_FILE, not the index.html that the `/` snapshot replaces.
 */
export function orderRoutesForPrerender(routes: string[]): string[] {
  const isRoot = (route: string) => cleanRoute(route) === '/';
  return [...routes.filter(isRoot).slice(0, 1).map(() => '/'), ...routes.filter((route) => !isRoot(route))];
}

// <script src="/assets/…"></script> and <link href="/assets/…"> (stylesheets, modulepreloads)
const ASSET_SCRIPT = /<script\b[^>]*\bsrc="\/assets\/[^"]*"[^>]*>\s*<\/script>/gi;
const ASSET_LINK = /<link\b[^>]*\bhref="\/assets\/[^"]*"[^>]*>/gi;

/**
 * Re-point a snapshot taken from a previous deploy at the current build's bundles.
 * Vite file names are content-hashed, so the old ones 404 after a deploy.
 */
export function swapAssetTags(snapshotHtml: string, shellHtml: string): string {
  const current = [...(shellHtml.match(ASSET_SCRIPT) ?? []), ...(shellHtml.match(ASSET_LINK) ?? [])];
  const stripped = snapshotHtml.replace(ASSET_SCRIPT, '').replace(ASSET_LINK, '');
  return stripped.replace(/<\/head>/i, `${current.join('\n')}\n</head>`);
}

/**
 * Embed the page's react-query state so the client can hydrate instead of rebuilding.
 * `stateJson` must already be script-safe (client/src/lib/hydration.ts
 * serializeSnapshotState). Without it the snapshot still works; the client renders
 * from scratch as before.
 */
export function attachSnapshotState(
  html: string,
  stateJson: string | null,
): { html: string; stateBytes: number; skipped?: string } {
  if (stateJson === null) return { html, stateBytes: 0, skipped: 'no dehydrate hook' };
  const stateBytes = Buffer.byteLength(stateJson, 'utf-8');
  if (stateBytes > MAX_STATE_BYTES) {
    return { html, stateBytes, skipped: `state too large (${stateBytes} > ${MAX_STATE_BYTES} bytes)` };
  }
  const end = html.lastIndexOf('</body>');
  if (end === -1) return { html, stateBytes, skipped: 'no </body>' };
  const tag = `<script type="application/json" id="${SNAPSHOT_STATE_ID}">${stateJson}</script>`;
  return { html: html.slice(0, end) + tag + html.slice(end), stateBytes };
}

/** Write a snapshot HTML string to its computed path, creating parent dirs. Returns the path written. */
export async function writeSnapshot(html: string, route: string, distPath: string): Promise<string> {
  const file = outputPathFor(route, distPath);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, html, 'utf-8');
  return file;
}

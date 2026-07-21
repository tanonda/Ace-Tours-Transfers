import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

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
 * Keep the root route last. Once `/` is snapshotted it replaces the SPA shell
 * at dist/public/index.html, which is also the fallback used while rendering
 * routes that do not have snapshots yet.
 */
export function orderRoutesForPrerender(routes: string[]): string[] {
  return [...routes.filter((route) => cleanRoute(route) !== '/')].concat(
    routes.some((route) => cleanRoute(route) === '/') ? ['/'] : [],
  );
}

/** Write a snapshot HTML string to its computed path, creating parent dirs. Returns the path written. */
export async function writeSnapshot(html: string, route: string, distPath: string): Promise<string> {
  const file = outputPathFor(route, distPath);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, html, 'utf-8');
  return file;
}

import path from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { parseSitemapRoutes, SPA_SHELL_FILE, swapAssetTags, writeSnapshot } from "./prerender-paths.js";
import { validateSnapshotHtml } from "./prerender-validation.js";

/**
 * Seed crawler snapshots from the deploy that is still serving traffic.
 *
 * On Render the prerender runs after the new container starts (~5 min), and the
 * new instance takes traffic as soon as it is healthy. Without seeding, crawlers
 * would get the empty app shell in that window. During a deploy the public URL is
 * still served by the previous instance, so we copy its snapshots first, re-point
 * them at this build's hashed bundles, and let the fresh prerender overwrite them.
 *
 * Best-effort only: an unreachable source (e.g. a plain restart) just seeds nothing.
 */
export interface SeedOptions {
  sourceUrl: string;
  distPath: string;
  fetchImpl?: typeof fetch;
  /** Overall budget for the whole seeding pass. */
  timeoutMs?: number;
  concurrency?: number;
}

export interface SeedResult {
  seeded: string[];
  skipped: Array<{ route: string; reason: string }>;
}

const REQUEST_TIMEOUT_MS = 10_000;

export async function seedSnapshotsFromPreviousDeploy({
  sourceUrl,
  distPath,
  fetchImpl = fetch,
  timeoutMs = 90_000,
  concurrency = 4,
}: SeedOptions): Promise<SeedResult> {
  const result: SeedResult = { seeded: [], skipped: [] };
  const shellPath = path.join(distPath, SPA_SHELL_FILE);
  if (!existsSync(shellPath)) {
    result.skipped.push({ route: "*", reason: `no ${SPA_SHELL_FILE} in build` });
    return result;
  }
  const shell = await readFile(shellPath, "utf-8");
  const base = sourceUrl.replace(/\/+$/, "");
  const deadline = Date.now() + timeoutMs;

  const get = (url: string) => fetchImpl(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });

  let routes: string[];
  try {
    const res = await get(`${base}/sitemap.xml`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    routes = parseSitemapRoutes(await res.text());
  } catch (err) {
    result.skipped.push({ route: "*", reason: `sitemap unavailable: ${err instanceof Error ? err.message : String(err)}` });
    return result;
  }

  const queue = [...routes];
  async function worker() {
    for (let route = queue.shift(); route !== undefined; route = queue.shift()) {
      if (Date.now() > deadline) {
        result.skipped.push({ route, reason: "seeding time budget exhausted" });
        continue;
      }
      try {
        const res = await get(`${base}${route}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        // Rejects the bare app shell and anything not genuinely rendered for this route.
        const { issues } = validateSnapshotHtml(html, route);
        if (issues.length > 0) throw new Error(issues.join("; "));
        await writeSnapshot(swapAssetTags(html, shell), route, distPath);
        result.seeded.push(route);
      } catch (err) {
        result.skipped.push({ route, reason: err instanceof Error ? err.message : String(err) });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, routes.length) }, worker));
  return result;
}

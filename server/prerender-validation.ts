import { readFile } from "node:fs/promises";
import { outputPathFor } from "./prerender-paths.js";

export interface SnapshotValidationResult {
  route: string;
  issues: string[];
}

function normalizedPath(value: string): string | null {
  try {
    const pathname = new URL(value, "https://acetoursvanuatu.com").pathname;
    return pathname.length > 1 ? pathname.replace(/\/+$/, "") : "/";
  } catch {
    return null;
  }
}

function textContent(fragment: string): string {
  return fragment
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:nbsp|#160);/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Validate the SEO-critical content that must exist in the initial response. */
export function validateSnapshotHtml(html: string, route: string): SnapshotValidationResult {
  const issues: string[] = [];
  const expectedPath = normalizedPath(route);
  const title = html.match(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i)?.[1];
  const canonical = html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i)?.[1]
    ?? html.match(/<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*>/i)?.[1];
  const h1 = html.match(/<h1(?:\s[^>]*)?>([\s\S]*?)<\/h1>/i)?.[1];

  if (!title || !textContent(title)) issues.push("missing a non-empty <title>");
  if (!canonical) {
    issues.push("missing rel=canonical");
  } else if (normalizedPath(canonical) !== expectedPath) {
    issues.push(`canonical path is ${normalizedPath(canonical) ?? "invalid"}, expected ${expectedPath}`);
  }
  if (!h1 || !textContent(h1)) issues.push("missing a non-empty <h1>");

  if (expectedPath?.startsWith("/blog/") && !/"@type"\s*:\s*"(?:BlogPosting|Article)"/i.test(html)) {
    issues.push("missing BlogPosting or Article JSON-LD");
  }

  return { route, issues };
}

/** Validate every route advertised by the sitemap against its built snapshot. */
export async function validatePrerenderSnapshots(
  routes: string[],
  distPath: string,
): Promise<SnapshotValidationResult[]> {
  const results: SnapshotValidationResult[] = [];
  for (const route of routes) {
    try {
      const html = await readFile(outputPathFor(route, distPath), "utf-8");
      results.push(validateSnapshotHtml(html, route));
    } catch (error) {
      results.push({
        route,
        issues: [`snapshot is missing or unreadable: ${error instanceof Error ? error.message : String(error)}`],
      });
    }
  }
  return results;
}

import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { writeSnapshot } from "./prerender-paths.js";
import { validatePrerenderSnapshots, validateSnapshotHtml } from "./prerender-validation.js";

function snapshot(route: string, options: { canonical?: string; schema?: boolean } = {}): string {
  const canonical = options.canonical ?? `https://acetoursvanuatu.com${route}`;
  const schema = options.schema
    ? '<script type="application/ld+json">{"@context":"https://schema.org","@type":"BlogPosting"}</script>'
    : "";
  return `<!doctype html><html><head><title>Unique page title</title><link rel="canonical" href="${canonical}">${schema}</head><body><h1>Unique page heading</h1></body></html>`;
}

describe("validateSnapshotHtml", () => {
  it("accepts a route-specific article snapshot", () => {
    expect(validateSnapshotHtml(snapshot("/blog/guide", { schema: true }), "/blog/guide").issues).toEqual([]);
  });

  it("rejects a homepage snapshot captured for an article route", () => {
    const result = validateSnapshotHtml(snapshot("/", { canonical: "https://acetoursvanuatu.com/" }), "/blog/guide");
    expect(result.issues).toContain("canonical path is /, expected /blog/guide");
    expect(result.issues).toContain("missing BlogPosting or Article JSON-LD");
  });
});

describe("validatePrerenderSnapshots", () => {
  it("checks every sitemap route and reports missing or invalid snapshots", async () => {
    const dist = await mkdtemp(path.join(os.tmpdir(), "prerender-validation-"));
    try {
      await writeSnapshot(snapshot("/"), "/", dist);
      await writeSnapshot(snapshot("/blog/guide", { canonical: "https://acetoursvanuatu.com/" }), "/blog/guide", dist);

      const results = await validatePrerenderSnapshots(["/", "/blog/guide", "/missing"], dist);
      expect(results).toHaveLength(3);
      expect(results[0].issues).toEqual([]);
      expect(results[1].issues).toContain("canonical path is /, expected /blog/guide");
      expect(results[2].issues[0]).toMatch(/snapshot is missing or unreadable/);
    } finally {
      await rm(dist, { recursive: true, force: true });
    }
  });
});

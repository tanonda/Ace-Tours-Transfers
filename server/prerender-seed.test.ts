import { describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { seedSnapshotsFromPreviousDeploy } from "./prerender-seed.js";

const SOURCE = "https://acetoursvanuatu.com";

const shell = `<html><head><script type="module" crossorigin src="/assets/index-NEW.js"></script>
<link rel="stylesheet" crossorigin href="/assets/index-NEW.css"></head><body><div id="root"></div></body></html>`;

const snapshot = (route: string, h1 = "Real content") => `<html><head><title>Page | Ace</title>
<script type="module" crossorigin src="/assets/index-OLD.js"></script>
<link rel="stylesheet" crossorigin href="/assets/index-OLD.css">
<link rel="canonical" href="${SOURCE}${route}"></head><body><div id="root"><h1>${h1}</h1></div></body></html>`;

const sitemap = `<urlset>
  <url><loc>${SOURCE}/</loc></url>
  <url><loc>${SOURCE}/tours</loc></url>
  <url><loc>${SOURCE}/transfers</loc></url>
</urlset>`;

async function setup(pages: Record<string, { status: number; body: string }>) {
  const dist = await mkdtemp(path.join(os.tmpdir(), "seed-"));
  await writeFile(path.join(dist, "spa-shell.html"), shell);
  const fetchImpl = vi.fn(async (url: string | URL) => {
    const route = new URL(url.toString()).pathname;
    const page = route === "/sitemap.xml" ? { status: 200, body: sitemap } : pages[route] ?? { status: 404, body: "" };
    return new Response(page.body, { status: page.status });
  });
  return { dist, fetchImpl: fetchImpl as unknown as typeof fetch };
}

describe("seedSnapshotsFromPreviousDeploy", () => {
  it("copies valid snapshots from the live site, re-pointed at the new build's assets", async () => {
    const { dist, fetchImpl } = await setup({
      "/": { status: 200, body: snapshot("/") },
      "/tours": { status: 200, body: shell }, // previous deploy was itself only serving the shell
      // /transfers → 404
    });

    const result = await seedSnapshotsFromPreviousDeploy({ sourceUrl: SOURCE, distPath: dist, fetchImpl });

    expect(result.seeded).toEqual(["/"]);
    expect(result.skipped.map((s) => s.route).sort()).toEqual(["/tours", "/transfers"]);

    const home = await readFile(path.join(dist, "index.html"), "utf8");
    expect(home).toContain("<h1>Real content</h1>");
    expect(home).toContain("/assets/index-NEW.js");
    expect(home).not.toContain("-OLD.");
    expect(existsSync(path.join(dist, "tours", "index.html"))).toBe(false);
  });

  it("gives up quietly when the previous deploy is unreachable", async () => {
    const dist = await mkdtemp(path.join(os.tmpdir(), "seed-"));
    await writeFile(path.join(dist, "spa-shell.html"), shell);
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;

    const result = await seedSnapshotsFromPreviousDeploy({ sourceUrl: SOURCE, distPath: dist, fetchImpl });

    expect(result.seeded).toEqual([]);
    expect(result.skipped[0].reason).toMatch(/sitemap/i);
  });

  it("does nothing without a built app shell to take asset tags from", async () => {
    const dist = await mkdtemp(path.join(os.tmpdir(), "seed-"));
    const fetchImpl = vi.fn() as unknown as typeof fetch;

    const result = await seedSnapshotsFromPreviousDeploy({ sourceUrl: SOURCE, distPath: dist, fetchImpl });

    expect(result.seeded).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

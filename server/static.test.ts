import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import path from "node:path";
import os from "node:os";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { registerPrerenderStatusRoute, serveStatic } from "./static.js";
import { markPageNotFound } from "./spa-routes.js";

// Integration test for the prerender-aware static server: it must serve a
// prerendered snapshot for matching page routes, serve real static files
// (assets, robots.txt) as-is, never 301-redirect a no-trailing-slash URL,
// and fall back to the SPA shell for everything else — with a 404 status when
// the app has no such page.
describe("serveStatic (prerender-aware)", () => {
  let dist: string;
  let app: express.Express;

  beforeAll(async () => {
    dist = await mkdtemp(path.join(os.tmpdir(), "static-test-"));

    // SPA shell (fallback) — distinct marker so we can tell it apart from snapshots.
    await writeFile(path.join(dist, "index.html"), "<!doctype html><html><body><div id=\"root\"></div><!--SPA_SHELL--></body></html>");

    // A prerendered detail-page snapshot with unique content.
    await mkdir(path.join(dist, "tours", "abc-123"), { recursive: true });
    await writeFile(
      path.join(dist, "tours", "abc-123", "index.html"),
      "<!doctype html><html><head><title>Blue Lagoon Tour</title></head><body>SNAPSHOT_TOUR</body></html>",
    );

    // A snapshot left over from a product that has since been deleted.
    await mkdir(path.join(dist, "tours", "deleted-tour"), { recursive: true });
    await writeFile(path.join(dist, "tours", "deleted-tour", "index.html"), "STALE_SNAPSHOT");

    // A real static asset and robots.txt.
    await mkdir(path.join(dist, "assets"), { recursive: true });
    await writeFile(path.join(dist, "assets", "app-abc.js"), "console.log('asset');");
    await writeFile(path.join(dist, "robots.txt"), "User-agent: *\nAllow: /\n");
    await writeFile(
      path.join(dist, ".prerender-manifest.json"),
      JSON.stringify({
        expectedRoutes: ["/", "/tours/abc-123"],
        writtenRoutes: ["/", "/tours/abc-123"],
        environment: { hostCpus: 8, hostMemoryMb: 31387, containerAtEnd: { cpuQuotaCores: 0.15 } },
        timings: [{ route: "/", method: "boot", readyMs: 30000, containerMemoryMb: 512 }],
      }),
    );

    app = express();
    registerPrerenderStatusRoute(app, dist);
    app.all("/api/*any", (_req, res) => res.status(404).json({ error: "API route not found" }));
    // Stand-in for the detail-route lookup in seo.routes.ts: this product is gone.
    app.get("/tours/deleted-tour", (_req, res, next) => {
      markPageNotFound(res);
      next();
    });
    serveStatic(app, dist);
  });

  afterAll(async () => {
    await rm(dist, { recursive: true, force: true });
  });

  it("serves the prerendered snapshot for a matching page route (200, unique content, no 301)", async () => {
    const res = await request(app).get("/tours/abc-123");
    expect(res.status).toBe(200);
    expect(res.text).toContain("SNAPSHOT_TOUR");
    expect(res.text).toContain("<title>Blue Lagoon Tour</title>");
    expect(res.text).not.toContain("SPA_SHELL");
  });

  it("does NOT 301-redirect a no-trailing-slash directory route", async () => {
    const res = await request(app).get("/tours/abc-123");
    expect(res.status).not.toBe(301);
  });

  it("serves a real hashed asset as a static file", async () => {
    const res = await request(app).get("/assets/app-abc.js");
    expect(res.status).toBe(200);
    expect(res.text).toContain("console.log('asset')");
  });

  it("serves robots.txt as a real static file", async () => {
    const res = await request(app).get("/robots.txt");
    expect(res.status).toBe(200);
    expect(res.text).toContain("User-agent: *");
  });

  it("serves the SPA shell with 200 for an app route that has no snapshot", async () => {
    for (const route of ["/checkout", "/admin/bookings", "/tours/new-tour-not-yet-prerendered", "/faq/"]) {
      const res = await request(app).get(route);
      expect(res.status, route).toBe(200);
      expect(res.text).toContain("SPA_SHELL");
    }
  });

  it("serves the SPA shell with 404 for a path the app doesn't route (no soft 404)", async () => {
    for (const route of ["/some/unknown/path", "/login", "/admin", "/tours/a/b"]) {
      const res = await request(app).get(route);
      expect(res.status, route).toBe(404);
      expect(res.text).toContain("SPA_SHELL");
    }
  });

  it("answers 404 for a missing product even when a stale snapshot exists", async () => {
    const res = await request(app).get("/tours/deleted-tour");
    expect(res.status).toBe(404);
    expect(res.text).not.toContain("STALE_SNAPSHOT");
    expect(res.text).toContain("SPA_SHELL");
  });

  it("serves the home route (200 with app shell content)", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("root");
  });

  it("serves non-cacheable prerender diagnostics before the API catch-all", async () => {
    const res = await request(app).get("/api/seo/prerender-status");

    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body.status).toBe("ok");
    expect(res.body.snapshots.htmlFiles).toBe(3);
    expect(res.body.manifest.writtenRoutes).toEqual(["/", "/tours/abc-123"]);
    expect(res.body).not.toHaveProperty("distPath");
  });

  it("keeps container and timing diagnostics out of the public status response", async () => {
    const res = await request(app).get("/api/seo/prerender-status");

    expect(res.body.manifest.writtenRoutes).toEqual(["/", "/tours/abc-123"]);
    expect(res.body.manifest).not.toHaveProperty("environment");
    expect(res.body.manifest).not.toHaveProperty("timings");
    expect(JSON.stringify(res.body)).not.toMatch(/cpuQuota|hostMemory|containerMemory/);
  });
});

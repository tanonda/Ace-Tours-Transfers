import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import path from "node:path";
import os from "node:os";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { serveStatic } from "./static";

// Integration test for the prerender-aware static server: it must serve a
// prerendered snapshot for matching page routes, serve real static files
// (assets, robots.txt) as-is, never 301-redirect a no-trailing-slash URL,
// and fall back to the SPA shell for everything else.
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

    // A real static asset and robots.txt.
    await mkdir(path.join(dist, "assets"), { recursive: true });
    await writeFile(path.join(dist, "assets", "app-abc.js"), "console.log('asset');");
    await writeFile(path.join(dist, "robots.txt"), "User-agent: *\nAllow: /\n");

    app = express();
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

  it("falls back to the SPA shell for an unknown route (no snapshot)", async () => {
    const res = await request(app).get("/some/unknown/path");
    expect(res.status).toBe(200);
    expect(res.text).toContain("SPA_SHELL");
  });

  it("serves the home route (200 with app shell content)", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("root");
  });
});

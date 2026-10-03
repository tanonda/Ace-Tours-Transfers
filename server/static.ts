import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { hasPrerenderBypass, prerenderFileFor, SPA_SHELL_FILE } from "./prerender-paths.js";

let prerenderHits = 0;
let prerenderMisses = 0;

function countHtmlSnapshots(dir: string): { count: number; newestMtimeMs: number | null } {
  let count = 0;
  let newestMtimeMs: number | null = null;

  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "assets") continue;
        walk(full);
        continue;
      }
      if (entry.isFile() && entry.name === "index.html") {
        count++;
        const mtimeMs = fs.statSync(full).mtimeMs;
        newestMtimeMs = newestMtimeMs === null ? mtimeMs : Math.max(newestMtimeMs, mtimeMs);
      }
    }
  };

  walk(dir);
  return { count, newestMtimeMs };
}

export function registerPrerenderStatusRoute(
  app: Express,
  distPath: string = path.resolve(__dirname, "public"),
) {
  app.get("/api/seo/prerender-status", (_req, res) => {
    const manifestPath = path.join(distPath, ".prerender-manifest.json");
    const snapshotStats = countHtmlSnapshots(distPath);
    let manifest: unknown = null;
    if (fs.existsSync(manifestPath)) {
      try {
        // Per-route timings and container resource stats are for the server logs
        // only; this endpoint is public, so don't advertise infrastructure details.
        const { environment: _environment, timings: _timings, ...publicManifest } = JSON.parse(
          fs.readFileSync(manifestPath, "utf-8"),
        );
        manifest = publicManifest;
      } catch (error) {
        manifest = {
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    res.setHeader("Cache-Control", "no-store");
    res.json({
      status: manifest ? "ok" : "missing-manifest",
      snapshots: {
        htmlFiles: snapshotStats.count,
        newest: snapshotStats.newestMtimeMs ? new Date(snapshotStats.newestMtimeMs).toISOString() : null,
      },
      requestsSinceBoot: {
        prerenderHits,
        prerenderMisses,
      },
      manifest,
    });
  });
}

export function serveStatic(app: Express, distPath: string = path.resolve(__dirname, "public")) {
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
  // The prerenderer's own browser bypasses snapshots so it always renders fresh.
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (hasPrerenderBypass(req.headers.cookie)) return next();
    const snapshot = prerenderFileFor(req.path, distPath);
    if (snapshot && fs.existsSync(snapshot)) {
      prerenderHits++;
      return res.sendFile(snapshot);
    }
    if (snapshot) prerenderMisses++;
    next();
  });

  // SPA fallback: the pristine app shell. index.html holds the homepage snapshot
  // once prerendered, so it is only used if the build predates spa-shell.html.
  const shellFile = path.resolve(distPath, SPA_SHELL_FILE);
  app.use((_req, res) => {
    res.sendFile(fs.existsSync(shellFile) ? shellFile : path.resolve(distPath, "index.html"));
  });
}

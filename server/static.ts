import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { prerenderFileFor } from "./prerender-paths.js";

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

export function serveStatic(app: Express, distPath: string = path.resolve(__dirname, "public")) {
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  let prerenderHits = 0;
  let prerenderMisses = 0;

  // Serve real files (hashed assets, robots.txt, etc.) but never auto-index a
  // directory or 301-redirect to a trailing slash — we control HTML responses
  // ourselves below so canonical (no-trailing-slash) URLs stay intact.
  app.use(express.static(distPath, { index: false, redirect: false }));

  app.get("/api/seo/prerender-status", (_req, res) => {
    const manifestPath = path.join(distPath, ".prerender-manifest.json");
    const snapshotStats = countHtmlSnapshots(distPath);
    let manifest: unknown = null;
    if (fs.existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      } catch (error) {
        manifest = {
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    res.json({
      status: manifest ? "ok" : "missing-manifest",
      distPath,
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

  // Serve a prerendered HTML snapshot for matching GET routes, if one exists.
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const snapshot = prerenderFileFor(req.path, distPath);
    if (snapshot && fs.existsSync(snapshot)) {
      prerenderHits++;
      return res.sendFile(snapshot);
    }
    if (snapshot) prerenderMisses++;
    next();
  });

  // SPA fallback: serve the app shell (or prerendered home) for anything else.
  app.use((_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { prerenderFileFor } from "./prerender-paths.js";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
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
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const snapshot = prerenderFileFor(req.path, distPath);
    if (snapshot && fs.existsSync(snapshot)) {
      return res.sendFile(snapshot);
    }
    next();
  });

  // SPA fallback: serve the app shell (or prerendered home) for anything else.
  app.use((_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

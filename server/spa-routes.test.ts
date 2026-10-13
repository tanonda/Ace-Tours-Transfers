import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { isSpaRoute } from "./spa-routes.js";

// The server decides 200 vs 404 from its own copy of the client's route table.
// If a page is added to App.tsx without updating spa-routes.ts, it would be
// served with a 404 and dropped from Google — this test catches that.
const appTsx = fs.readFileSync(path.resolve(__dirname, "../client/src/App.tsx"), "utf-8");
const siteRoutes = appTsx.slice(appTsx.indexOf("const SITE_ROUTES"), appTsx.indexOf("<Route component={NotFound}"));
const clientPaths = [...siteRoutes.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);

describe("isSpaRoute", () => {
  it("found the client route table", () => {
    expect(clientPaths.length).toBeGreaterThan(40);
  });

  it("recognises every route in App.tsx", () => {
    const missing = clientPaths
      .map((p) => p.replace(/:[^/]+/g, "some-slug"))
      .filter((p) => !isSpaRoute(p));
    expect(missing).toEqual([]);
  });

  it("rejects paths the app doesn't route", () => {
    for (const p of ["/login", "/admin", "/admin/nope", "/tours/a/b", "/vehicle-hire", "/blog/x/y"]) {
      expect(isSpaRoute(p), p).toBe(false);
    }
  });

  it("ignores a trailing slash", () => {
    expect(isSpaRoute("/faq/")).toBe(true);
    expect(isSpaRoute("/")).toBe(true);
  });
});

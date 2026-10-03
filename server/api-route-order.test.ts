import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("API route registration order", () => {
  it("registers the public article routes before the API catch-all", () => {
    const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
    const content = read("./routes/content.routes.ts");
    const publicArticles = content.indexOf('app.get("/api/articles"');
    const articleBySlug = content.indexOf('app.get("/api/articles/:slug"');

    expect(publicArticles).toBeGreaterThan(-1);
    expect(articleBySlug).toBeGreaterThan(publicArticles);

    const routes = read("./routes.ts");
    const contentRegistered = routes.indexOf("registerContentRoutes(app);");
    const catchAll = routes.indexOf('app.all("/api/*any"');

    expect(contentRegistered).toBeGreaterThan(-1);
    expect(catchAll).toBeGreaterThan(contentRegistered);
  });

  it("registers every route module before the API catch-all", () => {
    const routes = readFileSync(fileURLToPath(new URL("./routes.ts", import.meta.url)), "utf8");
    const catchAll = routes.indexOf('app.all("/api/*any"');
    const calls = [...routes.matchAll(/^\s+(?:await )?register\w+Routes\(app\b/gm)];

    expect(calls.length).toBeGreaterThanOrEqual(12);
    for (const call of calls) expect(call.index!).toBeLessThan(catchAll);
  });

  it("registers prerender diagnostics before the API catch-all is installed", () => {
    const indexPath = fileURLToPath(new URL("./index.ts", import.meta.url));
    const source = readFileSync(indexPath, "utf8");
    const prerenderStatus = source.indexOf("registerPrerenderStatusRoute(app)");
    const registerApiRoutes = source.indexOf("await registerRoutes(httpServer, app)");

    expect(prerenderStatus).toBeGreaterThan(-1);
    expect(registerApiRoutes).toBeGreaterThan(prerenderStatus);
  });
});

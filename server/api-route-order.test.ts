import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("API route registration order", () => {
  it("registers the public article routes before the API catch-all", () => {
    const routesPath = fileURLToPath(new URL("./routes.ts", import.meta.url));
    const source = readFileSync(routesPath, "utf8");
    const publicArticles = source.indexOf('app.get("/api/articles"');
    const articleBySlug = source.indexOf('app.get("/api/articles/:slug"');
    const catchAll = source.indexOf('app.all("/api/*any"');

    expect(publicArticles).toBeGreaterThan(-1);
    expect(articleBySlug).toBeGreaterThan(publicArticles);
    expect(catchAll).toBeGreaterThan(articleBySlug);
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

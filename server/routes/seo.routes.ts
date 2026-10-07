import type { Express } from "express";
import { storage } from "../storage.js";
import { publishedArticleSitemapEntries } from "../lib/article-sitemap.js";
import { productPath } from "../../shared/product-path.js";

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Keep in sync with client/src/lib/landing-pages.ts (LANDING_SLUGS).
const SEO_LANDING_SLUGS = [
  "port-vila-airport-transfers",
  "efate-island-day-tours",
  "blue-lagoon-vanuatu-tour",
  "mele-cascades-tour",
  "vanuatu-cultural-tours",
  "port-vila-private-transfers",
];

let lastGoodSitemapXml: string | null = null;

/**
 * robots.txt served from an in-memory constant via an explicit always-200 route
 * (see below). Kept in sync with client/public/robots.txt. Serving it from code —
 * with no DB or async work — guarantees crawlers never get a 5xx for /robots.txt
 * during a deploy/restart window. A 5xx on robots.txt makes Google cache
 * "disallow everything" for up to 24h, which previously blocked the whole site.
 */
function buildRobotsTxt(): string {
  const siteUrl = (process.env.APP_URL || "https://acetoursvanuatu.com").replace(/\/$/, "");
  return [
    "User-agent: *",
    "Allow: /",
    "",
    "# Block admin panel from indexing",
    "Disallow: /admin/",
    "Disallow: /api/",
    "",
    "# Block checkout flow from indexing",
    "Disallow: /cart",
    "Disallow: /payment",
    "Disallow: /confirmation",
    "",
    `Sitemap: ${siteUrl}/sitemap.xml`,
    "",
  ].join("\n");
}

export function registerSeoRoutes(app: Express) {
  // ── Vehicle hire retirement (Vanuatu FIU compliance) ─────────────────────
  // /vehicles and /vehicles/:id are permanently retired. 301 to /transfers
  // so any inbound link or bookmark lands on the closest equivalent offering.
  app.get("/vehicles", (_req, res) => res.redirect(301, "/transfers"));
  app.get("/vehicles/:id", (_req, res) => res.redirect(301, "/transfers"));

  // ── Product URLs ──────────────────────────────────────────────────────────
  // Detail pages live at /tours/<slug> and /transfers/<slug>. Old /tours/<uuid>
  // links (and a product under the wrong section) get a permanent redirect so
  // Google moves their ranking to the slug URL. Unknown keys fall through to the app.
  app.get(["/tours/:key", "/transfers/:key"], async (req, res, next) => {
    try {
      const product = await storage.getProduct(String(req.params.key));
      if (!product) return next();
      const target = productPath(product);
      if (target === req.path) return next();
      const queryAt = req.originalUrl.indexOf("?");
      res.redirect(301, queryAt === -1 ? target : target + req.originalUrl.slice(queryAt));
    } catch {
      next();
    }
  });

  // ── SEO: Sitemap ──────────────────────────────────────────────────────────
  // Always-200 robots.txt, served from an in-memory string with no DB/async work
  // so a deploy/restart window can never return a 5xx here (which Google caches as
  // "block everything"). Registered before the static middleware so it wins, and
  // before /sitemap.xml to keep the SEO routes together.
  app.get("/robots.txt", (_req, res) => {
    res.header("Content-Type", "text/plain; charset=utf-8");
    res.header("Cache-Control", "public, max-age=3600");
    res.send(buildRobotsTxt());
  });

  app.get("/sitemap.xml", async (_req, res) => {
    try {
      const SITE_URL = (process.env.APP_URL || "https://acetoursvanuatu.com").replace(/\/$/, "");
      const products = await storage.getProducts();
      const now = new Date().toISOString().split("T")[0];
      // Only claim a static page changed when the deploy pipeline provides an
      // accurate date. A fresh lastmod on every request is misleading to crawlers.
      const staticLastmod = process.env.SITEMAP_STATIC_LASTMOD?.match(/^\d{4}-\d{2}-\d{2}$/)?.[0];

      const staticPages = [
        { loc: "/",          priority: "1.0", changefreq: "weekly",  lastmod: staticLastmod },
        { loc: "/tours",     priority: "0.9", changefreq: "daily",   lastmod: staticLastmod },
        { loc: "/transfers", priority: "0.9", changefreq: "daily",   lastmod: staticLastmod },
        { loc: "/faq",       priority: "0.7", changefreq: "monthly", lastmod: staticLastmod },
        { loc: "/about",     priority: "0.6", changefreq: "monthly", lastmod: staticLastmod },
        { loc: "/contact",   priority: "0.6", changefreq: "monthly", lastmod: staticLastmod },
        { loc: "/blog",      priority: "0.7", changefreq: "weekly",  lastmod: staticLastmod },
      ];

      for (const slug of SEO_LANDING_SLUGS) {
        staticPages.push({ loc: `/${slug}`, priority: "0.8", changefreq: "monthly", lastmod: staticLastmod });
      }

      const productPages = products
        .filter((p: any) => p.isActive !== false && p.category !== "vehicle")
        .map((p: any) => {
          // Use the product's own updatedAt so Googlebot knows when content last changed
          const lastmod = p.updatedAt
            ? new Date(p.updatedAt).toISOString().split("T")[0]
            : now;
          return { loc: productPath(p), priority: "0.8", changefreq: "weekly", lastmod };
        });

      const articleRows = await storage.getAllArticles();
      const articlePages = publishedArticleSitemapEntries(articleRows as any, now);

      const allPages = [...staticPages, ...productPages, ...articlePages];

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map(p => `  <url>
    <loc>${escapeXml(SITE_URL)}${escapeXml(p.loc)}</loc>
${p.lastmod ? `    <lastmod>${escapeXml(p.lastmod)}</lastmod>\n` : ""}    <changefreq>${escapeXml(p.changefreq)}</changefreq>
    <priority>${escapeXml(p.priority)}</priority>
  </url>`).join("\n")}
</urlset>`;

      res.header("Content-Type", "application/xml");
      res.header("Cache-Control", "public, max-age=3600");
      lastGoodSitemapXml = xml;
      res.send(xml);
    } catch (error) {
      console.error("[SEO] sitemap generation failed:", error);
      if (lastGoodSitemapXml) {
        res.header("Content-Type", "application/xml");
        res.header("Cache-Control", "public, max-age=300");
        res.header("X-Sitemap-Stale", "1");
        res.send(lastGoodSitemapXml);
        return;
      }
      res.status(500).send("<!-- sitemap generation failed: no cached sitemap available -->");
    }
  });

}

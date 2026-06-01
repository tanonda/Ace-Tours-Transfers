# Cloudflare Worker — edge-served robots.txt (+ resilient sitemap)

## Why

The site is behind Cloudflare (`server: cloudflare`), and the origin (Render) cold-starts
after idle — the first request can take ~14s or briefly fail. During that window,
crawlers hitting `/robots.txt` can get a timeout or a blocking fallback, and **Google
caches a failed/blocking robots.txt as "disallow everything" for ~24h**, which blocks the
whole site from indexing.

A Cloudflare **Worker** runs at the edge — it responds even when the Render origin is
asleep or erroring. Serving `robots.txt` from the Worker guarantees crawlers always get a
correct, permissive robots file with a 200, independent of origin state. For `sitemap.xml`
(which is generated from the live database and must stay current) the Worker fetches the
origin but degrades gracefully on failure.

This robots body is byte-identical to what `server/routes.ts` serves today (kept in sync).

## The Worker

In the Cloudflare dashboard: **Workers & Pages → Create → Worker** (name e.g.
`acetours-seo-edge`), paste this, then **Deploy**:

```js
// Edge-served SEO files for acetoursvanuatu.com.
// robots.txt is served entirely at the edge (never depends on origin uptime).
// sitemap.xml is proxied from origin with a short cache so a cold origin still serves it.

const ROBOTS_TXT = `User-agent: *
Allow: /

# Block admin panel from indexing
Disallow: /admin/
Disallow: /api/

# Block checkout flow from indexing
Disallow: /cart
Disallow: /payment
Disallow: /confirmation

Sitemap: https://acetoursvanuatu.com/sitemap.xml
`;

export default {
  async fetch(request, ctx) {
    const url = new URL(request.url);

    // 1. robots.txt — always served from the edge, always 200, never touches origin.
    if (url.pathname === "/robots.txt") {
      return new Response(ROBOTS_TXT, {
        status: 200,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          // Edge-cache 1h; crawlers get an instant correct file.
          "cache-control": "public, max-age=3600",
        },
      });
    }

    // 2. sitemap.xml — proxy from origin, but serve Cloudflare's cached copy if the
    //    origin is cold/erroring so crawlers never get a timeout or 5xx.
    if (url.pathname === "/sitemap.xml") {
      const cache = caches.default;
      const cacheKey = new Request(url.toString(), request);
      try {
        const originResp = await fetch(request, {
          // give a cold Render origin time to wake, but cap it
          cf: { cacheTtl: 3600, cacheEverything: true },
        });
        if (originResp.ok) {
          // refresh the edge cache copy
          ctx.waitUntil(cache.put(cacheKey, originResp.clone()));
          return originResp;
        }
        // origin returned non-2xx — fall back to last good cached copy
        const cached = await cache.match(cacheKey);
        return cached || originResp;
      } catch (_e) {
        // origin unreachable (cold start / timeout) — serve last good cached copy
        const cached = await cache.match(cacheKey);
        if (cached) return cached;
        // nothing cached yet — return a minimal valid (empty) sitemap, never a 5xx
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`,
          { status: 200, headers: { "content-type": "application/xml; charset=utf-8" } },
        );
      }
    }

    // 3. Everything else → pass straight through to origin unchanged.
    return fetch(request);
  },
};
```

## Wire it to the two routes

A Worker only runs on the paths you bind it to. Add **Routes** so it intercepts just the
SEO files (everything else flows normally to Render):

**Workers & Pages → your Worker → Settings → Domains & Routes → Add route**, create:

```
acetoursvanuatu.com/robots.txt
acetoursvanuatu.com/sitemap.xml
www.acetoursvanuatu.com/robots.txt
www.acetoursvanuatu.com/sitemap.xml
```

(Zone: `acetoursvanuatu.com`. The `www` routes are optional but harmless — they keep
robots correct even if a crawler hits the www host before the 301.)

## Verify after deploy

```bash
# robots must be 200 + permissive, served by the Worker even if origin is cold
curl -sS https://acetoursvanuatu.com/robots.txt
# header check — Worker responses still show server: cloudflare
curl -sS -D - -o /dev/null https://acetoursvanuatu.com/robots.txt

# sitemap still returns the live 27-URL list when origin is warm
curl -sS https://acetoursvanuatu.com/sitemap.xml | grep -c "<loc>"
```

Expected: robots.txt returns the permissive body with HTTP 200 instantly (no ~14s cold
delay); sitemap returns the full URL list (or, if the origin was cold, the last cached
copy — never a timeout).

## After it's live — clear the stale block in GSC

1. Google Search Console → **Settings → robots.txt report → Request a recrawl** (forces
   Google to re-read the now-always-correct robots.txt).
2. Once the report shows the permissive version, **Sitemaps → submit
   `https://acetoursvanuatu.com/sitemap.xml`** again.
3. Use **URL Inspection → Test Live URL** on a key page; it should no longer say
   "Blocked by robots.txt".

## Keeping it in sync

If `client/public/robots.txt` / `server/routes.ts` `buildRobotsTxt()` ever changes, update
the `ROBOTS_TXT` constant in this Worker to match. They are byte-identical as of
2026-06-02.

## Note: the origin route still stays
The `app.get("/robots.txt")` route in `server/routes.ts` remains as defence-in-depth (it
serves correctly whenever the origin is reached directly or the Worker is ever removed).
The Worker is the primary, always-up layer.
```

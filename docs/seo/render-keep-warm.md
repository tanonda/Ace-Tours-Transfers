# Keep the Render service warm (fixes the robots.txt / SEO cold-start block)

## Background — what's actually going on

Audited 2026-06-02:

- The domain is **not** on a Cloudflare account you control. DNS A-records point to
  `216.24.57.7 / .251` (**Render's** IP range) and nameservers are `ns1/ns2.dns-parking.com`
  (**Hostinger**, the registrar). The `server: cloudflare` response header comes from
  **Render's own internal edge**, not a Cloudflare zone you can configure. So there is no
  Cloudflare Worker/dashboard available for this site.
- Root cause of the intermittent "Blocked by robots.txt" in Google Search Console:
  Render **spins the container down after ~15 min idle** (free/starter tier). The first
  request then cold-starts (~14s observed), and during that window Render's edge can serve
  a timeout or a blocking fallback for `/robots.txt`. **Google caches a failed/blocking
  robots.txt as "disallow everything" for ~24h**, blocking the whole site from indexing.
- When the container is warm, everything is correct: `/robots.txt` returns the permissive
  always-200 body (from `server/routes.ts`), `/sitemap.xml` returns the live 27-URL list.

The fix is to **never let it go cold**. Two options.

## Option A (recommended, free): external uptime ping

Use a free uptime monitor to hit the site every ~10 minutes so it never idles down.

**Target URL:** `https://acetoursvanuatu.com/robots.txt`
(Prefer `/robots.txt` over `/api/health`: it exercises the exact SEO path, returns a fast
always-200 response, and does **not** run a DB query on every ping the way `/api/health`
does.)

**Using UptimeRobot (https://uptimerobot.com — free tier):**
1. Sign up / log in.
2. **+ New monitor** → Monitor type: **HTTP(s)**.
3. URL: `https://acetoursvanuatu.com/robots.txt`
4. Monitoring interval: **5 minutes** (free tier minimum; well under Render's 15-min idle).
5. (Optional) Keyword monitor: alert if the response does **not** contain `Allow: /` —
   this also warns you if the blocking robots ever reappears.
6. Create. Done — it now pings 24/7 and keeps Render warm.

**Or cron-job.org (https://cron-job.org — free):**
1. Create a cronjob → URL `https://acetoursvanuatu.com/robots.txt` → schedule **every 10
   minutes** → save.

**Or, if you already run any scheduler**, just GET that URL every 10 minutes.

## Option B (most robust, paid): Render always-on instance

Render Dashboard → your `ace-tours` service → **Settings → Instance Type** → choose a paid
plan (Starter+ that doesn't spin down / "always on"). This removes idle spin-down entirely,
so there is no cold-start window at all. Costs money; Option A achieves ~the same SEO
result for free.

## Defence-in-depth already shipped
- `server/routes.ts` serves `/robots.txt` from an in-memory constant via an always-200
  route (commit f8d4db3) — correct whenever the origin is reached.
- Keeping the container warm (Option A/B) ensures the origin is *always* reached, closing
  the cold-start gap that Render's edge fallback was filling with a block.

## After enabling keep-warm — clear the stale block in GSC
1. Wait ~20–30 min for a couple of keep-warm pings so the service is reliably warm.
2. Verify: `curl -sS https://acetoursvanuatu.com/robots.txt` → permissive body, instant.
3. Google Search Console → **Settings → robots.txt report → Request a recrawl**.
4. Once it shows the permissive version, **Sitemaps → resubmit
   `https://acetoursvanuatu.com/sitemap.xml`**, then **URL Inspection → Test Live URL** on
   a key page to confirm it's no longer "Blocked by robots.txt".

## Monitoring going forward
The UptimeRobot keyword check (step 5) doubles as an SEO alarm: if `/robots.txt` ever stops
containing `Allow: /`, you get notified before Google re-caches a block.

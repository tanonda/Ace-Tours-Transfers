# Phase 6 — Measurement & Backlinks (the ongoing long game)

**Status:** off-code, ongoing. Phases 1–5 built the *machine* (crawlable site, landing
pages, content engine). Phase 6 is the *fuel*: authority (backlinks/citations) + a
measurement loop to see what's working. This is a playbook the owner/marketer executes
over weeks–months, not a one-off task.

---

## Canonical business details (use these EXACTLY everywhere — NAP consistency)

Local SEO rewards identical Name/Address/Phone (+ email/site) across every listing.
Source of truth = the site's structured data (`client/src/components/seo.tsx`):

- **Name:** Ace Tours & Transfers Vanuatu
- **Phone:** +678 711 4045  (write consistently — pick one format, e.g. `+678 7114045`, and reuse)
- **Email:** acetoursvanuatu@outlook.com
- **Address:** Kumul Highway, Port Vila, Efate, Vanuatu
- **Website:** https://acetoursvanuatu.com
- **Hours:** Mon–Sat 07:00–18:00 (match GBP to this, or update both together)

⚠️ Any directory where these differ *dilutes* ranking signals. Audit and fix mismatches
first — that's higher ROI than new links.

---

## Part A — Backlinks & citations (authority)

Backlinks from relevant, reputable sites are the #1 off-page ranking factor. For a Vanuatu
tour operator, **tourism directories + OTAs** are the highest-value, most attainable.

### A1. Claim/optimize what already exists (do FIRST — fastest wins)
The footer already references these — make sure each is **claimed, accurate, and complete**:

| Listing | Existing reference | Action |
|---|---|---|
| **TripAdvisor** | `tripadvisor.com/...d13824040-Reviews-Ace_Tours_Transfers` | Claim the listing (Management Centre), complete profile, add photos, **link to acetoursvanuatu.com**, respond to all reviews. |
| **Viator** | `viator.com/Vanuatu-tours/Airport-and-Hotel-Transfers/d4474-g15` | Confirm products are listed & bookable; ensure the operator profile links to the site. (Viator is TripAdvisor-owned — they reinforce each other.) |
| **Vanuatu Tourism Office (VTO)** | `vanuatu.travel` (in footer backlinks) | Ensure a full operator listing exists at vanuatu.travel with website link — highest-authority *local* backlink available. |

### A2. High-value new citations (priority order)
1. **Google Business Profile** — see `docs/seo/phase3-google-business-profile.md`. The single
   biggest local-SEO lever. Confirm it's created, verified, and NAP-consistent.
2. **Bing Places for Business** (bingplaces.com) — free; can import from GBP. Covers Bing/DuckDuckGo.
3. **GetYourGuide** — supplier listing (getyourguide.com) — major OTA, strong referral + link.
4. **Local/regional directories:**
   - Yellow Pages Vanuatu / any Vanuatu business directory
   - "Things to do in Port Vila" / Efate roundup articles (reach out to be included)
   - Cruise-port excursion directories (Port Vila is a cruise stop — high-intent)
5. **Social profiles** (link back to site, keep NAP consistent): Facebook
   (facebook.com/acetoursvanuatu), Instagram (instagram.com/acetoursvanuatu) — already in
   the site's `sameAs` schema; ensure both have the website + contact filled in.

### A3. Earned links (slower, higher quality — ongoing)
- **Partnerships:** resorts/hotels you transfer for → ask for a "getting here / transfers"
  link to your airport-transfers landing page (`/port-vila-airport-transfers`).
- **Guest content / mentions:** Vanuatu travel bloggers, "X days in Vanuatu" itinerary posts.
- **Your own blog (Phase 5):** publish genuinely useful guides → others cite them. Content
  is what *attracts* links over time. (Client to author articles in `/admin/blog`.)

### A4. Internal links (free, already partly done)
- ✅ Blog now linked in header/mobile/footer (Phase 5 follow-up).
- Landing pages link to product pages; articles link to related tours.
- TODO when articles exist: link key articles ↔ relevant landing pages
  (e.g. a "Blue Lagoon guide" article ↔ `/blue-lagoon-vanuatu-tour`).

---

## Part B — Measurement loop (know what's working)

You can't improve what you don't measure. Set up once, then a light weekly check.

### B1. One-time setup
- **Google Search Console** (done — property `acetoursvanuatu.com`). Confirm sitemap
  submitted: `https://acetoursvanuatu.com/sitemap.xml`.
- **Bing Webmaster Tools** (bing.com/webmasters) — import from GSC; submit same sitemap.
- **Google Analytics 4** (if not already) — track sessions, source/medium, conversions
  (booking confirmations). Check whether GA4/gtag is already on the site before adding.

### B2. Weekly check (~10 min, in GSC)
- **Performance** report: total clicks & impressions trend (should climb post-Phase-1–5).
- **Queries** tab: which search terms bring impressions/clicks? Are the target terms
  (below) appearing? Note new queries you rank for.
- **Pages** tab: are `/tours`, the landing pages, `/blog/*` getting impressions?
- **Crawl Stats** (Settings): request count climbing past the old "4" (confirms crawling
  resumed after the robots fix).

### B3. Monthly check
- **Indexing → Pages:** how many pages indexed vs submitted? Investigate "not indexed".
- **Position tracking** for the target keywords (B4) — record positions to see movement.
- **Core Web Vitals** + **Mobile Usability** reports — fix any flagged issues.
- Review which backlinks/citations went live; update the tracker.

### B4. Target keywords to track (position over time)
Commercial (Phase 4 landing pages):
- port vila airport transfers / airport transfers vanuatu / bauerfield airport taxi
- efate island day tours / things to do port vila / vanuatu day trips
- blue lagoon vanuatu / mele cascades tour / vanuatu cultural tours
- port vila private transfers / vanuatu tours / port vila tours

Informational (Phase 5 blog, once published):
- vanuatu travel guide / things to do in vanuatu / best time to visit vanuatu
- how to get from port vila airport to resort / port vila itinerary

Brand (baseline — should already rank #1):
- ace tours vanuatu / ace tours & transfers

### B5. Success metrics (what "winning" looks like)
- GSC impressions & clicks trending up month-over-month.
- Target commercial keywords moving onto page 1 (positions 1–10) over 1–3 months.
- Pages indexed ≈ pages submitted (landing pages + products + published articles).
- Google Business Profile appearing in the Port Vila "map pack" for local searches.
- Referral traffic arriving from TripAdvisor/Viator/VTO listings (GA4 source/medium).

---

## Reality check on timeline
SEO is a lagging indicator. After Phases 1–5 deploy, expect **days–weeks** for re-crawl/
indexing and **1–3 months** for ranking movement on competitive terms (you're up against
TripAdvisor/Viator/GetYourGuide aggregators). The technical foundation is now solid; Phase 6
is patient, consistent authority-building + watching the GSC numbers.

## Immediate next actions (priority order)
1. **Push `main` + deploy** so the Blog nav link and all Phase 1–5 work is live.
2. **Confirm GBP** created/verified (Phase 3 doc) — biggest single lever.
3. **Claim TripAdvisor + Viator + VTO** listings; fix any NAP mismatches.
4. **Bing Places + Bing Webmaster Tools** (quick, free).
5. **Client authors 2–3 blog articles** → then resubmit sitemap + request indexing for
   `/blog` + article URLs in GSC.
6. **Start the weekly GSC check** and log target-keyword positions monthly.

# SEO Keyword Landing Pages — Design (Phase 4)

## Context

Phases 1–2 made acetoursvanuatu.com crawlable (build-time prerender, verified live:
every public page now serves real HTML with JSON-LD). The site still has only generic
`/tours` and `/transfers` listing pages — nothing targeting the high-intent category
searches that drive Vanuatu tourism traffic ("airport transfers Port Vila", "Efate day
tours", "Blue Lagoon Vanuatu", "Mele Cascades", "Vanuatu cultural tours", "private
transfers Port Vila"). Phase 4 adds dedicated, keyword-optimized **category landing
pages** that rank for those terms and funnel visitors to the existing product pages.

Because the prerender pipeline reads its route list from `/sitemap.xml`, any new route
added to the sitemap is automatically prerendered — so these pages get full SEO HTML for
free once wired in.

## Decisions (from brainstorming)

- **Page type:** category/theme landing pages (not product-page enrichment — that's a
  future follow-up).
- **Content source:** in-code typed config + i18n-ready English copy (no CMS/DB work).
- **Conversion path:** feature existing products via the `TourCard` component, linking to
  the real `/tours/<id>` & `/transfers/<id>` booking pages (one booking flow, no dup).
- **Structure:** one reusable `LandingPage` template driven by a config array (DRY).
- **Scope:** 6 pages, English-first. Per-language translation, CMS-editability, and
  product-page enrichment are explicitly OUT of scope.

## The 6 pages

| Route | Target search terms | category | Features products matching (title regex, case-insensitive) |
|---|---|---|---|
| `/port-vila-airport-transfers` | airport transfers Vanuatu/Port Vila, Bauerfield airport taxi | transfer | `/airport\|VIP executive\|hospitality/` |
| `/efate-island-day-tours` | Efate day tours, things to do Port Vila, Vanuatu day trips | tour | `/blue lagoon\|mele cascades\|round island\|pele island\|city & market\|city and market/` |
| `/blue-lagoon-vanuatu-tour` | Blue Lagoon Vanuatu, Turtle Bay | tour | `/blue lagoon\|turtle bay/` |
| `/mele-cascades-tour` | Mele Cascades waterfall Vanuatu | tour | `/mele cascades/` |
| `/vanuatu-cultural-tours` | Vanuatu cultural tour, kava tasting, Ekasup village | tour | `/cultural\|ekasup\|roots & routes\|kava\|village/` |
| `/port-vila-private-transfers` | private transfer Port Vila, resort transfer, VIP transfer | transfer | `/VIP\|private\|resort\|hideaway\|havannah\|dinner\|cruise\|wharf/` |

(Regexes match the live catalog as of 2026-06-01: 17 active products. Resilient to ID
changes and product renames; a no-match simply yields fewer cards.)

## Architecture

```
client/src/lib/landing-pages.ts      (NEW)  config types + LANDING_PAGES[] + findLandingPage()
client/src/lib/product-filters.ts    (NEW)  extracted shared product de-dupe/test-data filter
client/src/pages/landing-page.tsx    (NEW)  the reusable template component
client/src/App.tsx                    (MOD)  6 routes -> LandingPage
server/routes.ts                      (MOD)  add 6 slugs to sitemap staticPages (priority 0.8)
client/src/pages/tours.tsx            (MOD)  use the extracted product-filters helper (DRY)
```

### Routing
Add to the public `<Switch>` in `client/src/App.tsx` (after the existing static routes,
before `<Route component={NotFound} />`), one route per slug pointing at the shared
component, e.g.:

```tsx
<Route path="/port-vila-airport-transfers" component={LandingPage} />
```

`LandingPage` reads the current path via wouter's `useLocation()`, strips the leading
slash, and looks up its config with `findLandingPage(slug)`. If no config matches
(shouldn't happen given explicit routes, but defensive), it renders `<NotFound />`.

Six explicit routes (not a `/:slug` wildcard) are used so unrelated paths still fall
through to the real `NotFound`, and so the route list is greppable.

## Components / data flow

`LandingPage` (wrapped in the existing `<Layout>`), top to bottom:

1. **`<SEO>`** — `title={cfg.seoTitle}`, `description={cfg.seoDescription}`,
   `keywords={cfg.keywords}`, `faqs={cfg.faqs}`. The existing SEO component
   (`client/src/components/seo.tsx`) already emits the page `<title>`, meta, canonical,
   OG/Twitter, and **FAQPage JSON-LD** from `faqs`. The JSON-LD `<script>` it injects is
   the exact marker the prerender script waits for, so these pages prerender correctly
   with no extra work.
2. **Hero** — single `<h1>{cfg.h1}` + `cfg.subhead` over `cfg.heroImage` (Cloudinary).
   Exactly one `<h1>` per page.
3. **Intro** — `cfg.intro` paragraphs (1–2).
4. **Featured products grid** — pulls the live list via `useLocalizedTours()` or
   `useLocalizedTransfers()` (per `cfg.category`), filters through the shared
   product-filters helper (active + drop test data + de-dupe), then keeps titles matching
   `cfg.featuredMatch`. Renders each via `<TourCard tour={...} index={i} />`. If the
   result is empty, the whole grid section is omitted (no empty state). While loading,
   show the same lightweight loading text the existing pages use.
5. **Body sections** — map `cfg.sections` → `{ heading, paragraphs[] }` blocks.
6. **FAQ accordion** — visible render of the SAME `cfg.faqs` array that feeds the JSON-LD,
   so on-page content and structured data always match.
7. **CTA band** — a link to `/contact`, a WhatsApp click-to-chat (reuse the
   `wa.me`/whatsapp-number pattern from `client/src/pages/contact.tsx`), and a link to
   `cfg.ctaListingPath` (`/tours` or `/transfers`).

Internal links (product cards, listing, contact) intentionally spread link equity.

## Config shape (`client/src/lib/landing-pages.ts`)

```ts
export interface LandingFaq { question: string; answer: string; }
export interface LandingSection { heading: string; paragraphs: string[]; }

export interface LandingPageConfig {
  slug: string;                          // "port-vila-airport-transfers" (no leading slash)
  seoTitle: string;                      // e.g. "Port Vila Airport Transfers"
  seoDescription: string;                // 120–155 chars, keyword-rich
  keywords: string[];
  h1: string;
  subhead: string;
  heroImage: string;                     // Cloudinary URL
  intro: string[];                       // 1–2 paragraphs
  sections: LandingSection[];            // body content blocks (>=1)
  faqs: LandingFaq[];                    // >=1; drives accordion + FAQ JSON-LD
  category: "tour" | "transfer";         // which catalog to match
  featuredMatch: RegExp;                 // tested against product.title (case-insensitive)
  ctaListingPath: "/tours" | "/transfers";
}

export const LANDING_PAGES: LandingPageConfig[] = [ /* 6 entries */ ];
export function findLandingPage(slug: string): LandingPageConfig | undefined;
export const LANDING_SLUGS: string[]; // derived, for sitemap + route generation reference
```

Copy is written directly in English in the config (genuinely useful, keyword-natural
prose — not keyword stuffing). i18n keys can wrap these later without restructuring.

## Product matching helper (`client/src/lib/product-filters.ts`)

Extract the de-dupe + test-data exclusion currently inline in `tours.tsx` into a shared,
pure, testable function so both `tours.tsx` and `LandingPage` use one implementation:

```ts
// Drops inactive + test/verification/concurrent/phase4 entries and de-dupes by
// normalized title (existing behavior moved verbatim from tours.tsx).
export function cleanProductList<T extends { title: string; isActive?: boolean }>(items: T[]): T[];
```

`tours.tsx` is updated to call `cleanProductList(allTours)` instead of its inline reducer.

## Sitemap

In `server/routes.ts` `/sitemap.xml`, append the 6 landing slugs to `staticPages`
(priority `0.8`, changefreq `monthly`). This both tells Google about them and causes the
prerender pipeline to snapshot them automatically.

## Error handling

- Unknown slug in `LandingPage` → render `<NotFound />` (defensive; routes are explicit).
- Products API failure / empty match → featured grid omitted; the SEO-critical content
  (h1, intro, sections, FAQ, JSON-LD) still renders.

## Testing

- `client/src/lib/landing-pages.test.ts` (Vitest): every config has a unique non-empty
  slug; required string fields non-empty; `category` ∈ {tour,transfer}; `faqs.length>=1`
  and `sections.length>=1`; `ctaListingPath` matches `category`; `findLandingPage` returns
  the correct config and `undefined` for unknown slugs; `LANDING_SLUGS` matches the configs.
- `client/src/lib/product-filters.test.ts` (Vitest): `cleanProductList` drops inactive +
  test-data titles, de-dupes by normalized title, and returns expected subsets for a
  fixture list. Plus a featured-match test: given a fixture catalog + a config regex, the
  expected products are selected.
- **Prerender/live verification** (post-deploy, manual): for each of the 6 URLs, raw
  `curl -A Googlebot` HTML contains the unique `<h1>`, FAQ `application/ld+json`, and
  links to the matched product pages; Google Rich Results Test passes on one.

## Out of scope (future follow-ups)
- Per-language translation of landing copy (English-first; i18n-ready).
- CMS/admin editability of landing copy.
- Product-page (`/tours/<id>`) on-page SEO enrichment.
- Breadcrumb JSON-LD (the SEO component doesn't support it yet; not required to rank).

## Verification of done
- 6 routes render with unique h1/title/meta/FAQ JSON-LD and a grid of correctly-matched
  product cards linking to real booking pages.
- `tours.tsx` still works (now via the shared filter); 17/17 existing + new tests pass.
- Sitemap lists the 6 slugs; after deploy, each prerenders and `curl -A Googlebot`
  returns full content + FAQ JSON-LD.

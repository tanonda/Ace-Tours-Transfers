# SEO Keyword Landing Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 6 keyword-targeted category landing pages (airport transfers, Efate day tours, Blue Lagoon, Mele Cascades, cultural tours, private transfers) that rank for high-intent Vanuatu searches and funnel visitors to existing product pages.

**Architecture:** One reusable `LandingPage` template component renders any page from a typed config object in `client/src/lib/landing-pages.ts`. A shared `cleanProductList` helper (extracted from `tours.tsx`) plus a per-page title-regex selects which existing products to feature via the existing `TourCard`. Six explicit wouter routes; the 6 slugs are added to the dynamic sitemap so the existing build-time prerender snapshots them automatically.

**Tech Stack:** React 19 + TypeScript, wouter (routing), @tanstack/react-query, react-i18next, Vitest. Existing components reused: `Layout`, `SEO` (already emits FAQ JSON-LD), `TourCard`. Hooks: `useLocalizedTours` / `useLocalizedTransfers`.

---

## Background the engineer needs

- **Design spec:** `docs/superpowers/specs/2026-06-01-seo-keyword-landing-pages-design.md`. Read it.
- **Why this works for SEO with zero extra prerender wiring:** the prerender runner (`scripts/prerender.ts`) reads its route list from `GET /sitemap.xml` and waits for the `<SEO>` component's `application/ld+json` `<script>` before snapshotting. So: add a route to the sitemap → it gets prerendered to static HTML automatically. The `<SEO>` component (`client/src/components/seo.tsx`) already turns a `faqs` prop into FAQPage JSON-LD, which is exactly that marker.
- **Page pattern** (see `client/src/pages/tours.tsx`): a default-exported component returning `<Layout>` wrapping `<SEO .../>` then content; product data comes from `useLocalizedTours()` (returns `{ data, isLoading }`, `data` is `Product[] | undefined`).
- **`TourCard`** (`client/src/components/tour-card.tsx`) is `export function TourCard({ tour, index }: { tour: ProductRouteProps; index: number })`. A `Product` from the API is structurally compatible with how `tours.tsx` passes it: `<TourCard tour={{ ...tour, category: tour.category as any }} index={i} />`.
- **Routes & lazy imports** live in `client/src/App.tsx`. Pages are lazy: `const Tours = lazy(() => import("@/pages/tours"));`. Public routes are in the second `<Switch>` (the one starting at line ~206 with `<Route path="/" component={Home} />`), and end with `<Route component={NotFound} />`.
- **Sitemap** is built in `server/routes.ts` inside `app.get("/sitemap.xml", ...)` — there's a `staticPages` array of `{ loc, priority, changefreq, lastmod }`.
- **Test commands:** single file `npx vitest run <path>`; full suite `npm test`. Tests use `import { describe, it, expect } from 'vitest'`.
- **`Product` type** (`@shared/schema`) has at least `id: string`, `title: string`, `category: string`, `isActive: boolean`, `description`, `image`, price fields.
- **The existing `tours.tsx` inline filter** (the reducer that dedupes by normalized title and drops `verification|concurrent|test_tour|phase4` + inactive) is the logic to extract in Task 1. Reproduced verbatim in that task.

## File structure

```
client/src/lib/product-filters.ts        (NEW) cleanProductList() — shared de-dupe/test-data filter
client/src/lib/product-filters.test.ts   (NEW) tests for the filter
client/src/lib/landing-pages.ts          (NEW) config types + LANDING_PAGES[] + findLandingPage() + LANDING_SLUGS
client/src/lib/landing-pages.test.ts     (NEW) config integrity tests
client/src/pages/landing-page.tsx        (NEW) reusable template component
client/src/App.tsx                        (MOD) lazy import + 6 routes
client/src/pages/tours.tsx                (MOD) use cleanProductList (DRY)
server/routes.ts                          (MOD) add 6 slugs to sitemap staticPages
```

---

## Task 1: Extract shared product filter

**Files:**
- Create: `client/src/lib/product-filters.ts`
- Test: `client/src/lib/product-filters.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// client/src/lib/product-filters.test.ts
import { describe, it, expect } from 'vitest';
import { cleanProductList } from './product-filters';

interface P { title: string; isActive?: boolean; }

describe('cleanProductList', () => {
  it('drops inactive products', () => {
    const out = cleanProductList<P>([
      { title: 'Blue Lagoon Tour', isActive: true },
      { title: 'Hidden Tour', isActive: false },
    ]);
    expect(out.map(p => p.title)).toEqual(['Blue Lagoon Tour']);
  });

  it('drops test/verification data by title', () => {
    const out = cleanProductList<P>([
      { title: 'Real Tour', isActive: true },
      { title: 'Verification Tour', isActive: true },
      { title: 'concurrent test', isActive: true },
      { title: 'TEST_TOUR alpha', isActive: true },
      { title: 'phase4 thing', isActive: true },
    ]);
    expect(out.map(p => p.title)).toEqual(['Real Tour']);
  });

  it('de-dupes by normalized title (ignores trailing " Package")', () => {
    const out = cleanProductList<P>([
      { title: 'Mele Cascades', isActive: true },
      { title: 'Mele Cascades Package', isActive: true },
    ]);
    expect(out).toHaveLength(1);
  });

  it('prefers the active entry when a duplicate exists', () => {
    const out = cleanProductList<P>([
      { title: 'City Tour Package', isActive: false },
      { title: 'City Tour', isActive: true },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].isActive).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run client/src/lib/product-filters.test.ts`
Expected: FAIL — `Cannot find module './product-filters'`.

- [ ] **Step 3: Write the implementation**

This is the existing `tours.tsx` reducer, generalized. Create `client/src/lib/product-filters.ts`:

```ts
/**
 * Shared product list cleanup used by the /tours listing and the SEO landing
 * pages. Drops inactive products and obvious test/seed data, then de-dupes by
 * normalized title (treating "X" and "X Package" as the same), preferring the
 * active entry. Extracted verbatim from the original inline logic in tours.tsx
 * so both call sites share one implementation.
 */
export function cleanProductList<T extends { title: string; isActive?: boolean }>(
  items: T[],
): T[] {
  const normalize = (t: string) => t.replace(/\s+Package$/i, '').trim();

  return items.reduce<T[]>((acc, current) => {
    if (current.isActive === false) return acc;

    const titleLower = current.title.toLowerCase();
    if (
      titleLower.includes('verification') ||
      titleLower.includes('concurrent') ||
      titleLower.includes('test_tour') ||
      titleLower.includes('phase4')
    ) {
      return acc;
    }

    const normalizedTitle = normalize(current.title);
    const existingIndex = acc.findIndex(
      (item) => normalize(item.title) === normalizedTitle,
    );

    if (existingIndex === -1) {
      acc.push(current);
    } else if (current.isActive !== false && acc[existingIndex].isActive === false) {
      acc[existingIndex] = current;
    }
    return acc;
  }, []);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run client/src/lib/product-filters.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/product-filters.ts client/src/lib/product-filters.test.ts
git commit -m "feat(seo): extract shared cleanProductList product filter"
```

---

## Task 2: Refactor tours.tsx to use the shared filter

**Files:**
- Modify: `client/src/pages/tours.tsx`

- [ ] **Step 1: Replace the inline reducer with the helper**

In `client/src/pages/tours.tsx`, add the import near the other imports:

```ts
import { cleanProductList } from "@/lib/product-filters";
```

Then replace the entire `const toursList = allTours.reduce<...>(...)（...)， []);` block (the inline reducer that dedupes/filters) with:

```ts
  const toursList = cleanProductList(allTours as Array<{ title: string; isActive?: boolean }> & typeof allTours);
```

If the cast above is awkward in context, use the simpler form that matches the existing `data` typing:

```ts
  const toursList = cleanProductList(allTours);
```

(`allTours` already comes from `useLocalizedTours()` whose items have `title` and `isActive`, satisfying the generic constraint.)

- [ ] **Step 2: Type-check**

Run: `npx tsc --project tsconfig.json --noEmit 2>&1 | grep -i "tours.tsx" || echo "no tours.tsx type errors"`
Expected: `no tours.tsx type errors`.

- [ ] **Step 3: Run the filter tests (still green) + full suite for regressions**

Run: `npx vitest run client/src/lib/product-filters.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/tours.tsx
git commit -m "refactor(seo): use shared cleanProductList in tours page"
```

---

## Task 3: Landing page config + lookup

**Files:**
- Create: `client/src/lib/landing-pages.ts`
- Test: `client/src/lib/landing-pages.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// client/src/lib/landing-pages.test.ts
import { describe, it, expect } from 'vitest';
import { LANDING_PAGES, LANDING_SLUGS, findLandingPage } from './landing-pages';

describe('LANDING_PAGES config', () => {
  it('has 6 pages with unique, slash-free slugs', () => {
    expect(LANDING_PAGES).toHaveLength(6);
    const slugs = LANDING_PAGES.map(p => p.slug);
    expect(new Set(slugs).size).toBe(6);
    for (const s of slugs) expect(s).not.toMatch(/^\/|\/$|\s/);
  });

  it('every page has required non-empty content', () => {
    for (const p of LANDING_PAGES) {
      expect(p.seoTitle.length).toBeGreaterThan(0);
      expect(p.seoDescription.length).toBeGreaterThan(0);
      expect(p.h1.length).toBeGreaterThan(0);
      expect(p.intro.length).toBeGreaterThan(0);
      expect(p.sections.length).toBeGreaterThan(0);
      expect(p.faqs.length).toBeGreaterThan(0);
      expect(p.keywords.length).toBeGreaterThan(0);
      expect(['tour', 'transfer']).toContain(p.category);
    }
  });

  it('ctaListingPath agrees with category', () => {
    for (const p of LANDING_PAGES) {
      const expected = p.category === 'tour' ? '/tours' : '/transfers';
      expect(p.ctaListingPath).toBe(expected);
    }
  });

  it('LANDING_SLUGS lists exactly the config slugs', () => {
    expect([...LANDING_SLUGS].sort()).toEqual(LANDING_PAGES.map(p => p.slug).sort());
  });

  it('findLandingPage resolves known slugs and rejects unknown', () => {
    expect(findLandingPage('port-vila-airport-transfers')?.category).toBe('transfer');
    expect(findLandingPage('mele-cascades-tour')?.category).toBe('tour');
    expect(findLandingPage('/port-vila-airport-transfers')).toBeUndefined(); // leading slash not a slug
    expect(findLandingPage('does-not-exist')).toBeUndefined();
  });

  it('featuredMatch is a RegExp that matches its intended product', () => {
    const air = findLandingPage('port-vila-airport-transfers')!;
    expect(air.featuredMatch.test('Premium Airport Transfer')).toBe(true);
    const mele = findLandingPage('mele-cascades-tour')!;
    expect(mele.featuredMatch.test('Mele Cascades Waterfall Tour')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run client/src/lib/landing-pages.test.ts`
Expected: FAIL — `Cannot find module './landing-pages'`.

- [ ] **Step 3: Write the config**

Create `client/src/lib/landing-pages.ts`. NOTE on regex flags: define each `featuredMatch` with the `i` flag only (no `g` — a global regex is stateful across `.test()` calls and would cause intermittent matches). Copy is real, useful, keyword-natural English.

```ts
/**
 * SEO category landing pages. Each entry renders through the shared
 * client/src/pages/landing-page.tsx template. Pages target high-intent Vanuatu
 * searches and funnel to existing product pages via TourCard.
 *
 * featuredMatch is tested (case-insensitive, non-global) against product.title
 * to pick which live products to feature — resilient to UUID/id changes.
 */
export interface LandingFaq { question: string; answer: string; }
export interface LandingSection { heading: string; paragraphs: string[]; }

export interface LandingPageConfig {
  slug: string;
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
  h1: string;
  subhead: string;
  heroImage: string;
  intro: string[];
  sections: LandingSection[];
  faqs: LandingFaq[];
  category: 'tour' | 'transfer';
  featuredMatch: RegExp;
  ctaListingPath: '/tours' | '/transfers';
}

const HERO = 'https://res.cloudinary.com/dwro1dh5q/image/upload/v1765063929/ace-tours-assets/ace_tours_hero_beach.jpg';

export const LANDING_PAGES: LandingPageConfig[] = [
  {
    slug: 'port-vila-airport-transfers',
    seoTitle: 'Port Vila Airport Transfers',
    seoDescription: 'Reliable Port Vila airport transfers from Bauerfield (VLI) to your hotel or resort. Meet-and-greet, fixed fares, day or night. Book your Vanuatu transfer with Ace Tours.',
    keywords: ['Port Vila airport transfers', 'Bauerfield airport taxi', 'Vanuatu airport shuttle', 'airport transfer Port Vila', 'Efate airport transport'],
    h1: 'Port Vila Airport Transfers',
    subhead: 'Stress-free arrivals and departures at Bauerfield International Airport (VLI).',
    heroImage: HERO,
    intro: [
      'Touch down in paradise without the hassle. Ace Tours & Transfers provides reliable, comfortable airport transfers between Bauerfield International Airport (VLI) and hotels, resorts, and private accommodation across Port Vila and Efate Island.',
      'Our local drivers meet every flight — day or night — with a warm Ni-Vanuatu welcome, help with your luggage, and a direct, air-conditioned ride to your door. Fares are agreed up front, so there are no surprises after a long journey.',
    ],
    sections: [
      { heading: 'Why book your airport transfer with us', paragraphs: [
        'Punctual meet-and-greet at arrivals for every international and domestic flight.',
        'Fixed, transparent pricing — no metered surprises or late-night surcharges.',
        'Clean, air-conditioned vehicles sized for couples, families, and groups.',
      ]},
      { heading: 'Where we go', paragraphs: [
        'We cover all Port Vila hotels and the wider Efate Island, including resort areas such as Havannah Harbour, Hideaway Island, and the Mele district. Travelling for a cruise or event? We also handle wharf and group logistics.',
      ]},
    ],
    faqs: [
      { question: 'Do you meet late-night and early-morning flights?', answer: 'Yes. We schedule transfers around your flight time, including late arrivals and pre-dawn departures.' },
      { question: 'How much is an airport transfer in Port Vila?', answer: 'Fares are fixed and agreed when you book, based on your destination and group size. Contact us for a quote.' },
      { question: 'Will the driver be waiting when I land?', answer: 'Yes — our driver meets you in the arrivals area with a name sign and helps with your luggage to the vehicle.' },
    ],
    category: 'transfer',
    featuredMatch: /airport|VIP executive|hospitality/i,
    ctaListingPath: '/transfers',
  },
  {
    slug: 'efate-island-day-tours',
    seoTitle: 'Efate Island Day Tours',
    seoDescription: 'Discover the best Efate Island day tours from Port Vila — Blue Lagoon, Mele Cascades, the round-island drive and more. Small groups, local guides. Book with Ace Tours.',
    keywords: ['Efate Island day tours', 'things to do Port Vila', 'Vanuatu day trips', 'Port Vila tours', 'Efate sightseeing'],
    h1: 'Efate Island Day Tours',
    subhead: 'See the very best of Efate in a day — waterfalls, lagoons, villages and viewpoints.',
    heroImage: HERO,
    intro: [
      'There is far more to Efate than the beach outside your resort. Ace Tours & Transfers runs friendly, small-group day tours that take you to the island’s most loved spots — the famous Blue Lagoon, the cascading Mele waterfalls, hilltop viewpoints, and authentic village experiences.',
      'Every tour is guided by locals who know the stories behind the scenery, with comfortable air-conditioned transport and flexible pickups from your Port Vila accommodation.',
    ],
    sections: [
      { heading: 'Popular Efate day trips', paragraphs: [
        'From the turquoise Blue Lagoon and Mele Cascades to a full scenic circuit of the island, our day tours suit families, couples, and cruise visitors with limited time ashore.',
      ]},
      { heading: 'Tailored to you', paragraphs: [
        'Prefer a private tour at your own pace? We arrange custom itineraries and combine attractions so you see what matters most to you.',
      ]},
    ],
    faqs: [
      { question: 'Which Efate day tour is best for a first visit?', answer: 'The Blue Lagoon and Mele Cascades combination, or our scenic round-island tour, are the most popular for first-time visitors.' },
      { question: 'Do you pick up from my hotel?', answer: 'Yes — we offer pickups and drop-offs from accommodation across Port Vila and Efate.' },
      { question: 'Are the tours suitable for children?', answer: 'Absolutely. Our day tours are family-friendly and we use comfortable, air-conditioned vehicles.' },
    ],
    category: 'tour',
    featuredMatch: /blue lagoon|mele cascades|round island|pele island|city & market|city and market|scenic/i,
    ctaListingPath: '/tours',
  },
  {
    slug: 'blue-lagoon-vanuatu-tour',
    seoTitle: 'Blue Lagoon Vanuatu Tour',
    seoDescription: 'Swim in the famous Blue Lagoon near Port Vila and visit Turtle Bay on a guided Vanuatu day tour. Crystal-clear water, rope swings and local guides. Book with Ace Tours.',
    keywords: ['Blue Lagoon Vanuatu', 'Blue Lagoon Port Vila tour', 'Turtle Bay Vanuatu', 'Blue Lagoon Efate', 'Vanuatu swimming tour'],
    h1: 'Blue Lagoon Vanuatu Tour',
    subhead: 'Swim in the iconic turquoise Blue Lagoon — one of Efate’s most photographed spots.',
    heroImage: HERO,
    intro: [
      'The Blue Lagoon is exactly as the photos promise: impossibly clear, warm turquoise water fringed by jungle, with rope swings and easy spots to float the afternoon away. It is one of the most beautiful and family-friendly places on Efate.',
      'Ace Tours & Transfers takes you there in comfort, often combined with nearby Turtle Bay, with a local guide and relaxed time to swim, snap photos, and soak it all in.',
    ],
    sections: [
      { heading: 'What to expect', paragraphs: [
        'Calm, shallow areas for younger swimmers and deeper water with rope swings for the adventurous. Bring swimwear, a towel, and a camera.',
      ]},
      { heading: 'Combine and save', paragraphs: [
        'The Blue Lagoon pairs perfectly with Turtle Bay and other Efate highlights — ask us about combining stops into one easy day.',
      ]},
    ],
    faqs: [
      { question: 'Where is the Blue Lagoon in Vanuatu?', answer: 'It is on the east side of Efate Island, roughly a 30–40 minute drive from Port Vila.' },
      { question: 'Is the Blue Lagoon good for children?', answer: 'Yes — there are calm, shallow areas as well as deeper water with rope swings, so it suits all ages.' },
      { question: 'What should I bring?', answer: 'Swimwear, a towel, sunscreen, water, and a camera. We handle the transport and guiding.' },
    ],
    category: 'tour',
    featuredMatch: /blue lagoon|turtle bay/i,
    ctaListingPath: '/tours',
  },
  {
    slug: 'mele-cascades-tour',
    seoTitle: 'Mele Cascades Waterfall Tour',
    seoDescription: 'Visit the stunning Mele Cascades waterfalls near Port Vila on a guided tour. Climb tiered pools to the spectacular top falls. Book your Vanuatu waterfall tour with Ace Tours.',
    keywords: ['Mele Cascades', 'Mele Cascades waterfall', 'Port Vila waterfall tour', 'Vanuatu waterfalls', 'Mele Cascades tour'],
    h1: 'Mele Cascades Waterfall Tour',
    subhead: 'Climb the tiered turquoise pools to Efate’s spectacular Mele Cascades.',
    heroImage: HERO,
    intro: [
      'Just outside Port Vila, the Mele Cascades tumble down the hillside in a series of turquoise pools to a dramatic 35-metre top waterfall. A guided walk up through the cascades — with plenty of places to swim along the way — is one of Efate’s most rewarding half-day adventures.',
      'Ace Tours & Transfers handles your return transport and guiding so you can focus on the climb, the views, and a refreshing swim under the falls.',
    ],
    sections: [
      { heading: 'What to expect', paragraphs: [
        'A guided walk up natural rock pools to the main falls, with swimming spots throughout. Wear sturdy footwear that can get wet and bring swimwear.',
      ]},
      { heading: 'Pair it with the Blue Lagoon', paragraphs: [
        'Mele Cascades sits close to other Efate highlights and combines well with a Blue Lagoon visit for a full day out — just ask us.',
      ]},
    ],
    faqs: [
      { question: 'How hard is the Mele Cascades walk?', answer: 'It is a moderate uphill walk over wet rocks with handrails in steeper sections. Reasonable fitness and grippy footwear are recommended.' },
      { question: 'Can I swim at Mele Cascades?', answer: 'Yes — there are swimming pools at several levels, including beneath the top falls.' },
      { question: 'How far is it from Port Vila?', answer: 'About 15 minutes by road, making it an easy half-day trip.' },
    ],
    category: 'tour',
    featuredMatch: /mele cascades/i,
    ctaListingPath: '/tours',
  },
  {
    slug: 'vanuatu-cultural-tours',
    seoTitle: 'Vanuatu Cultural Tours',
    seoDescription: 'Experience authentic Ni-Vanuatu culture near Port Vila — village visits, kava tasting and traditional custom at Ekasup and beyond. Book a Vanuatu cultural tour with Ace Tours.',
    keywords: ['Vanuatu cultural tours', 'Ekasup village tour', 'kava tasting Vanuatu', 'Port Vila cultural experience', 'Ni-Vanuatu village tour'],
    h1: 'Vanuatu Cultural Tours',
    subhead: 'Meet the people behind the islands — custom, kava, and village life on Efate.',
    heroImage: HERO,
    intro: [
      'Vanuatu’s greatest treasure is its living culture. On our cultural tours you are welcomed into village life to see traditional custom, hear ancestral stories, taste fresh local kava, and understand the Ni-Vanuatu way of life that has thrived here for thousands of years.',
      'Led by community guides, these experiences are respectful, authentic, and genuinely memorable — a highlight for travellers who want more than a beach.',
    ],
    sections: [
      { heading: 'What you’ll experience', paragraphs: [
        'Traditional welcomes and custom demonstrations, storytelling, local food and kava, and the chance to connect with village hosts.',
      ]},
      { heading: 'Respectful, community-based tourism', paragraphs: [
        'Our cultural tours are run with local communities so your visit supports the people who share their home and heritage with you.',
      ]},
    ],
    faqs: [
      { question: 'What is kava?', answer: 'Kava is Vanuatu’s traditional drink, made from the root of the kava plant. Tasting it is a central part of the cultural experience.' },
      { question: 'Are cultural tours suitable for families?', answer: 'Yes — they are welcoming and educational for all ages, with activities children enjoy.' },
      { question: 'Where do the cultural tours take place?', answer: 'At cultural villages on Efate near Port Vila, including the well-known Ekasup village.' },
    ],
    category: 'tour',
    featuredMatch: /cultural|ekasup|roots & routes|roots and routes|kava|village/i,
    ctaListingPath: '/tours',
  },
  {
    slug: 'port-vila-private-transfers',
    seoTitle: 'Port Vila Private Transfers',
    seoDescription: 'Private transfers and chauffeur services around Port Vila and Efate — resort transfers, VIP executive cars, dinner and cruise transfers. Book private transport with Ace Tours.',
    keywords: ['Port Vila private transfers', 'VIP transfer Vanuatu', 'resort transfer Port Vila', 'private car Port Vila', 'Efate private transport'],
    h1: 'Port Vila Private Transfers',
    subhead: 'Private, door-to-door transport around Port Vila and Efate, on your schedule.',
    heroImage: HERO,
    intro: [
      'Travel on your own terms. Ace Tours & Transfers offers private, point-to-point transfers across Port Vila and Efate Island — from resort and hotel transfers to VIP executive cars, dinner outings, and cruise-ship logistics.',
      'You get a clean, air-conditioned vehicle, a professional local driver, and a fixed price agreed in advance — ideal for couples, families, executives, and groups who want comfort and privacy.',
    ],
    sections: [
      { heading: 'Private transfer options', paragraphs: [
        'Resort and hotel transfers across Efate, VIP executive vehicles, round-trip dinner transfers, and wharf or cruise-ship pickups for groups.',
      ]},
      { heading: 'Comfort and reliability', paragraphs: [
        'Every transfer is private to your party, punctual, and fixed-price — no sharing, no metered surprises.',
      ]},
    ],
    faqs: [
      { question: 'What areas do your private transfers cover?', answer: 'All of Port Vila and Efate Island, including resort areas like Havannah Harbour and Hideaway Island, and the wharf for cruise arrivals.' },
      { question: 'Can I book a private car for the whole day?', answer: 'Yes — we arrange private transport by the trip or for extended periods. Contact us with your plans for a quote.' },
      { question: 'Are your private transfers fixed price?', answer: 'Yes. We agree the fare before your trip so there are no surprises.' },
    ],
    category: 'transfer',
    featuredMatch: /VIP|private|resort|hideaway|havannah|dinner|cruise|wharf/i,
    ctaListingPath: '/transfers',
  },
];

export const LANDING_SLUGS: string[] = LANDING_PAGES.map((p) => p.slug);

export function findLandingPage(slug: string): LandingPageConfig | undefined {
  return LANDING_PAGES.find((p) => p.slug === slug);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run client/src/lib/landing-pages.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/landing-pages.ts client/src/lib/landing-pages.test.ts
git commit -m "feat(seo): add landing page config + lookup for 6 category pages"
```

---

## Task 4: Landing page template component

**Files:**
- Create: `client/src/pages/landing-page.tsx`

- [ ] **Step 1: Write the component**

Create `client/src/pages/landing-page.tsx`. It looks up its config from the current path, renders SEO + content, and features matched products. Mirrors the structure/idioms of `tours.tsx`.

```tsx
import { useLocation, Link } from "wouter";
import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { TourCard } from "@/components/tour-card";
import NotFound from "@/pages/not-found";
import { findLandingPage } from "@/lib/landing-pages";
import { cleanProductList } from "@/lib/product-filters";
import { useLocalizedTours, useLocalizedTransfers } from "@/hooks/useLocalizedProducts";

export default function LandingPage() {
  const [location] = useLocation();
  const slug = location.replace(/^\/+/, "").replace(/\/+$/, "").split("?")[0];
  const config = findLandingPage(slug);

  // Always call hooks before any early return (Rules of Hooks).
  const toursQuery = useLocalizedTours();
  const transfersQuery = useLocalizedTransfers();

  if (!config) return <NotFound />;

  const query = config.category === "tour" ? toursQuery : transfersQuery;
  const all = query.data ?? [];
  const featured = cleanProductList(all).filter((p) =>
    config.featuredMatch.test(p.title),
  );

  return (
    <Layout>
      <SEO
        title={config.seoTitle}
        description={config.seoDescription}
        keywords={config.keywords}
        faqs={config.faqs}
      />

      {/* Hero */}
      <section
        className="relative bg-cover bg-center pt-40 pb-20"
        style={{ backgroundImage: `linear-gradient(rgba(15,13,9,0.55),rgba(15,13,9,0.55)), url(${config.heroImage})` }}
      >
        <div className="container mx-auto px-4 text-center text-white">
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-4">{config.h1}</h1>
          <p className="text-lg md:text-xl max-w-2xl mx-auto opacity-90">{config.subhead}</p>
        </div>
      </section>

      <div className="container mx-auto px-4 py-16 max-w-4xl">
        {/* Intro */}
        {config.intro.map((para, i) => (
          <p key={i} className="text-lg text-muted-foreground mb-6 leading-relaxed">{para}</p>
        ))}

        {/* Featured products */}
        {query.isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading…</div>
        ) : featured.length > 0 ? (
          <div className="my-12">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {featured.map((product, index) => (
                <TourCard
                  key={product.id}
                  tour={{ ...product, category: product.category as any }}
                  index={index}
                />
              ))}
            </div>
          </div>
        ) : null}

        {/* Body sections */}
        {config.sections.map((section, i) => (
          <section key={i} className="my-10">
            <h2 className="text-2xl font-serif font-bold mb-4">{section.heading}</h2>
            {section.paragraphs.map((p, j) => (
              <p key={j} className="text-muted-foreground mb-4 leading-relaxed">{p}</p>
            ))}
          </section>
        ))}

        {/* FAQ */}
        <section className="my-12">
          <h2 className="text-2xl font-serif font-bold mb-6">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {config.faqs.map((faq, i) => (
              <details key={i} className="border rounded-lg p-4">
                <summary className="font-semibold cursor-pointer">{faq.question}</summary>
                <p className="mt-3 text-muted-foreground leading-relaxed">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="my-12 text-center bg-muted/40 rounded-2xl p-8">
          <h2 className="text-2xl font-serif font-bold mb-4">Ready to book?</h2>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href={config.ctaListingPath} className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold">
              View all {config.category === "tour" ? "tours" : "transfers"}
            </Link>
            <Link href="/contact" className="px-6 py-3 rounded-lg border border-primary text-primary font-semibold">
              Contact us
            </Link>
          </div>
        </section>
      </div>
    </Layout>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --project tsconfig.json --noEmit 2>&1 | grep -i "landing-page" || echo "no landing-page type errors"`
Expected: `no landing-page type errors`. (If `TourCard`'s `tour` prop complains about missing fields, confirm the spread matches how `tours.tsx` calls it — both pass the raw product plus `category` cast; they are the same shape.)

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/landing-page.tsx
git commit -m "feat(seo): add reusable landing page template component"
```

---

## Task 5: Wire up the 6 routes

**Files:**
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Add the lazy import**

In `client/src/App.tsx`, alongside the other `const X = lazy(...)` lines (near line 25–43), add:

```ts
const LandingPage = lazy(() => import("@/pages/landing-page"));
```

- [ ] **Step 2: Add the 6 routes**

In the public `<Switch>` (the one with `<Route path="/" component={Home} />`), immediately AFTER the `<Route path="/faq" component={FAQ} />` line, add:

```tsx
        {/* SEO category landing pages */}
        <Route path="/port-vila-airport-transfers" component={LandingPage} />
        <Route path="/efate-island-day-tours" component={LandingPage} />
        <Route path="/blue-lagoon-vanuatu-tour" component={LandingPage} />
        <Route path="/mele-cascades-tour" component={LandingPage} />
        <Route path="/vanuatu-cultural-tours" component={LandingPage} />
        <Route path="/port-vila-private-transfers" component={LandingPage} />
```

- [ ] **Step 3: Type-check + build the client to confirm no route/JSX errors**

Run: `npx tsc --project tsconfig.json --noEmit 2>&1 | grep -i "App.tsx" || echo "no App.tsx type errors"`
Expected: `no App.tsx type errors`.

- [ ] **Step 4: Commit**

```bash
git add client/src/App.tsx
git commit -m "feat(seo): add routes for 6 keyword landing pages"
```

---

## Task 6: Add landing pages to the sitemap (enables auto-prerender)

**Files:**
- Modify: `server/routes.ts`

- [ ] **Step 1: Import the slugs**

At the top of `server/routes.ts`, add an import for the slug list. Use a relative path that resolves the shared client lib from the server build (the repo already imports across `@shared`; for client libs use a relative path). Add:

```ts
import { LANDING_SLUGS } from "../client/src/lib/landing-pages.js";
```

If that import path fails to resolve under the server's esbuild/tsx config (client code may not be on the server tsconfig path), DO NOT fight it — instead inline a local constant in `server/routes.ts` just above the sitemap handler, with a comment to keep it in sync:

```ts
// Keep in sync with client/src/lib/landing-pages.ts (LANDING_SLUGS).
const SEO_LANDING_SLUGS = [
  "port-vila-airport-transfers",
  "efate-island-day-tours",
  "blue-lagoon-vanuatu-tour",
  "mele-cascades-tour",
  "vanuatu-cultural-tours",
  "port-vila-private-transfers",
];
```

Decide which works during implementation; prefer the import, fall back to the inline constant. The rest of this task assumes a variable named `SEO_LANDING_SLUGS` — if you used the import, add `const SEO_LANDING_SLUGS = LANDING_SLUGS;`.

- [ ] **Step 2: Append landing pages to `staticPages`**

In the `app.get("/sitemap.xml", ...)` handler, immediately after the `staticPages` array literal is defined, add:

```ts
      for (const slug of SEO_LANDING_SLUGS) {
        staticPages.push({ loc: `/${slug}`, priority: "0.8", changefreq: "monthly", lastmod: now });
      }
```

(If `staticPages` is declared `const` with inferred element type, this push works because the literals match `{ loc, priority, changefreq, lastmod }`. If TypeScript complains about the type, change `const staticPages = [` to keep the same shape — the pushed object already matches.)

- [ ] **Step 3: Type-check the server**

Run: `npx tsc --project tsconfig.json --noEmit 2>&1 | grep -i "routes.ts" || echo "no routes.ts type errors"`
Expected: `no routes.ts type errors`.

- [ ] **Step 4: Verify the sitemap locally (server route, no browser needed)**

Start the dev server and curl the sitemap, OR (faster) assert via a quick node check that the slugs are present in the handler. Preferred manual check after `npm run dev` is running:

```bash
curl -s http://localhost:5000/sitemap.xml | grep -c -E "/(port-vila-airport-transfers|efate-island-day-tours|blue-lagoon-vanuatu-tour|mele-cascades-tour|vanuatu-cultural-tours|port-vila-private-transfers)"
```
Expected: `6`.

If you can't easily run the dev server in this environment, defer this to the end-to-end verification (Task 7) and note it.

- [ ] **Step 5: Commit**

```bash
git add server/routes.ts
git commit -m "feat(seo): include landing pages in sitemap (enables prerender)"
```

---

## Task 7: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all pass, including the new `product-filters` and `landing-pages` tests, and no regression in existing suites.

- [ ] **Step 2: Full type-check**

Run: `npm run check 2>&1 | tail -20`
Expected: completes without errors attributable to the new/modified files. (Note: `npm run check` has historically referenced a `server/tsconfig.json`; if it errors on that pre-existing issue rather than our files, fall back to `npx tsc --project tsconfig.json --noEmit` and confirm no errors in `landing-page`, `landing-pages`, `product-filters`, `App.tsx`, `tours.tsx`, `routes.ts`.)

- [ ] **Step 3: Build the client (catches route/lazy/JSX issues the prod build would hit)**

Run: `PRERENDER=0 npm run build 2>&1 | tail -15`
Expected: client + server build succeed (`dist/public` and `dist/index.cjs` produced). `PRERENDER=0` skips the browser step (not needed to validate the build).

- [ ] **Step 4: Manual content check against the built/served app or after deploy**

After deploy (Docker prerender runs at container startup), for each of the 6 URLs verify the prerendered HTML. Example for one:

```bash
curl -s -A "Googlebot" https://acetoursvanuatu.com/port-vila-airport-transfers > /tmp/lp.html
grep -c 'application/ld+json' /tmp/lp.html          # >= 1 (LocalBusiness + FAQPage)
grep -oE '<title>[^<]*</title>' /tmp/lp.html | head -1   # "Port Vila Airport Transfers | ..."
grep -oc '<h1' /tmp/lp.html                          # 1
grep -oE '/transfers/[a-z0-9-]+' /tmp/lp.html | head # featured product links present
```
Expected: JSON-LD present (FAQPage among the blocks), unique title, one `<h1>`, and links to real product pages. Repeat for the other 5 slugs (tour pages link to `/tours/<id>`).

- [ ] **Step 5: Confirm sitemap includes all 6 (post-deploy)**

```bash
curl -s https://acetoursvanuatu.com/sitemap.xml | grep -c -E "/(port-vila-airport-transfers|efate-island-day-tours|blue-lagoon-vanuatu-tour|mele-cascades-tour|vanuatu-cultural-tours|port-vila-private-transfers)"
```
Expected: `6`.

- [ ] **Step 6: Final commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "test(seo): verify keyword landing pages end-to-end"
```

---

## Post-merge (operational follow-ups, not code)
- In Google Search Console, submit/resubmit the sitemap and request indexing for the 6 new URLs.
- Add internal links from the homepage and `/tours` / `/transfers` listings to the relevant landing pages (small follow-up; boosts discovery and link equity).
- Review the marketing copy in `landing-pages.ts` and refine wording/prices as desired (it's plain text in one file).

## Self-review notes
- **Spec coverage:** 6 pages (Task 3 config) ✓; reusable template (Task 4) ✓; in-code config + i18n-ready (Task 3, English copy in config) ✓; product cards → product pages via TourCard (Task 4) ✓; shared product filter extracted from tours.tsx (Tasks 1–2) ✓; routes (Task 5) ✓; sitemap + auto-prerender (Task 6) ✓; SEO/FAQ JSON-LD via existing component (Task 4 uses `faqs` prop) ✓; tests for config + filter (Tasks 1, 3) ✓; error handling unknown slug → NotFound, empty grid omitted (Task 4) ✓; verification incl. live curl (Task 7) ✓.
- **Type consistency:** `LandingPageConfig`, `findLandingPage`, `LANDING_SLUGS`, `cleanProductList` named identically across config, component, sitemap, and tests. `featuredMatch` is `RegExp` with `i` (non-global) everywhere. `TourCard` invoked with the same `{ ...product, category: product.category as any }` shape as `tours.tsx`.
- **Out of scope (unchanged):** per-language landing copy, CMS editability, product-page enrichment, breadcrumb JSON-LD.

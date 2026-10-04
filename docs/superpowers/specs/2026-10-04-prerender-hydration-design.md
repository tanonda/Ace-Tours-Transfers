# Prerender hydration — design

Date: 2026-10-04
Status: approved in conversation, pending written-spec review
Branch: `perf/prerender-hydration`

## Problem

Public pages are prerendered (Playwright snapshots, see
`docs/superpowers/plans/2026-05-31-seo-prerender-public-pages.md`), but the client
boots with `createRoot(...).render(<App />)` (`client/src/main.tsx`). That discards
the prerendered DOM and rebuilds from scratch:

1. `Router` returns `<Loader />` while `feature-flags` and site settings load
   (`client/src/App.tsx`, `if (isFlagsLoading || isSettingsLoading ...)`).
2. The lazy route chunk loads behind `<Suspense fallback={<Loader />}>`.
3. The page's own `useQuery` calls show loading states until data arrives.

Measured on the live site, 2026-10-04 (Playwright, 412×823, CPU throttled 4×),
tour detail page `#root` content over time:

| t | state |
|---|---|
| 3.7 s | prerendered page visible |
| 5.7 s | React wipes it — `#root` empty |
| 8.5 s | partial (loading states) |
| 10.5–11 s | full page again |

The homepage does the same and briefly shows a different H1 while settings load.

Lighthouse mobile baseline (simulated throttling):

| page | score | FCP | LCP | TBT |
|---|---|---|---|---|
| `/` | 0.27 | 6.1 s | 8.5 s | 3,130 ms |
| `/tours/f9be5daa-…` | 0.28 | 7.1 s | 10.1 s | 1,850 ms |

Crawlers are unaffected (they read the HTML); this is a visitor-experience problem.

## Goal

- Mobile visitors never see the prerendered content disappear.
- Each page is rendered once on the client (hydrated), not twice — lowering TBT.
- HTML served to crawlers is unchanged apart from one added JSON data block.

Non-goals: full server-side rendering (evaluated and deferred — see "Alternatives"),
admin/customer areas (not prerendered; unchanged), translating snapshots.

## Approach

Dehydrate the react-query cache at prerender time, embed it in each snapshot, and
on the client seed the cache from it before calling `hydrateRoot`. Because the
data present at first client render equals the data used to produce the HTML, the
first render matches and React adopts the existing DOM.

React behaviours this relies on:
- During hydration, a `lazy()` component that suspends inside a `<Suspense>`
  boundary keeps the server HTML for that boundary until the chunk resolves; it does
  not show the fallback.
- On an unrecoverable mismatch, React 19 client-renders from the nearest Suspense
  boundary (root if none) and reports a recoverable error. With the cache seeded,
  that re-render has data immediately, so the worst case is a brief swap, never the
  current multi-second blank.

## Components

### `client/src/lib/hydration.ts` (new, pure + unit-tested)

- `SNAPSHOT_STATE_ID = "__ACE_QUERY_STATE__"`.
- `shouldDehydrateQuery(query)`: true only when `query.state.status === "success"`,
  `query.getObserversCount() > 0` (i.e. used by the current page — the prerender
  navigates in-app between routes, so the cache also holds earlier routes' data), and
  the key is not on the deny list (auth/user/session, cart, CSRF).
- `serializeSnapshotState(state)`: `JSON.stringify` with `<` → `<` (also
  ` `/` `) so the payload cannot close the `<script>` element.
- `readSnapshotState(doc)`: finds `script#__ACE_QUERY_STATE__`, parses JSON, returns
  `DehydratedState | null`; never throws.
- `bootMode(doc, state)`: `"hydrate"` when `#root` has prerendered children (not the
  SPA shell) and `state` is non-null; otherwise `"render"`.
- `MAX_STATE_BYTES = 150 * 1024`.

### `client/src/main.tsx`

- Read state → `bootMode`.
- `"hydrate"`: `hydrate(queryClient, state)` (from `@tanstack/react-query`), then
  `hydrateRoot(root, <App />, { onRecoverableError })`, rendering in English. After
  hydration, apply the visitor's stored language via `syncLanguage` /
  `i18n.changeLanguage` (queries keyed by language then refetch as they do on a
  manual language switch).
- `"render"`: unchanged — `syncLanguage(...).then(createRoot(...).render)`.
- `onRecoverableError`: `console.warn` once with the error (production); in dev and
  under the audit script this surfaces as a failure (see Testing).
- Expose `window.__ACE_DEHYDRATE__ = () => serializeSnapshotState(dehydrate(queryClient, { shouldDehydrateQuery }))`
  unconditionally. It returns only public data already rendered on the page (the
  deny list excludes auth/cart/CSRF), so gating it adds complexity for no benefit.

### First-render parity fixes (client)

Anything whose first render reads browser-only state must start from the value the
prerender used, then update in an effect — the pattern `CurrencyProvider` already
follows (starts `VUV`, reads `localStorage` in `useEffect`).

Known now:
- `ThemeProvider` (`client/src/lib/theme-context.tsx`) reads `localStorage` /
  `matchMedia` in the `useState` initializer → start `"light"`, apply stored theme
  in an effect. (The `<html>` class is already set in an effect.)
- `useIsMobile` / `useMediaQuery` — verify initial value matches the prerender
  viewport assumption; switch to effect-applied if not.

Others (cart count badge, auth-dependent header items, `new Date()` in render) are
found by the hydration-warning check and fixed the same way.

### `scripts/prerender.ts`

After a route is ready and before `page.content()`:
1. `const state = await page.evaluate(() => window.__ACE_DEHYDRATE__?.())`.
2. If present and `≤ MAX_STATE_BYTES`, insert
   `<script type="application/json" id="__ACE_QUERY_STATE__">…</script>` before
   `</body>`; otherwise save without it and log `[hydration] <route> state skipped: <reason>`.
3. Log state size per route alongside existing `[timing]` lines.

`server/prerender-seed.ts` copies snapshots from the previous deploy; the block
travels with the HTML and needs no change. `swapAssetTags` must leave it intact
(covered by a test).

## Data freshness

Dehydrated queries keep their original `dataUpdatedAt`. With the default
`staleTime` of 5 min, snapshot data is stale on almost every visit, so mounted
queries refetch in the background after hydration and the UI updates if data
changed (e.g. a price edit since deploy). No custom freshness logic.

## Failure handling

| condition | behaviour |
|---|---|
| no state block / invalid JSON | `createRoot` (today's behaviour) |
| `#root` is the SPA shell | `createRoot` |
| state over size cap | snapshot saved without it → `createRoot` for that page |
| hydration mismatch | React client-renders the affected boundary; one warning |
| `__ACE_DEHYDRATE__` missing (old bundle) | snapshot saved without state |

Bad or missing state can never prevent the page from rendering.

## Testing & verification

- **Unit (vitest):** `hydration.ts` — dehydrate filter (unobserved, errored,
  deny-listed keys excluded), serialization escaping (`</script>` in a string value
  round-trips and cannot terminate the element), `readSnapshotState` (missing,
  malformed, valid), `bootMode` (shell vs snapshot, with/without state);
  `ThemeProvider` initial render is `"light"` regardless of storage.
  `swapAssetTags` preserves the state block.
- **Prerender integration:** local build + prerender; assert every snapshot has a
  state block, sizes logged, and no auth/cart/CSRF keys present.
- **Browser (Playwright, `/usr/bin/google-chrome`):** home, a tour, a transfer, a
  landing page, a blog article — `#root` text length never drops to 0 during load
  (CPU 4×); zero hydration warnings in console; post-load interactions work: add to
  cart, switch language, switch currency, toggle theme.
- **Metrics:** Lighthouse mobile on `/` and the tour page, before vs after (table
  above), locally and on live after deploy.

GitHub Actions is billing-locked, so CI won't run — run the suite locally,
sequentially, before pushing `main`.

## Alternatives considered

- **Server injects data per request:** duplicates every page's data requirements on
  the server; fragile. Rejected.
- **Full SSR (per-request render in Express, or a framework migration):** gives
  always-fresh HTML, immediate HTML for new content, and per-visitor HTML, but costs
  server CPU per request on a 0.15-core instance, does not reduce client hydration
  JS, and requires making all render paths server-safe. Deferred. The parity and
  dehydration work here is a prerequisite for SSR anyway.

## Follow-up (separate spec)

**Content-triggered re-prerender:** when an admin publishes/edits a product or blog
article, re-snapshot the affected routes (plus listing pages and sitemap) instead
of waiting for the next deploy.

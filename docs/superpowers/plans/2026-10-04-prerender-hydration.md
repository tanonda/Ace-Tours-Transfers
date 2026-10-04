# Prerender Hydration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the client from wiping prerendered pages on load by embedding each page's react-query data in its snapshot and booting with `hydrateRoot`.

**Architecture:** The prerender (Playwright, `scripts/prerender.ts`) calls a hook the app exposes (`window.__ACE_DEHYDRATE__`) right after capturing a page, and embeds the returned JSON as `<script type="application/json" id="__ACE_QUERY_STATE__">` before `</body>`. On boot, `client/src/main.tsx` seeds the query cache from that block and calls `hydrateRoot` (English first, visitor's language applied after); with no block it falls back to today's `createRoot`. Browser-only state (theme) starts from the prerender value and is applied in a layout effect so the first render matches the HTML.

**Tech Stack:** React 19.2, @tanstack/react-query 5.60, react-i18next, wouter, Vite, Playwright (system Chrome at `/usr/bin/google-chrome`), vitest (node environment).

**Spec:** `docs/superpowers/specs/2026-10-04-prerender-hydration-design.md`

## Global Constraints

- Branch: `perf/prerender-hydration`. Stage only files you edit (`git add <paths>`), never `git add -A`.
- State block id: `__ACE_QUERY_STATE__`. Size cap: `150 * 1024` bytes.
- Only `status === "success"` queries with ≥1 observer are dehydrated; auth/user/session/cart/csrf/booking/notification keys never are.
- Bad or missing state must never prevent rendering — fall back to `createRoot`.
- Snapshots stay English / VUV / logged-out.
- vitest runs in the **node** environment and only picks up `server/**/*.test.ts`, `shared/**/*.test.ts`, `client/src/lib/**/*.test.ts` — put client unit-testable logic in `client/src/lib/*.ts` (no JSX, no DOM).
- Playwright must use `executablePath: '/usr/bin/google-chrome'` (bundled browsers are outdated).
- GitHub Actions is billing-locked: run `npm run check` and `npm test` locally, **sequentially**, before any push.
- Do not push or deploy without asking the user first.

## Review Focus

1. **Visitor with a saved non-English language** (`localStorage.i18nextLng = "fr"`): the page must stay visible throughout load and end up in French. → audit scenario `fr` in Task 5.
2. **Visitor with a saved dark theme** (`localStorage["ace-theme"] = "dark"`): no blank, no hydration warning, ends dark. → audit scenario `dark` in Task 5; `resolveStoredTheme` tests in Task 2.
3. **Snapshot without a state block** (seeded from the previous deploy, or state skipped as too large): app must boot exactly as today and render the page. → audit scenario `stateless` in Task 5; `bootMode` tests in Task 1.
4. **Data changed after deploy** (e.g. a price edit): embedded data must be treated as stale so the page refetches after hydration. → "keeps dataUpdatedAt so hydrated data is stale" test in Task 1.
5. **Logged-in visitor / private data**: no auth, cart, booking or CSRF data ever ends up in a public snapshot. → deny-list tests in Task 1; snapshot grep in Task 5 step 4.

---

### Task 1: Hydration helpers (pure, unit-tested)

**Files:**
- Create: `shared/snapshot-state.ts`
- Create: `client/src/lib/hydration.ts`
- Test: `client/src/lib/hydration.test.ts`

**Interfaces:**
- Produces (`shared/snapshot-state.ts`): `SNAPSHOT_STATE_ID: "__ACE_QUERY_STATE__"`, `MAX_STATE_BYTES: number` (153600).
- Produces (`client/src/lib/hydration.ts`):
  - `shouldDehydrateQuery(query: Query): boolean`
  - `serializeSnapshotState(state: DehydratedState): string`
  - `parseSnapshotState(text: string | null | undefined): DehydratedState | null`
  - `type BootMode = "hydrate" | "render"`; `bootMode(rootHasContent: boolean, state: DehydratedState | null): BootMode`
  - `isEnglish(language: string | undefined): boolean`
  - global `Window.__ACE_DEHYDRATE__?: () => string`

- [ ] **Step 1: Write the failing tests**

`client/src/lib/hydration.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { QueryClient, QueryObserver, dehydrate, hydrate } from "@tanstack/react-query";
import {
  bootMode,
  isEnglish,
  parseSnapshotState,
  serializeSnapshotState,
  shouldDehydrateQuery,
} from "./hydration";

function observe(client: QueryClient, key: unknown[]) {
  const observer = new QueryObserver(client, { queryKey: key, enabled: false });
  return observer.subscribe(() => {});
}

function dehydratedKeys(client: QueryClient) {
  return dehydrate(client, { shouldDehydrateQuery }).queries.map((q) => q.queryKey);
}

describe("shouldDehydrateQuery", () => {
  it("keeps successful queries the current page is using", () => {
    const client = new QueryClient();
    client.setQueryData(["tour", "abc", "en"], { id: "abc" });
    observe(client, ["tour", "abc", "en"]);
    expect(dehydratedKeys(client)).toEqual([["tour", "abc", "en"]]);
  });

  it("drops queries left in the cache by earlier routes (no observers)", () => {
    const client = new QueryClient();
    client.setQueryData(["tour", "old", "en"], { id: "old" });
    expect(dehydratedKeys(client)).toEqual([]);
  });

  it("drops errored queries", async () => {
    const client = new QueryClient();
    await client
      .fetchQuery({ queryKey: ["products", "en"], queryFn: () => Promise.reject(new Error("x")), retry: false })
      .catch(() => {});
    observe(client, ["products", "en"]);
    expect(dehydratedKeys(client)).toEqual([]);
  });

  it.each([["auth"], ["/api/auth/me"], ["users"], ["user-bookings", "u1"], ["bookings"], ["booking", "b1"], ["cart"], ["csrf"], ["notifications"], ["session"]])(
    "never dehydrates private key %j",
    (...key) => {
      const client = new QueryClient();
      client.setQueryData(key, { secret: true });
      observe(client, key);
      expect(dehydratedKeys(client)).toEqual([]);
    },
  );

  it("keeps public keys that merely contain a private word later in the key", () => {
    const client = new QueryClient();
    client.setQueryData(["products", "en"], []);
    observe(client, ["products", "en"]);
    expect(dehydratedKeys(client)).toEqual([["products", "en"]]);
  });
});

describe("serializeSnapshotState / parseSnapshotState", () => {
  it("round-trips state", () => {
    const client = new QueryClient();
    client.setQueryData(["settings"], [{ key: "a", value: "b" }]);
    observe(client, ["settings"]);
    const text = serializeSnapshotState(dehydrate(client, { shouldDehydrateQuery }));
    expect(parseSnapshotState(text)?.queries[0].state.data).toEqual([{ key: "a", value: "b" }]);
  });

  it("cannot close the surrounding <script> element", () => {
    const client = new QueryClient();
    client.setQueryData(["article", "x"], { html: "</script><script>alert(1)</script> " });
    observe(client, ["article", "x"]);
    const text = serializeSnapshotState(dehydrate(client, { shouldDehydrateQuery }));
    expect(text).not.toContain("<");
    expect(text).not.toContain(" ");
    expect(parseSnapshotState(text)?.queries[0].state.data).toEqual({
      html: "</script><script>alert(1)</script> ",
    });
  });

  it("returns null for missing, malformed or wrong-shaped input", () => {
    expect(parseSnapshotState(null)).toBeNull();
    expect(parseSnapshotState(undefined)).toBeNull();
    expect(parseSnapshotState("")).toBeNull();
    expect(parseSnapshotState("{not json")).toBeNull();
    expect(parseSnapshotState('{"foo":1}')).toBeNull();
    expect(parseSnapshotState("null")).toBeNull();
  });

  it("keeps dataUpdatedAt so hydrated data is stale and refetches", () => {
    const source = new QueryClient();
    source.setQueryData(["tour", "abc", "en"], { price: 1000 }, { updatedAt: Date.now() - 10 * 60 * 1000 });
    observe(source, ["tour", "abc", "en"]);
    const state = parseSnapshotState(serializeSnapshotState(dehydrate(source, { shouldDehydrateQuery })))!;

    const target = new QueryClient({ defaultOptions: { queries: { staleTime: 5 * 60 * 1000 } } });
    hydrate(target, state);
    const query = target.getQueryCache().find({ queryKey: ["tour", "abc", "en"] })!;
    expect(query.state.data).toEqual({ price: 1000 });
    expect(query.isStaleByTime(5 * 60 * 1000)).toBe(true);
  });
});

describe("bootMode", () => {
  const state = { mutations: [], queries: [] };
  it("hydrates only a prerendered root that has state", () => {
    expect(bootMode(true, state)).toBe("hydrate");
  });
  it("renders the SPA shell (empty root)", () => {
    expect(bootMode(false, state)).toBe("render");
  });
  it("renders a snapshot without a state block", () => {
    expect(bootMode(true, null)).toBe("render");
  });
});

describe("isEnglish", () => {
  it.each([["en", true], ["en-US", true], ["EN-gb", true], [undefined, true], ["fr", false], ["zh", false], ["bi", false]])(
    "%s -> %s",
    (lang, expected) => {
      expect(isEnglish(lang)).toBe(expected);
    },
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run client/src/lib/hydration.test.ts`
Expected: FAIL — `Failed to resolve import "./hydration"`.

- [ ] **Step 3: Implement**

`shared/snapshot-state.ts`:

```ts
/**
 * Prerendered snapshots carry the react-query data they were rendered with, so the
 * client can hydrate the HTML instead of rebuilding it. Shared by the prerender
 * (writer) and the client (reader).
 */
export const SNAPSHOT_STATE_ID = "__ACE_QUERY_STATE__";

/** Larger states are left out of the snapshot; that page then boots with createRoot. */
export const MAX_STATE_BYTES = 150 * 1024;
```

`client/src/lib/hydration.ts`:

```ts
import type { DehydratedState, Query } from "@tanstack/react-query";

declare global {
  interface Window {
    /** Called by scripts/prerender.ts just before a page is saved. */
    __ACE_DEHYDRATE__?: () => string;
  }
}

// Visitor-specific data must never be baked into a public snapshot.
const PRIVATE_KEY = /^(\/api\/)?(auth|users?|user-bookings|session|cart|csrf|bookings?|booking-|notifications)/i;

/**
 * Only data the current page is showing: the prerender moves between routes in one
 * tab, so the cache also holds earlier routes' queries, which have no observers.
 */
export function shouldDehydrateQuery(query: Query): boolean {
  if (query.state.status !== "success") return false;
  if (query.getObserversCount() === 0) return false;
  return !PRIVATE_KEY.test(String(query.queryKey[0] ?? ""));
}

/** JSON safe to inline in <script type="application/json">: no "<", no JS line separators. */
export function serializeSnapshotState(state: DehydratedState): string {
  return JSON.stringify(state)
    .replace(/</g, "\\u003c")
    .replace(/ /g, "\\u2028")
    .replace(/ /g, "\\u2029");
}

export function parseSnapshotState(text: string | null | undefined): DehydratedState | null {
  if (!text) return null;
  try {
    const value = JSON.parse(text);
    return value && Array.isArray(value.queries) ? (value as DehydratedState) : null;
  } catch {
    return null;
  }
}

export type BootMode = "hydrate" | "render";

/** Hydrate only real prerendered content with its data; anything else renders from scratch. */
export function bootMode(rootHasContent: boolean, state: DehydratedState | null): BootMode {
  return rootHasContent && state !== null ? "hydrate" : "render";
}

/** Snapshots are English; any English variant can hydrate without a language switch. */
export function isEnglish(language: string | undefined): boolean {
  return !language || language.toLowerCase().startsWith("en");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run client/src/lib/hydration.test.ts`
Expected: PASS (all). If the `errored queries` test leaves an unhandled-rejection warning, that is fine as long as the suite passes.

- [ ] **Step 5: Commit**

```bash
git add shared/snapshot-state.ts client/src/lib/hydration.ts client/src/lib/hydration.test.ts
git commit -m "feat(client): helpers to dehydrate and read prerender query state"
```

---

### Task 2: Theme starts from the prerender value

**Files:**
- Create: `client/src/lib/theme.ts`
- Test: `client/src/lib/theme.test.ts`
- Modify: `client/src/lib/theme-context.tsx` (whole provider, lines 1–46)

**Interfaces:**
- Produces: `type Theme = "light" | "dark"`, `THEME_STORAGE_KEY = "ace-theme"`, `INITIAL_THEME: Theme = "light"`, `resolveStoredTheme(stored: string | null, prefersDark: boolean): Theme`.
- `ThemeProvider` / `useTheme` public API unchanged.

- [ ] **Step 1: Write the failing test**

`client/src/lib/theme.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { INITIAL_THEME, resolveStoredTheme } from "./theme";

describe("theme", () => {
  it("first render is light, matching the prerendered HTML", () => {
    expect(INITIAL_THEME).toBe("light");
  });

  it("uses a stored theme", () => {
    expect(resolveStoredTheme("dark", false)).toBe("dark");
    expect(resolveStoredTheme("light", true)).toBe("light");
  });

  it("falls back to the OS preference when nothing valid is stored", () => {
    expect(resolveStoredTheme(null, true)).toBe("dark");
    expect(resolveStoredTheme(null, false)).toBe("light");
    expect(resolveStoredTheme("purple", true)).toBe("dark");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run client/src/lib/theme.test.ts`
Expected: FAIL — cannot resolve `./theme`.

- [ ] **Step 3: Implement**

`client/src/lib/theme.ts`:

```ts
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "ace-theme";

/** Prerendered pages are captured in light mode; the first client render must match. */
export const INITIAL_THEME: Theme = "light";

export function resolveStoredTheme(stored: string | null, prefersDark: boolean): Theme {
  if (stored === "light" || stored === "dark") return stored;
  return prefersDark ? "dark" : "light";
}
```

Replace the top of `client/src/lib/theme-context.tsx` (imports through the end of `ThemeProvider`) with:

```tsx
import { createContext, useContext, useEffect, useLayoutEffect, useState, ReactNode } from "react";
import { INITIAL_THEME, resolveStoredTheme, THEME_STORAGE_KEY, type Theme } from "./theme";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Start from the prerender's theme so hydration matches, then apply the visitor's
  // choice before the browser paints (layout effect).
  const [theme, setThemeState] = useState<Theme>(INITIAL_THEME);
  const [storedThemeApplied, setStoredThemeApplied] = useState(false);

  useLayoutEffect(() => {
    setThemeState(
      resolveStoredTheme(
        localStorage.getItem(THEME_STORAGE_KEY),
        window.matchMedia("(prefers-color-scheme: dark)").matches,
      ),
    );
    setStoredThemeApplied(true);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    // Don't overwrite the stored choice with the initial value before it is read.
    if (storedThemeApplied) localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme, storedThemeApplied]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === "light" ? "dark" : "light"));
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

Keep `useTheme` unchanged.

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run client/src/lib/theme.test.ts && npm run check`
Expected: PASS; `tsc` exits 0.

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/theme.ts client/src/lib/theme.test.ts client/src/lib/theme-context.tsx
git commit -m "fix(client): start theme from the prerendered value so hydration matches"
```

---

### Task 3: Prerender embeds the state block

**Files:**
- Modify: `server/prerender-paths.ts` (add `attachSnapshotState` after `swapAssetTags`, ~line 113)
- Test: `server/prerender-paths.test.ts` (append)
- Modify: `scripts/prerender.ts:191-199` (capture loop in `renderAll`)

**Interfaces:**
- Consumes: `SNAPSHOT_STATE_ID`, `MAX_STATE_BYTES` from `shared/snapshot-state.ts` (Task 1); `window.__ACE_DEHYDRATE__` (installed in Task 4 — until then the prerender records `skipped: "no dehydrate hook"`, which is correct fallback behaviour).
- Produces: `attachSnapshotState(html: string, stateJson: string | null): { html: string; stateBytes: number; skipped?: string }`.

- [ ] **Step 1: Write the failing tests**

Append to `server/prerender-paths.test.ts`:

```ts
import { attachSnapshotState, swapAssetTags } from './prerender-paths.js';
import { MAX_STATE_BYTES, SNAPSHOT_STATE_ID } from '../shared/snapshot-state.js';

describe('attachSnapshotState', () => {
  const page = '<html><head></head><body><div id="root"><h1>Tour</h1></div></body></html>';

  it('inserts the state block just before </body>', () => {
    const result = attachSnapshotState(page, '{"queries":[],"mutations":[]}');
    expect(result.skipped).toBeUndefined();
    expect(result.stateBytes).toBe(29);
    expect(result.html).toContain(
      `<script type="application/json" id="${SNAPSHOT_STATE_ID}">{"queries":[],"mutations":[]}</script></body>`,
    );
  });

  it('leaves the page unchanged when the app exposed no hook', () => {
    expect(attachSnapshotState(page, null)).toEqual({ html: page, stateBytes: 0, skipped: 'no dehydrate hook' });
  });

  it('leaves the page unchanged when the state is over the size cap', () => {
    const big = `{"queries":[{"x":"${'a'.repeat(MAX_STATE_BYTES)}"}],"mutations":[]}`;
    const result = attachSnapshotState(page, big);
    expect(result.html).toBe(page);
    expect(result.skipped).toMatch(/too large/);
  });

  it('survives swapAssetTags when snapshots are re-pointed at a new build', () => {
    const withState = attachSnapshotState(page, '{"queries":[],"mutations":[]}').html;
    const shell = '<html><head><script type="module" crossorigin src="/assets/index-NEW.js"></script></head><body></body></html>';
    expect(swapAssetTags(withState, shell)).toContain(`id="${SNAPSHOT_STATE_ID}"`);
  });
});
```

(If `swapAssetTags` is already imported at the top of the file, merge the imports instead of duplicating.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run server/prerender-paths.test.ts`
Expected: FAIL — `attachSnapshotState` is not exported.

- [ ] **Step 3: Implement `attachSnapshotState`**

In `server/prerender-paths.ts`, add the import at the top:

```ts
import { MAX_STATE_BYTES, SNAPSHOT_STATE_ID } from '../shared/snapshot-state.js';
```

and after `swapAssetTags`:

```ts
/**
 * Embed the page's react-query state so the client can hydrate instead of rebuilding.
 * `stateJson` must already be script-safe (client/src/lib/hydration.ts
 * serializeSnapshotState). Without it the snapshot still works; the client renders
 * from scratch as before.
 */
export function attachSnapshotState(
  html: string,
  stateJson: string | null,
): { html: string; stateBytes: number; skipped?: string } {
  if (stateJson === null) return { html, stateBytes: 0, skipped: 'no dehydrate hook' };
  const stateBytes = Buffer.byteLength(stateJson, 'utf-8');
  if (stateBytes > MAX_STATE_BYTES) {
    return { html, stateBytes, skipped: `state too large (${stateBytes} > ${MAX_STATE_BYTES} bytes)` };
  }
  const end = html.lastIndexOf('</body>');
  if (end === -1) return { html, stateBytes, skipped: 'no </body>' };
  const tag = `<script type="application/json" id="${SNAPSHOT_STATE_ID}">${stateJson}</script>`;
  return { html: html.slice(0, end) + tag + html.slice(end), stateBytes };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run server/prerender-paths.test.ts`
Expected: PASS.

- [ ] **Step 5: Use it in the prerender**

In `scripts/prerender.ts`, add `attachSnapshotState` to the existing `../server/prerender-paths.js` import, then replace

```ts
      const html = await page.content();
      const validation = validateSnapshotHtml(html, route);
```

with

```ts
      const captured = await page.content();
      // Same moment as the HTML, so the data matches what was rendered.
      const stateJson = await page
        .evaluate(() => window.__ACE_DEHYDRATE__?.() ?? null)
        .catch(() => null);
      const { html, stateBytes, skipped } = attachSnapshotState(captured, stateJson);
      console.log(
        skipped
          ? `[hydration] ${route} state skipped: ${skipped}`
          : `[hydration] ${route} state=${Math.round(stateBytes / 1024)}KB`,
      );
      const validation = validateSnapshotHtml(html, route);
```

(`window.__ACE_DEHYDRATE__` is typed by the `declare global` in `client/src/lib/hydration.ts`; if `tsc` for `scripts/` doesn't see it, use `(window as unknown as { __ACE_DEHYDRATE__?: () => string }).__ACE_DEHYDRATE__?.()`.)

- [ ] **Step 6: Typecheck and full test run**

Run: `npm run check && npm test`
Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add server/prerender-paths.ts server/prerender-paths.test.ts scripts/prerender.ts
git commit -m "feat(prerender): embed each page's query state in its snapshot"
```

---

### Task 4: Client boots with hydrateRoot

**Files:**
- Modify: `client/src/main.tsx:1-6` (imports) and `:40-42` (boot)

**Interfaces:**
- Consumes: `bootMode`, `isEnglish`, `parseSnapshotState`, `serializeSnapshotState`, `shouldDehydrateQuery` (Task 1); `SNAPSHOT_STATE_ID` (Task 1); `queryClient` (`client/src/lib/queryClient.ts`); `i18n`, `syncLanguage`, `ensureLanguage` (`client/src/lib/i18n.ts`).
- Produces: `window.__ACE_DEHYDRATE__` (consumed by Task 3's prerender change).

- [ ] **Step 1: Replace the imports**

```tsx
import { createRoot, hydrateRoot } from "react-dom/client";
import { dehydrate, hydrate } from "@tanstack/react-query";
import App from "./App";
import "./index.css";
import i18n, { ensureLanguage, syncLanguage } from "./lib/i18n";
import { withCsrf } from "./lib/csrf-fetch";
import { ensureCsrfToken, getCsrfToken, queryClient } from "./lib/queryClient";
import {
  bootMode,
  isEnglish,
  parseSnapshotState,
  serializeSnapshotState,
  shouldDehydrateQuery,
} from "./lib/hydration";
import { SNAPSHOT_STATE_ID } from "@shared/snapshot-state";
```

Check `ensureLanguage` is exported from `client/src/lib/i18n.ts` (it is: `export const ensureLanguage = createLanguageLoader(...)`) and accepts a language code; if its signature differs, call `syncLanguage(visitorLanguage)` instead in Step 2.

- [ ] **Step 2: Replace the boot (last two statements of the file)**

```tsx
// scripts/prerender.ts calls this just before saving each page, so the snapshot
// carries the data it was rendered with (see client/src/lib/hydration.ts).
window.__ACE_DEHYDRATE__ = () => serializeSnapshotState(dehydrate(queryClient, { shouldDehydrateQuery }));

const rootElement = document.getElementById("root")!;
const snapshotState = parseSnapshotState(document.getElementById(SNAPSHOT_STATE_ID)?.textContent);

async function boot() {
  if (bootMode(rootElement.childElementCount > 0, snapshotState) === "hydrate") {
    // Adopt the prerendered HTML instead of replacing it. Snapshots are English, so
    // hydrate in English and switch to the visitor's language afterwards.
    hydrate(queryClient, snapshotState!);
    const visitorLanguage = i18n.resolvedLanguage ?? i18n.language;
    const switchLanguage = !isEnglish(visitorLanguage);
    const translations = switchLanguage ? ensureLanguage(visitorLanguage).catch(() => {}) : null;
    if (switchLanguage) await i18n.changeLanguage("en");
    hydrateRoot(rootElement, <App />, {
      onRecoverableError: (error) => console.warn("[hydration]", error),
    });
    if (translations) {
      await translations;
      setTimeout(() => void i18n.changeLanguage(visitorLanguage), 0);
    }
    return;
  }

  // SPA shell or snapshot without state: render from scratch. Non-English visitors
  // wait for their (small, lazily loaded) language file so the first render is
  // already translated; English renders immediately.
  const render = () => createRoot(rootElement).render(<App />);
  syncLanguage(i18n.language).then(render, render);
}

void boot();
```

- [ ] **Step 3: Typecheck and tests**

Run: `npm run check && npm test`
Expected: both exit 0.

- [ ] **Step 4: Build with prerender and check snapshots have state**

Run (sequentially; prerender needs the DB from `.env`):

```bash
npm run build 2>&1 | tee "$CLAUDE_JOB_DIR/tmp/build.log" | grep -E '^\[(hydration|ok|fail)\]' | head -80
```

Expected: every `[ok]` route also has a `[hydration] <route> state=NKB` line, none `skipped`, all under 150KB.

- [ ] **Step 5: Commit**

```bash
git add client/src/main.tsx
git commit -m "perf(client): hydrate prerendered pages instead of re-rendering them"
```

---

### Task 5: Hydration audit (browser) and mismatch fixes

**Files:**
- Create: `scripts/hydration-audit.ts`
- Modify: whichever components the audit reports (fix recipe in Step 5)

**Interfaces:**
- Consumes: a running production build at `BASE` (default `http://localhost:5055`).
- Produces: `npx tsx scripts/hydration-audit.ts` — exits 0 when every scenario passes, 1 otherwise; prints one line per route × scenario.

- [ ] **Step 1: Write the audit script**

`scripts/hydration-audit.ts`:

```ts
/**
 * Loads prerendered pages the way a phone does (CPU 4x slower) and fails if the
 * page ever goes blank during load or React reports a hydration mismatch.
 *
 *   BASE=http://localhost:5055 npx tsx scripts/hydration-audit.ts
 */
import { chromium, type Browser } from 'playwright';

const BASE = (process.env.BASE ?? 'http://localhost:5055').replace(/\/+$/, '');
const SETTLE_MS = Number(process.env.SETTLE_MS ?? 8000);

type Scenario = 'default' | 'fr' | 'dark' | 'stateless';
const SCENARIOS: Scenario[] = ['default', 'fr', 'dark', 'stateless'];
const HYDRATION_ERROR = /\[hydration\]|Hydration failed|hydrat|Minified React error #(418|419|421|423|425)/i;

async function routes(): Promise<string[]> {
  const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
  const all = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  const pick = (re: RegExp) => all.find((p) => re.test(p));
  return [
    '/',
    pick(/^\/tours\/[^/]+$/),
    pick(/^\/transfers\/[^/]+$/),
    '/port-vila-airport-transfers',
    pick(/^\/blog\/[^/]+$/),
  ].filter((p): p is string => Boolean(p));
}

async function audit(browser: Browser, route: string, scenario: Scenario) {
  const context = await browser.newContext({ viewport: { width: 412, height: 823 }, isMobile: true });
  if (scenario === 'fr') await context.addInitScript(() => localStorage.setItem('i18nextLng', 'fr'));
  if (scenario === 'dark') await context.addInitScript(() => localStorage.setItem('ace-theme', 'dark'));
  const page = await context.newPage();
  if (scenario === 'stateless') {
    // Simulates a snapshot seeded from an older deploy: no state block.
    await page.route(`${BASE}${route}`, async (r) => {
      const res = await r.fetch();
      const body = (await res.text()).replace(/<script type="application\/json" id="__ACE_QUERY_STATE__">[\s\S]*?<\/script>/, '');
      await r.fulfill({ response: res, body });
    });
  }
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  const problems: string[] = [];
  page.on('console', (m) => {
    if ((m.type() === 'warning' || m.type() === 'error') && HYDRATION_ERROR.test(m.text())) problems.push(m.text().slice(0, 200));
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message.slice(0, 200)}`));

  await page.addInitScript(() => {
    const w = window as unknown as { __minLen: number; __seen: boolean };
    w.__minLen = Infinity;
    w.__seen = false;
    const tick = () => {
      const len = document.getElementById('root')?.innerText.length ?? 0;
      if (len > 0) w.__seen = true;
      if (w.__seen) w.__minLen = Math.min(w.__minLen, len);
      setTimeout(tick, 20);
    };
    tick();
  });

  await page.goto(`${BASE}${route}`, { waitUntil: 'load' });
  await page.waitForTimeout(SETTLE_MS);
  const result = await page.evaluate(() => ({
    minLen: (window as unknown as { __minLen: number }).__minLen,
    lang: document.documentElement.lang,
    dark: document.documentElement.classList.contains('dark'),
    hasState: Boolean(document.getElementById('__ACE_QUERY_STATE__')),
    finalLen: document.getElementById('root')?.innerText.length ?? 0,
  }));
  await context.close();

  // The stateless path rebuilds from scratch (today's behaviour), so it may blank.
  if (scenario !== 'stateless' && result.minLen === 0) problems.push('root went blank during load');
  if (result.finalLen === 0) problems.push('page empty after load');
  if (scenario === 'fr' && !result.lang.startsWith('fr')) problems.push(`expected lang fr, got "${result.lang}"`);
  if (scenario === 'dark' && !result.dark) problems.push('expected dark theme');
  if (scenario !== 'stateless' && !result.hasState) problems.push('snapshot has no state block');
  return problems;
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
let failed = 0;
for (const route of await routes()) {
  for (const scenario of SCENARIOS) {
    const problems = await audit(browser, route, scenario);
    if (problems.length) failed++;
    console.log(`${problems.length ? 'FAIL' : 'ok  '} ${route} [${scenario}]${problems.length ? ' — ' + problems.join(' | ') : ''}`);
  }
}
await browser.close();
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Start the production build locally**

```bash
NODE_ENV=production PORT=5055 node dist/index.cjs > "$CLAUDE_JOB_DIR/tmp/server.log" 2>&1 &
until curl -sf http://localhost:5055/ >/dev/null; do sleep 1; done
```

(Run the `until` loop with a timeout or via Monitor; `dist/` is from Task 4 Step 4.)

- [ ] **Step 3: Run the audit**

Run: `BASE=http://localhost:5055 npx tsx scripts/hydration-audit.ts`
Expected first time: likely some `FAIL` lines with hydration messages — that is the point of this task. Record them.

- [ ] **Step 4: Check no private data in snapshots**

```bash
grep -l -E '"queryKey":\["(\\/api\\/)?(auth|users?|user-bookings|session|cart|csrf|bookings?|booking-|notifications)' -r dist/public --include=index.html || echo "clean"
```

Expected: `clean`.

- [ ] **Step 5: Fix each reported mismatch**

Production React reports minified errors (#418 etc.) without naming the component.
To see full messages, rebuild only the client with development React, restore the
shell copy, and re-prerender (the server bundle `dist/index.cjs` from Task 4 is reused):

```bash
kill %1   # stop the server from Step 2
npx vite build --mode development --minify false \
  && cp dist/public/index.html dist/public/spa-shell.html \
  && npm run prerender
```

Restart the server (Step 2) and re-run the audit; the console text now names the
differing element/text. Apply the fix that matches:

| cause | fix |
|---|---|
| render reads `localStorage` / `sessionStorage` / `matchMedia` / `window.innerWidth` | `useState(<prerender value>)` + set the real value in `useLayoutEffect` (pattern: Task 2's `ThemeProvider`) |
| render uses `new Date()` / `Date.now()` for displayed text | compute in `useEffect` into state, initial value = what the prerender showed is not knowable → render nothing for that text until the effect (`suppressHydrationWarning` only for a single text node like the footer year) |
| auth-dependent header items | already safe (`AuthProvider` starts `user=null`); if flagged, render the logged-out variant until `isLoading` is false |
| a query not in the state block (e.g. key includes a value that differs on the client) | make the key deterministic for the first render, or include the query in the state by fixing its key |

Footer year (`client/src/components/layout.tsx:782`, `new Date().getFullYear()`) is safe unless the snapshot crosses New Year; add `suppressHydrationWarning` to that `<p>` regardless.

After fixes: rebuild the same way, restart, re-run the audit. Repeat until all lines are `ok`, then do one final full production build (Task 4 Step 4 command), restart, and confirm the audit is still all `ok`.

- [ ] **Step 6: Interaction smoke test**

Against the local server (mobile viewport, Playwright with `/usr/bin/google-chrome`), on the tour page after load, check each and record pass/fail in the commit body:
- add the tour to the cart via the booking form → header cart badge shows `1`;
- currency selector → USD → the displayed price text changes from `VUV`/`Vt` to `$`;
- language selector → Français → the `<h1>`/nav text changes and `document.documentElement.lang` is `fr`;
- theme toggle → `document.documentElement.classList.contains('dark')` flips.
Any failure is a regression: fix before committing.

- [ ] **Step 7: Run unit tests and typecheck**

Run: `npm run check && npm test`
Expected: both exit 0.

- [ ] **Step 8: Commit**

```bash
git add scripts/hydration-audit.ts <each component file you fixed>
git commit -m "test(prerender): browser audit for blank loads and hydration mismatches; fix mismatches"
```

Stop the local server: `kill %1` (or the PID from Step 2).

---

### Task 6: Measure, then hand off for deploy

**Files:** none (measurements recorded in the final report / PR body)

- [ ] **Step 1: Lighthouse mobile, local build**

With the server from Task 5 running:

```bash
cd "$CLAUDE_JOB_DIR/tmp"
for p in "" "<tour path from the audit output>"; do
  CHROME_PATH=/usr/bin/google-chrome npx -y lighthouse@12 "http://localhost:5055/$p" --quiet \
    --chrome-flags="--headless=new" --only-categories=performance --output=json \
    --output-path="lh-after-$(echo ${p:-home} | tr / _ | cut -c1-16).json"
done
```

Extract score, FCP, LCP, TBT (`audits["first-contentful-paint"].displayValue` etc.). Note: local numbers aren't comparable 1:1 with the live baseline (different server); the meaningful check is the live run in Step 3.

- [ ] **Step 2: Ask the user before pushing**

Report audit results and local Lighthouse numbers; ask whether to merge `perf/prerender-hydration` into `main` and push (deploys to Render). Push command if SSH fails (passphrase key, no agent):

```bash
git -c credential.helper= -c credential.helper='!gh auth git-credential' push https://github.com/tanonda/Ace-Tours-Transfers.git main:main
```

- [ ] **Step 3: After deploy (prerender takes ~4 min after boot), verify live**

```bash
curl -s https://acetoursvanuatu.com/ | grep -c '__ACE_QUERY_STATE__'   # expect 1
BASE=https://acetoursvanuatu.com npx tsx scripts/hydration-audit.ts       # expect all ok
```

Then rerun Lighthouse mobile on `https://acetoursvanuatu.com/` and `/tours/f9be5daa-41e4-4cc3-a4ab-6076eda9add1` and compare with the spec's baseline table (score 0.27/0.28, FCP 6.1/7.1 s, LCP 8.5/10.1 s, TBT 3,130/1,850 ms).

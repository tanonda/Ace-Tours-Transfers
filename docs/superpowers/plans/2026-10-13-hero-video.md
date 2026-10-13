# Hero Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the admin add a silent background loop video and/or a YouTube/Instagram/Facebook Short to the Home hero, with tick boxes to add them to the Tours, Transfers and About heroes.

**Architecture:** All URL parsing and validation lives in one pure module, `shared/hero-video.ts`, used by the client, the server and the tests. The admin uploads video straight from the browser to Cloudinary with a server-signed request, so the server never holds the file. Settings are four ordinary `cms_content` rows (English, block `home-page`). On the public site, `PageHero` gains two optional props. The background `<video>` mounts only after hydration and only when the visitor's device allows it. The Short is a click-to-load card/dialog.

**Tech Stack:** React 18 + Vite + Tailwind + shadcn/ui, react-i18next, TanStack Query, Express + helmet, Cloudinary Node SDK v2, Vitest + supertest.

**Spec:** `docs/superpowers/specs/2026-10-13-hero-video-design.md`

## Global Constraints

- CMS keys, all in block `home-page`, locale `en` only: `hero_video`, `hero_short_url`, `hero_short_cover`, `hero_video_pages`.
- `hero_video_pages` is a comma list drawn only from `tours`, `transfers`, `about`. Home always shows the video settings.
- Background loop transformation: `ac_none,du_15,c_fill,ar_16:9,w_1280,q_auto:eco`; WebM then MP4 sources.
- The loop plays only when width ≥ 768 px, reduced motion is off, `saveData` is not true, and `effectiveType` is not `slow-2g`/`2g`. Phones always show the photo.
- The background `<video>` renders nothing on the server and on the first client render (hydration safety). The hero `<img>` stays first and unchanged.
- No YouTube/Instagram/Facebook iframe is created before the visitor clicks. YouTube uses `www.youtube-nocookie.com`.
- Admin upload: `video/mp4`, `video/webm`, `video/quicktime`, ≤ 100 MB, direct to `https://api.cloudinary.com/v1_1/<cloud>/video/upload`, folder `ace-tours/hero-video`.
- With no CMS values set, every hero must render exactly as today.
- The live DB is in local `.env`. Never run `npm run build` without `PRERENDER=0`. Never run a dev server against the live DB for writes; the admin check in Task 8 uses a Neon branch or is done after deploy.
- CI is billing-locked: run `npm run check` and `npm test` locally, one after the other (not in parallel), before any push. Do not push until the user says so.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

1. **Real-world Short links carry tracking junk** (`?si=…`, `?igsh=…`, `&feature=share`, trailing slashes, `m.` hosts). They must still parse. → Task 1 tests.
2. **Look-alike or unsafe links** (`youtube.com.evil.test`, `javascript:`, `http://` Cloudinary, another cloud's video) must be rejected, because the value ends up in an iframe `src` / `<video src>`. → Tasks 1 and 4 tests.
3. **The admin clears a setting** (empty string) to switch video off. The save must succeed and the hero must go back to the photo. → Tasks 1 and 4 tests.
4. **Odd Cloudinary URLs**: uppercase `.MOV`, names with dots, URLs that already contain transformations. The loop must still produce `.webm`/`.mp4`/`.jpg` URLs with our transform first. → Task 1 tests.
5. **Hero video settings saved under a non-English locale** would silently drift by language. The server must reject them. → Task 4 test.

---

## File Structure

| File | Responsibility |
|---|---|
| `shared/hero-video.ts` (new) | Pure logic: Short URL parsing, Cloudinary loop URLs, page list, play rule, setting validation, resolving settings for a page |
| `shared/hero-video.test.ts` (new) | Unit tests for the above |
| `server/lib/hero-video-csp.ts` (new) | The CSP origins this feature adds (one place, testable) |
| `server/lib/hero-video-csp.test.ts` (new) | CSP test |
| `server/index.ts` (modify) | Spread those origins into helmet's directives |
| `server/infrastructure/storage/cloudinary-service.ts` (modify) | `cloudName()`, `signVideoUpload(folder)` |
| `server/infrastructure/storage/cloudinary-service.test.ts` (new) | Signature test |
| `server/routes/catalog.routes.ts` (modify) | `POST /api/admin/uploads/video-signature` |
| `server/routes/video-signature.routes.test.ts` (new) | Endpoint tests |
| `server/routes/site.routes.ts` (modify) | Validate hero-video rows on create/patch; block auto-translate for them |
| `server/routes/cms-hero-video.routes.test.ts` (new) | Validation wiring tests |
| `client/src/hooks/use-hero-video.ts` (new) | Read CMS settings for a page |
| `client/src/components/hero-background-video.tsx` (new) | The muted loop |
| `client/src/components/hero-short.tsx` (new) | Phone card (desktop) + pill/dialog (mobile) |
| `client/src/lib/hero-video-render.test.ts` (new) | Server-render (first render) safety of both components |
| `client/src/locales/{en,fr,es,zh,bi}.json` (modify) | `hero.watchVideo`, `hero.watchOn` |
| `client/src/components/page-hero.tsx` (modify) | `video` / `short` props |
| `client/src/components/hero.tsx`, `client/src/pages/{tours,transfers,about}.tsx` (modify) | Pass `useHeroVideo(page)` |
| `client/src/lib/api.ts` (modify) | `uploadHeroVideo(file, onProgress)` |
| `client/src/components/admin/hero-video-settings.tsx` (new) | Admin card for the four settings |
| `client/src/pages/admin/cms.tsx` (modify) | Render the card on the Home Page tab |
| `docs/CLIENT_HANDOVER.md` (modify) | "Hero video" how-to |

Refinement of the spec, same behaviour: the spec describes new admin field types `video`/`checklist`. The plan instead uses one dedicated `HeroVideoSettings` card on the Home Page tab. The generic field loop in `cms.tsx` attaches translate buttons and previews to every field, which these settings must not have. Keys and values are exactly as specified. Facebook `fb.watch/…` short links are rejected with a clear message, because they are opaque redirects with no video id to embed. The admin is asked to paste the full `facebook.com` address instead.

---

### Task 1: Pure hero-video logic (`shared/hero-video.ts`)

**Files:**
- Create: `shared/hero-video.ts`
- Test: `shared/hero-video.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (exact exports):
  - `HERO_VIDEO_BLOCK = "home-page"`
  - `HERO_VIDEO_KEYS = { video: "hero_video", shortUrl: "hero_short_url", shortCover: "hero_short_cover", pages: "hero_video_pages" } as const`
  - `type HeroVideoKey`, `isHeroVideoKey(key: string): key is HeroVideoKey`
  - `type ShortPlatform = "youtube" | "instagram" | "facebook"`
  - `interface ShortEmbed { platform: ShortPlatform; id: string; embedUrl: string; thumbnailUrl: string | null; watchUrl: string }`
  - `parseShortUrl(input: string | null | undefined): ShortEmbed | null`
  - `SHORT_PLATFORM_NAME: Record<ShortPlatform, string>`
  - `interface LoopSources { webm: string; mp4: string; poster: string }`
  - `cloudinaryLoopSources(url: string | null | undefined): LoopSources | null`
  - `isOwnCloudinaryVideo(url: string, cloudName: string): boolean`
  - `HERO_VIDEO_EXTRA_PAGES = ["tours", "transfers", "about"] as const`, `type HeroVideoExtraPage`, `type HeroVideoPage = "home" | HeroVideoExtraPage`
  - `heroVideoPages(value: string | null | undefined): Set<HeroVideoExtraPage>`
  - `LOOP_MIN_WIDTH = 768`
  - `interface LoopEnv { width: number; reducedMotion: boolean; saveData?: boolean; effectiveType?: string }`, `shouldPlayLoop(env: LoopEnv): boolean`
  - `heroVideoSettingError(row: { blockSlug: string; key: string; value: string | null | undefined; locale?: string | null }, cloudName: string | null): string | null`
  - `interface HeroShortData extends ShortEmbed { cover: string | null }`
  - `interface HeroVideoSettings { loop: LoopSources | null; short: HeroShortData | null }`
  - `resolveHeroVideo(page: HeroVideoPage, read: (key: HeroVideoKey) => string): HeroVideoSettings`

- [ ] **Step 1: Write the failing tests**

`shared/hero-video.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  parseShortUrl,
  cloudinaryLoopSources,
  isOwnCloudinaryVideo,
  heroVideoPages,
  shouldPlayLoop,
  heroVideoSettingError,
  resolveHeroVideo,
  HERO_VIDEO_KEYS,
  type HeroVideoKey,
} from "./hero-video";

const YT = "dQw4w9WgXcQ";

describe("parseShortUrl — YouTube", () => {
  it.each([
    `https://www.youtube.com/shorts/${YT}`,
    `https://youtube.com/shorts/${YT}?si=AbCdEf123`,
    `https://m.youtube.com/shorts/${YT}/`,
    `https://youtu.be/${YT}`,
    `https://youtu.be/${YT}?si=xyz`,
    `https://www.youtube.com/watch?v=${YT}&feature=share`,
    `  https://www.youtube.com/shorts/${YT}  `,
  ])("parses %s", (url) => {
    const s = parseShortUrl(url);
    expect(s).toMatchObject({ platform: "youtube", id: YT });
    expect(s!.embedUrl).toBe(`https://www.youtube-nocookie.com/embed/${YT}?autoplay=1&playsinline=1&rel=0`);
    expect(s!.thumbnailUrl).toBe(`https://i.ytimg.com/vi/${YT}/hqdefault.jpg`);
    expect(s!.watchUrl).toBe(`https://www.youtube.com/watch?v=${YT}`);
  });

  it.each([
    "https://www.youtube.com/shorts/short",           // id too short
    `https://www.youtube.com/shorts/${YT}"onload=x`,  // junk in id
    "https://www.youtube.com/channel/UC123",
    `https://youtube.com.evil.test/shorts/${YT}`,
    `https://evilyoutube.com/shorts/${YT}`,
  ])("rejects %s", (url) => expect(parseShortUrl(url)).toBeNull());
});

describe("parseShortUrl — Instagram", () => {
  it.each([
    ["https://www.instagram.com/reel/C9xYz_ab-12/", "reel"],
    ["https://instagram.com/reels/C9xYz_ab-12?igsh=abc", "reel"],
    ["https://www.instagram.com/p/C9xYz_ab-12/", "p"],
  ])("parses %s", (url, kind) => {
    const s = parseShortUrl(url);
    expect(s).toMatchObject({ platform: "instagram", id: "C9xYz_ab-12", thumbnailUrl: null });
    expect(s!.embedUrl).toBe(`https://www.instagram.com/${kind}/C9xYz_ab-12/embed`);
    expect(s!.watchUrl).toBe(`https://www.instagram.com/${kind}/C9xYz_ab-12/`);
  });

  it("rejects profile links", () => expect(parseShortUrl("https://www.instagram.com/acetours/")).toBeNull());
});

describe("parseShortUrl — Facebook", () => {
  it("parses a reel", () => {
    const s = parseShortUrl("https://www.facebook.com/reel/1234567890123?mibextid=abc");
    expect(s).toMatchObject({ platform: "facebook", id: "1234567890123", thumbnailUrl: null, watchUrl: "https://www.facebook.com/reel/1234567890123" });
    expect(s!.embedUrl).toBe(
      "https://www.facebook.com/plugins/video.php?href=" +
        encodeURIComponent("https://www.facebook.com/reel/1234567890123") +
        "&show_text=false&autoplay=true",
    );
  });

  it("parses a page video", () => {
    expect(parseShortUrl("https://m.facebook.com/AceTours.Vanuatu/videos/987654321098/")).toMatchObject({
      platform: "facebook",
      id: "987654321098",
      watchUrl: "https://www.facebook.com/AceTours.Vanuatu/videos/987654321098",
    });
  });

  it("parses watch?v=", () => {
    expect(parseShortUrl("https://www.facebook.com/watch/?v=555555555555")).toMatchObject({
      platform: "facebook",
      watchUrl: "https://www.facebook.com/watch/?v=555555555555",
    });
  });

  it.each([
    "https://fb.watch/abcDEF/",                        // opaque short link: no id
    "https://www.facebook.com/reel/notanumber",
    "https://www.facebook.com/AceTours",
  ])("rejects %s", (url) => expect(parseShortUrl(url)).toBeNull());
});

describe("parseShortUrl — junk", () => {
  it.each(["", "   ", null, undefined, "not a url", "javascript:alert(1)", "ftp://youtu.be/dQw4w9WgXcQ", "https://vimeo.com/123"])(
    "rejects %s",
    (v) => expect(parseShortUrl(v as string)).toBeNull(),
  );
});

describe("cloudinaryLoopSources", () => {
  const T = "ac_none,du_15,c_fill,ar_16:9,w_1280,q_auto:eco";

  it("builds webm, mp4 and poster URLs", () => {
    expect(cloudinaryLoopSources("https://res.cloudinary.com/dwro1dh5q/video/upload/v1765/ace-tours/hero-video/clip.mov")).toEqual({
      webm: `https://res.cloudinary.com/dwro1dh5q/video/upload/${T}/v1765/ace-tours/hero-video/clip.webm`,
      mp4: `https://res.cloudinary.com/dwro1dh5q/video/upload/${T}/v1765/ace-tours/hero-video/clip.mp4`,
      poster: "https://res.cloudinary.com/dwro1dh5q/video/upload/so_0,c_fill,ar_16:9,w_1280,q_auto/v1765/ace-tours/hero-video/clip.jpg",
    });
  });

  it("handles uppercase extensions and dotted names", () => {
    const s = cloudinaryLoopSources("https://res.cloudinary.com/demo/video/upload/v1/beach.day.2.MOV")!;
    expect(s.mp4).toBe(`https://res.cloudinary.com/demo/video/upload/${T}/v1/beach.day.2.mp4`);
  });

  it("puts our transform first even if the URL already has one", () => {
    const s = cloudinaryLoopSources("https://res.cloudinary.com/demo/video/upload/q_auto/v1/clip.mp4")!;
    expect(s.webm).toBe(`https://res.cloudinary.com/demo/video/upload/${T}/q_auto/v1/clip.webm`);
  });

  it.each([
    "",
    null,
    "https://res.cloudinary.com/demo/image/upload/v1/photo.jpg",
    "http://res.cloudinary.com/demo/video/upload/v1/clip.mp4",
    "https://evil.test/demo/video/upload/v1/clip.mp4",
    'https://res.cloudinary.com/demo/video/upload/v1/cl"ip.mp4',
    "https://res.cloudinary.com/demo/video/upload/v1/clip",
  ])("rejects %s", (u) => expect(cloudinaryLoopSources(u as string)).toBeNull());
});

describe("isOwnCloudinaryVideo", () => {
  it("accepts our cloud only", () => {
    expect(isOwnCloudinaryVideo("https://res.cloudinary.com/ours/video/upload/v1/a.mp4", "ours")).toBe(true);
    expect(isOwnCloudinaryVideo("https://res.cloudinary.com/theirs/video/upload/v1/a.mp4", "ours")).toBe(false);
    expect(isOwnCloudinaryVideo("https://res.cloudinary.com/ours/image/upload/v1/a.jpg", "ours")).toBe(false);
  });
});

describe("heroVideoPages", () => {
  it("parses a comma list and ignores unknown or blank ids", () => {
    expect([...heroVideoPages(" tours, About ,contact,,")]).toEqual(["tours", "about"]);
    expect(heroVideoPages("").size).toBe(0);
    expect(heroVideoPages(null).size).toBe(0);
  });
});

describe("shouldPlayLoop", () => {
  const ok = { width: 1280, reducedMotion: false };
  it("plays on a wide screen with no restrictions", () => expect(shouldPlayLoop(ok)).toBe(true));
  it("plays at exactly 768", () => expect(shouldPlayLoop({ ...ok, width: 768 })).toBe(true));
  it("never on phones", () => expect(shouldPlayLoop({ ...ok, width: 767 })).toBe(false));
  it("not with reduced motion", () => expect(shouldPlayLoop({ ...ok, reducedMotion: true })).toBe(false));
  it("not with data saver", () => expect(shouldPlayLoop({ ...ok, saveData: true })).toBe(false));
  it.each(["slow-2g", "2g"])("not on %s", (t) => expect(shouldPlayLoop({ ...ok, effectiveType: t })).toBe(false));
  it("on 3g/4g", () => expect(shouldPlayLoop({ ...ok, effectiveType: "4g" })).toBe(true));
});

describe("heroVideoSettingError", () => {
  const row = (key: string, value: string, extra: object = {}) => ({ blockSlug: "home-page", key, value, locale: "en", ...extra });
  const OWN = "https://res.cloudinary.com/ours/video/upload/v1/a.mp4";

  it("ignores other keys and blocks", () => {
    expect(heroVideoSettingError(row("hero_title_part1", "anything"), "ours")).toBeNull();
    expect(heroVideoSettingError({ blockSlug: "about", key: "hero_video", value: "x" }, "ours")).toBeNull();
  });

  it("allows clearing every setting", () => {
    for (const key of Object.values(HERO_VIDEO_KEYS)) expect(heroVideoSettingError(row(key, ""), "ours")).toBeNull();
    expect(heroVideoSettingError(row("hero_video", "   "), null)).toBeNull();
  });

  it("requires our own Cloudinary video", () => {
    expect(heroVideoSettingError(row("hero_video", OWN), "ours")).toBeNull();
    expect(heroVideoSettingError(row("hero_video", "https://res.cloudinary.com/theirs/video/upload/v1/a.mp4"), "ours")).toMatch(/uploaded here/);
    expect(heroVideoSettingError(row("hero_video", OWN), null)).toMatch(/isn't set up/);
  });

  it("requires a parseable Short link", () => {
    expect(heroVideoSettingError(row("hero_short_url", `https://youtu.be/${YT}`), "ours")).toBeNull();
    expect(heroVideoSettingError(row("hero_short_url", "https://fb.watch/abc"), "ours")).toMatch(/YouTube, Instagram or Facebook/);
  });

  it("requires a Cloudinary cover image", () => {
    expect(heroVideoSettingError(row("hero_short_cover", "https://res.cloudinary.com/ours/image/upload/v1/c.jpg"), "ours")).toBeNull();
    expect(heroVideoSettingError(row("hero_short_cover", "https://evil.test/c.jpg"), "ours")).toMatch(/cover image/);
  });

  it("only accepts known pages", () => {
    expect(heroVideoSettingError(row("hero_video_pages", "tours,about"), "ours")).toBeNull();
    expect(heroVideoSettingError(row("hero_video_pages", "tours,contact"), "ours")).toMatch(/Tours, Transfers or About/);
  });

  it("rejects non-English rows", () => {
    expect(heroVideoSettingError(row("hero_short_url", "", { locale: "fr" }), "ours")).toMatch(/English/);
  });
});

describe("resolveHeroVideo", () => {
  const settings = (v: Partial<Record<HeroVideoKey, string>>) => (key: HeroVideoKey) => v[key] ?? "";
  const VIDEO = "https://res.cloudinary.com/ours/video/upload/v1/a.mp4";

  it("is empty when nothing is set", () => {
    expect(resolveHeroVideo("home", settings({}))).toEqual({ loop: null, short: null });
  });

  it("always applies to home", () => {
    const r = resolveHeroVideo("home", settings({ hero_video: VIDEO, hero_short_url: `https://youtu.be/${YT}` }));
    expect(r.loop?.mp4).toContain("/a.mp4");
    expect(r.short).toMatchObject({ platform: "youtube", cover: null });
  });

  it("applies to other pages only when ticked", () => {
    const base = { hero_video: VIDEO, hero_video_pages: "tours" };
    expect(resolveHeroVideo("tours", settings(base)).loop).not.toBeNull();
    expect(resolveHeroVideo("about", settings(base))).toEqual({ loop: null, short: null });
  });

  it("uses the admin cover when set", () => {
    const r = resolveHeroVideo("home", settings({ hero_short_url: "https://www.instagram.com/reel/C9xYz_ab-12/", hero_short_cover: "https://res.cloudinary.com/ours/image/upload/v1/c.jpg" }));
    expect(r.short?.cover).toBe("https://res.cloudinary.com/ours/image/upload/v1/c.jpg");
  });

  it("drops invalid values instead of failing", () => {
    expect(resolveHeroVideo("home", settings({ hero_video: "https://evil.test/a.mp4", hero_short_url: "nope" }))).toEqual({ loop: null, short: null });
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run shared/hero-video.test.ts`
Expected: FAIL. The module `./hero-video` cannot be resolved.

- [ ] **Step 3: Implement `shared/hero-video.ts`**

```ts
/**
 * Hero video: the background loop and the embedded Short shown in page heroes.
 *
 * Settings are four cms_content rows (block "home-page", English only, see
 * HERO_VIDEO_KEYS). Everything that turns those values into URLs, and every check
 * on them, lives here so the admin, the server and the storefront agree. Values the
 * admin types end up in <video src> and <iframe src>, so nothing is built from them
 * until it has matched a strict pattern.
 */

export const HERO_VIDEO_BLOCK = "home-page";

export const HERO_VIDEO_KEYS = {
  video: "hero_video",
  shortUrl: "hero_short_url",
  shortCover: "hero_short_cover",
  pages: "hero_video_pages",
} as const;

export type HeroVideoKey = (typeof HERO_VIDEO_KEYS)[keyof typeof HERO_VIDEO_KEYS];

const KEY_SET = new Set<string>(Object.values(HERO_VIDEO_KEYS));
export function isHeroVideoKey(key: string): key is HeroVideoKey {
  return KEY_SET.has(key);
}

// ─── Shorts ──────────────────────────────────────────────────────────────────

export type ShortPlatform = "youtube" | "instagram" | "facebook";

export const SHORT_PLATFORM_NAME: Record<ShortPlatform, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  facebook: "Facebook",
};

export interface ShortEmbed {
  platform: ShortPlatform;
  id: string;
  embedUrl: string;
  thumbnailUrl: string | null;
  watchUrl: string;
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const IG_ID = /^[A-Za-z0-9_-]{5,40}$/;
const FB_ID = /^\d{5,25}$/;
const FB_PAGE = /^[A-Za-z0-9.-]{1,80}$/;

const YT_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);
const IG_HOSTS = new Set(["instagram.com", "www.instagram.com"]);
const FB_HOSTS = new Set(["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com"]);

function youtube(id: string | null | undefined): ShortEmbed | null {
  if (!id || !YT_ID.test(id)) return null;
  return {
    platform: "youtube",
    id,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0`,
    thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    watchUrl: `https://www.youtube.com/watch?v=${id}`,
  };
}

function instagram(kind: "reel" | "p", id: string | undefined): ShortEmbed | null {
  if (!id || !IG_ID.test(id)) return null;
  return {
    platform: "instagram",
    id,
    embedUrl: `https://www.instagram.com/${kind}/${id}/embed`,
    thumbnailUrl: null,
    watchUrl: `https://www.instagram.com/${kind}/${id}/`,
  };
}

function facebook(id: string | null | undefined, canonical: (id: string) => string): ShortEmbed | null {
  if (!id || !FB_ID.test(id)) return null;
  const watchUrl = canonical(id);
  return {
    platform: "facebook",
    id,
    embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(watchUrl)}&show_text=false&autoplay=true`,
    thumbnailUrl: null,
    watchUrl,
  };
}

/** A YouTube Short/video, Instagram reel/post or Facebook reel/video link → embed details, or null. */
export function parseShortUrl(input: string | null | undefined): ShortEmbed | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "youtu.be") return youtube(parts[0]);
  if (YT_HOSTS.has(host)) {
    if (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live") return youtube(parts[1]);
    if (parts[0] === "watch") return youtube(url.searchParams.get("v"));
    return null;
  }
  if (IG_HOSTS.has(host)) {
    if (parts[0] === "reel" || parts[0] === "reels") return instagram("reel", parts[1]);
    if (parts[0] === "p") return instagram("p", parts[1]);
    return null;
  }
  if (FB_HOSTS.has(host)) {
    if (parts[0] === "reel") return facebook(parts[1], (id) => `https://www.facebook.com/reel/${id}`);
    if (parts[0] === "watch") return facebook(url.searchParams.get("v"), (id) => `https://www.facebook.com/watch/?v=${id}`);
    if (parts[1] === "videos" && FB_PAGE.test(parts[0] ?? "")) {
      return facebook(parts[2], (id) => `https://www.facebook.com/${parts[0]}/videos/${id}`);
    }
    return null;
  }
  return null;
}

// ─── Background loop ─────────────────────────────────────────────────────────

export interface LoopSources {
  webm: string;
  mp4: string;
  poster: string;
}

// Silent, first 15 s, 16:9 at 1280 px, economy quality: a 50 MB upload plays as ~2–4 MB.
const LOOP_TRANSFORM = "ac_none,du_15,c_fill,ar_16:9,w_1280,q_auto:eco";
const POSTER_TRANSFORM = "so_0,c_fill,ar_16:9,w_1280,q_auto";
const CLD_VIDEO = /^https:\/\/res\.cloudinary\.com\/([a-z0-9_-]+)\/video\/upload\/([A-Za-z0-9_\-./:,]+)\.([A-Za-z0-9]{2,5})$/;

/** Delivery URLs for the hero loop, from the Cloudinary URL of the original upload. */
export function cloudinaryLoopSources(url: string | null | undefined): LoopSources | null {
  const m = CLD_VIDEO.exec((url ?? "").trim());
  if (!m) return null;
  const [, cloud, path] = m;
  const root = `https://res.cloudinary.com/${cloud}/video/upload`;
  return {
    webm: `${root}/${LOOP_TRANSFORM}/${path}.webm`,
    mp4: `${root}/${LOOP_TRANSFORM}/${path}.mp4`,
    poster: `${root}/${POSTER_TRANSFORM}/${path}.jpg`,
  };
}

export function isOwnCloudinaryVideo(url: string, cloudName: string): boolean {
  return cloudinaryLoopSources(url) !== null && url.trim().startsWith(`https://res.cloudinary.com/${cloudName}/video/upload/`);
}

// ─── Pages ───────────────────────────────────────────────────────────────────

export const HERO_VIDEO_EXTRA_PAGES = ["tours", "transfers", "about"] as const;
export type HeroVideoExtraPage = (typeof HERO_VIDEO_EXTRA_PAGES)[number];
export type HeroVideoPage = "home" | HeroVideoExtraPage;

/** The comma list saved by the "Also show on" tick boxes. */
export function heroVideoPages(value: string | null | undefined): Set<HeroVideoExtraPage> {
  const wanted = new Set((value ?? "").split(",").map((p) => p.trim().toLowerCase()));
  return new Set(HERO_VIDEO_EXTRA_PAGES.filter((p) => wanted.has(p)));
}

// ─── When the loop may play ──────────────────────────────────────────────────

export const LOOP_MIN_WIDTH = 768;

export interface LoopEnv {
  width: number;
  reducedMotion: boolean;
  saveData?: boolean;
  effectiveType?: string;
}

/** Tablets and computers only; never with reduced motion, data saver or a 2G connection. */
export function shouldPlayLoop(env: LoopEnv): boolean {
  if (env.width < LOOP_MIN_WIDTH) return false;
  if (env.reducedMotion) return false;
  if (env.saveData === true) return false;
  if (env.effectiveType === "slow-2g" || env.effectiveType === "2g") return false;
  return true;
}

// ─── Validation (server, on save) ────────────────────────────────────────────

/** Why a hero-video CMS row can't be saved, or null if it can (or isn't a hero-video row). */
export function heroVideoSettingError(
  row: { blockSlug: string; key: string; value: string | null | undefined; locale?: string | null },
  cloudName: string | null,
): string | null {
  if (row.blockSlug !== HERO_VIDEO_BLOCK || !isHeroVideoKey(row.key)) return null;
  if ((row.locale ?? "en") !== "en") return "Hero video settings apply to every language: save them in English.";
  const value = (row.value ?? "").trim();
  if (!value) return null;

  switch (row.key) {
    case HERO_VIDEO_KEYS.video:
      if (!cloudName) return "Video upload isn't set up (Cloudinary is not configured).";
      return isOwnCloudinaryVideo(value, cloudName) ? null : "The background video must be uploaded here (it is stored on Cloudinary).";
    case HERO_VIDEO_KEYS.shortUrl:
      return parseShortUrl(value) ? null : "Paste a YouTube, Instagram or Facebook video link (for Facebook, the full facebook.com address).";
    case HERO_VIDEO_KEYS.shortCover:
      return value.startsWith("https://res.cloudinary.com/") ? null : "The cover image must be uploaded here.";
    case HERO_VIDEO_KEYS.pages: {
      const items = value.split(",").map((p) => p.trim()).filter(Boolean);
      return items.length === heroVideoPages(value).size ? null : "Pages must be Tours, Transfers or About.";
    }
  }
  return null;
}

// ─── Resolving what a page shows ─────────────────────────────────────────────

export interface HeroShortData extends ShortEmbed {
  cover: string | null;
}

export interface HeroVideoSettings {
  loop: LoopSources | null;
  short: HeroShortData | null;
}

/** What the hero on `page` shows, given a reader for the saved settings. Invalid values mean "nothing". */
export function resolveHeroVideo(page: HeroVideoPage, read: (key: HeroVideoKey) => string): HeroVideoSettings {
  if (page !== "home" && !heroVideoPages(read(HERO_VIDEO_KEYS.pages)).has(page)) return { loop: null, short: null };
  const embed = parseShortUrl(read(HERO_VIDEO_KEYS.shortUrl));
  const cover = read(HERO_VIDEO_KEYS.shortCover).trim();
  return {
    loop: cloudinaryLoopSources(read(HERO_VIDEO_KEYS.video)),
    short: embed ? { ...embed, cover: cover.startsWith("https://res.cloudinary.com/") ? cover : null } : null,
  };
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run shared/hero-video.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add shared/hero-video.ts shared/hero-video.test.ts
git commit -m "feat(hero-video): shared parsing, URL building and validation

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: CSP origins for video, embeds and direct upload

**Files:**
- Create: `server/lib/hero-video-csp.ts`
- Test: `server/lib/hero-video-csp.test.ts`
- Modify: `server/index.ts` (helmet directives, about lines 93–152)

**Interfaces:**
- Produces: `HERO_VIDEO_CSP: { mediaSrc: string[]; frameSrc: string[]; imgSrc: string[]; connectSrc: string[] }`

- [ ] **Step 1: Write the failing test**

`server/lib/hero-video-csp.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { HERO_VIDEO_CSP } from "./hero-video-csp.js";

describe("HERO_VIDEO_CSP", () => {
  it("allows Cloudinary video playback", () => {
    expect(HERO_VIDEO_CSP.mediaSrc).toEqual(["'self'", "https://res.cloudinary.com"]);
  });
  it("allows the three Short players and nothing broader", () => {
    expect(HERO_VIDEO_CSP.frameSrc).toEqual(["https://www.youtube-nocookie.com", "https://www.instagram.com", "https://www.facebook.com"]);
    expect(HERO_VIDEO_CSP.frameSrc.some((s) => s.includes("*"))).toBe(false);
  });
  it("allows YouTube thumbnails and the admin's direct upload", () => {
    expect(HERO_VIDEO_CSP.imgSrc).toEqual(["https://i.ytimg.com"]);
    expect(HERO_VIDEO_CSP.connectSrc).toEqual(["https://api.cloudinary.com"]);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run server/lib/hero-video-csp.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement and wire in**

`server/lib/hero-video-csp.ts`:

```ts
/**
 * CSP sources the hero video needs (see shared/hero-video.ts):
 * - media: the background loop, served by Cloudinary
 * - frames: the Short players, created only when a visitor clicks play
 * - images: YouTube's thumbnail for the Short card
 * - connect: the admin's browser uploads the video straight to Cloudinary
 */
export const HERO_VIDEO_CSP = {
  mediaSrc: ["'self'", "https://res.cloudinary.com"],
  frameSrc: ["https://www.youtube-nocookie.com", "https://www.instagram.com", "https://www.facebook.com"],
  imgSrc: ["https://i.ytimg.com"],
  connectSrc: ["https://api.cloudinary.com"],
};
```

In `server/index.ts`, add the import next to the other local imports:

```ts
import { HERO_VIDEO_CSP } from "./lib/hero-video-csp.js";
```

Then edit the helmet directives:
- At the end of the `imgSrc` array, add `...HERO_VIDEO_CSP.imgSrc, // hero Short thumbnails`
- In `connectSrc`, add `...HERO_VIDEO_CSP.connectSrc, // admin hero-video upload` right after `"https://res.cloudinary.com",`
- At the end of the `frameSrc` array, add `...HERO_VIDEO_CSP.frameSrc, // hero Short players (click to load)`
- Add a new directive right after `fontSrc`: `mediaSrc: HERO_VIDEO_CSP.mediaSrc, // hero background loop`

- [ ] **Step 4: Run tests and type-check**

Run: `npx vitest run server/lib/hero-video-csp.test.ts && npm run check`
Expected: PASS; tsc reports no errors.

- [ ] **Step 5: Commit**

```bash
git add server/lib/hero-video-csp.ts server/lib/hero-video-csp.test.ts server/index.ts
git commit -m "feat(csp): allow hero video media, Short players and direct Cloudinary upload

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Signed direct-upload endpoint

**Files:**
- Modify: `server/infrastructure/storage/cloudinary-service.ts` (add two methods to `CloudinaryService`)
- Create: `server/infrastructure/storage/cloudinary-service.test.ts`
- Modify: `server/routes/catalog.routes.ts` (new route right after `POST /api/admin/upload`)
- Create: `server/routes/video-signature.routes.test.ts`

**Interfaces:**
- Produces:
  - `CloudinaryService.cloudName(): string | null`
  - `CloudinaryService.signVideoUpload(folder: string): VideoUploadSignature`
  - exported `interface VideoUploadSignature { cloudName: string; apiKey: string; timestamp: number; folder: string; signature: string }` (from cloudinary-service.ts)
  - `POST /api/admin/uploads/video-signature` → 200 `VideoUploadSignature` (folder `ace-tours/hero-video`) | 401/403 non-admin | 503 `{ error }` when not configured

- [ ] **Step 1: Write the failing service test**

`server/infrastructure/storage/cloudinary-service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { v2 as cloudinary } from "cloudinary";

const cfg = vi.hoisted(() => ({ enabled: true }));
vi.mock("../../config.js", () => ({ config: { cloudinary: cfg } }));

beforeEach(() => {
  cloudinary.config({ cloud_name: "demo-cloud", api_key: "123456", api_secret: "shh-secret" });
});

describe("CloudinaryService.signVideoUpload", () => {
  it("signs folder + timestamp with the API secret", async () => {
    const { CloudinaryService } = await import("./cloudinary-service.js");
    const sig = new CloudinaryService().signVideoUpload("ace-tours/hero-video");
    expect(sig).toMatchObject({ cloudName: "demo-cloud", apiKey: "123456", folder: "ace-tours/hero-video" });
    expect(Math.abs(sig.timestamp - Date.now() / 1000)).toBeLessThan(5);
    expect(sig.signature).toBe(cloudinary.utils.api_sign_request({ folder: "ace-tours/hero-video", timestamp: sig.timestamp }, "shh-secret"));
    expect(JSON.stringify(sig)).not.toContain("shh-secret");
  });

  it("reports the cloud name", async () => {
    const { CloudinaryService } = await import("./cloudinary-service.js");
    expect(new CloudinaryService().cloudName()).toBe("demo-cloud");
  });

  it("throws and has no cloud name when disabled", async () => {
    cfg.enabled = false;
    const { CloudinaryService } = await import("./cloudinary-service.js");
    const svc = new CloudinaryService();
    expect(svc.cloudName()).toBeNull();
    expect(() => svc.signVideoUpload("x")).toThrow(/not enabled/);
    cfg.enabled = true;
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run server/infrastructure/storage/cloudinary-service.test.ts`
Expected: FAIL (`signVideoUpload is not a function`).

- [ ] **Step 3: Implement the service methods**

In `cloudinary-service.ts`, above the class add:

```ts
export interface VideoUploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
}
```

Inside the class, after `uploadImage`, add:

```ts
  /** Our Cloudinary cloud name (from CLOUDINARY_URL), or null when uploads aren't configured. */
  cloudName(): string | null {
    if (!this.enabled) return null;
    return cloudinary.config().cloud_name ?? null;
  }

  /**
   * Signed parameters for one direct browser upload into `folder`. Large files (the
   * hero video) go straight from the admin's browser to Cloudinary and never pass
   * through this 512 MB server. The API secret stays here; only the signature leaves.
   */
  signVideoUpload(folder: string): VideoUploadSignature {
    const { cloud_name, api_key, api_secret } = cloudinary.config();
    if (!this.enabled || !cloud_name || !api_key || !api_secret) {
      throw new Error("Cloudinary service is not enabled. Please set CLOUDINARY_URL.");
    }
    const timestamp = Math.round(Date.now() / 1000);
    const signature = cloudinary.utils.api_sign_request({ folder, timestamp }, api_secret);
    return { cloudName: cloud_name, apiKey: api_key, timestamp, folder, signature };
  }
```

Run: `npx vitest run server/infrastructure/storage/cloudinary-service.test.ts`
Expected: PASS.

- [ ] **Step 4: Write the failing route test**

`server/routes/video-signature.routes.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";

const state = vi.hoisted(() => ({ sign: null as unknown as ReturnType<typeof import("vitest").vi.fn> }));

vi.mock("../storage.js", () => ({
  storage: {
    getUser: async (id: string) =>
      id === "admin1" ? { id, role: "admin", isActive: true } : id === "cust1" ? { id, role: "customer", isActive: true } : undefined,
  },
}));
vi.mock("../lib/product-translation.service.js", () => ({ withProductTranslations: async (p: unknown) => p }));
vi.mock("../infrastructure/storage/cloudinary-service.js", async () => {
  const { vi: v } = await import("vitest");
  state.sign = v.fn();
  return { cloudinaryService: { signVideoUpload: state.sign, uploadImage: v.fn(), cloudName: () => "demo-cloud" } };
});

async function makeApp(userId?: string, role?: string) {
  const { registerCatalogRoutes } = await import("./catalog.routes.js");
  const app = express();
  app.use(express.json());
  app.use(session({ secret: "test", resave: false, saveUninitialized: true }));
  app.use((req, _res, next) => {
    if (userId) {
      (req.session as any).userId = userId;
      (req.session as any).userRole = role;
    }
    next();
  });
  registerCatalogRoutes(app);
  return app;
}

const SIG = { cloudName: "demo-cloud", apiKey: "123", timestamp: 1, folder: "ace-tours/hero-video", signature: "abc" };

beforeEach(() => {
  state.sign.mockReset();
  state.sign.mockReturnValue(SIG);
});

describe("POST /api/admin/uploads/video-signature", () => {
  it("signs an upload into the hero-video folder for an admin", async () => {
    const res = await request(await makeApp("admin1", "admin")).post("/api/admin/uploads/video-signature");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(SIG);
    expect(state.sign).toHaveBeenCalledWith("ace-tours/hero-video");
  });

  it("refuses visitors", async () => {
    const res = await request(await makeApp()).post("/api/admin/uploads/video-signature");
    expect([401, 403]).toContain(res.status);
    expect(state.sign).not.toHaveBeenCalled();
  });

  it("refuses customers", async () => {
    const res = await request(await makeApp("cust1", "customer")).post("/api/admin/uploads/video-signature");
    expect([401, 403]).toContain(res.status);
  });

  it("returns 503 when Cloudinary isn't configured", async () => {
    state.sign.mockImplementation(() => {
      throw new Error("Cloudinary service is not enabled. Please set CLOUDINARY_URL.");
    });
    const res = await request(await makeApp("admin1", "admin")).post("/api/admin/uploads/video-signature");
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/isn't set up/);
  });
});
```

If importing `catalog.routes.js` pulls in a module that fails at import in tests (for example `../db.js`), add a `vi.mock` for that module, returning `{}` or the minimal shape used at import time. Follow `server/routes/site-settings-bank.routes.test.ts`, which imports route modules the same way.

Run: `npx vitest run server/routes/video-signature.routes.test.ts`
Expected: FAIL (404 for the admin test).

- [ ] **Step 5: Implement the route**

In `server/routes/catalog.routes.ts`, directly after the closing `});` of `app.post("/api/admin/upload", …)`, add:

```ts
  // Signed direct upload for the hero background video (Admin Only). The browser sends
  // the file straight to Cloudinary; this server only signs, so big videos never sit in
  // its memory.
  app.post("/api/admin/uploads/video-signature", requireAdmin, (_req, res) => {
    try {
      res.json(cloudinaryService.signVideoUpload("ace-tours/hero-video"));
    } catch (error: any) {
      console.error("[UPLOAD] Video signature unavailable:", error?.message);
      res.status(503).json({ error: "Video upload isn't set up (Cloudinary is not configured)." });
    }
  });
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `npx vitest run server/routes/video-signature.routes.test.ts server/infrastructure/storage/cloudinary-service.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/infrastructure/storage/cloudinary-service.ts server/infrastructure/storage/cloudinary-service.test.ts server/routes/catalog.routes.ts server/routes/video-signature.routes.test.ts
git commit -m "feat(upload): signed direct-to-Cloudinary upload for the hero video

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Validate hero-video CMS rows on save

**Files:**
- Modify: `server/routes/site.routes.ts` (the `POST /api/admin/cms-content`, `PATCH /api/admin/cms-content/:id` and `POST /api/admin/cms-content/auto-translate` handlers, around lines 374–423)
- Create: `server/routes/cms-hero-video.routes.test.ts`

**Interfaces:**
- Consumes: `heroVideoSettingError`, `isHeroVideoKey`, `HERO_VIDEO_BLOCK` (Task 1); `cloudinaryService.cloudName()` (Task 3).
- Produces: 400 `{ error: <message from heroVideoSettingError> }` on an invalid hero-video save; 400 from auto-translate for hero-video rows.

- [ ] **Step 1: Write the failing test**

`server/routes/cms-hero-video.routes.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import request from "supertest";
import express, { Express } from "express";
import session from "express-session";

const state = vi.hoisted(() => ({
  rows: {} as Record<string, any>,
  created: [] as any[],
  updated: [] as any[],
}));

vi.mock("../storage.js", () => ({
  storage: {
    getUser: async (id: string) => (id === "admin1" ? { id, role: "admin", isActive: true } : undefined),
    createCmsContent: async (data: any) => {
      state.created.push(data);
      return { id: "new", ...data };
    },
    getCmsContentItem: async (id: string) => state.rows[id],
    updateCmsContent: async (id: string, data: any) => {
      state.updated.push({ id, data });
      return { ...state.rows[id], ...data };
    },
  },
}));
vi.mock("../infrastructure/audit/admin-audit-log.service.js", () => ({ adminAudit: { log: async () => undefined } }));
vi.mock("../infrastructure/storage/cloudinary-service.js", () => ({
  cloudinaryService: { cloudName: () => "ours" },
}));

let app: Express;
beforeAll(async () => {
  const { registerSiteRoutes } = await import("./site.routes.js");
  app = express();
  app.use(express.json());
  app.use(session({ secret: "test", resave: false, saveUninitialized: true }));
  app.use((req, _res, next) => {
    (req.session as any).userId = "admin1";
    (req.session as any).userRole = "admin";
    next();
  });
  registerSiteRoutes(app);
});

beforeEach(() => {
  state.created = [];
  state.updated = [];
  state.rows = {
    v1: { id: "v1", blockSlug: "home-page", contentKey: "hero_video", locale: "en", value: "" },
    s1: { id: "s1", blockSlug: "home-page", contentKey: "hero_short_url", locale: "en", value: "" },
    t1: { id: "t1", blockSlug: "home-page", contentKey: "hero_title_part1", locale: "en", value: "Hi" },
  };
});

const create = (body: object) =>
  request(app).post("/api/admin/cms-content").send({ blockSlug: "home-page", contentType: "text", locale: "en", ...body });
const patch = (id: string, value: string) => request(app).patch(`/api/admin/cms-content/${id}`).send({ value });

describe("hero-video CMS validation", () => {
  it("creates a valid Short link", async () => {
    const res = await create({ contentKey: "hero_short_url", value: "https://youtu.be/dQw4w9WgXcQ" });
    expect(res.status).toBe(201);
    expect(state.created).toHaveLength(1);
  });

  it("rejects an invalid Short link with a readable message", async () => {
    const res = await create({ contentKey: "hero_short_url", value: "https://fb.watch/abc" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/YouTube, Instagram or Facebook/);
    expect(state.created).toHaveLength(0);
  });

  it("rejects hero-video rows in another language", async () => {
    const res = await create({ contentKey: "hero_short_url", value: "", locale: "fr" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/English/);
  });

  it("rejects a video from another Cloudinary account on update", async () => {
    const res = await patch("v1", "https://res.cloudinary.com/theirs/video/upload/v1/a.mp4");
    expect(res.status).toBe(400);
    expect(state.updated).toHaveLength(0);
  });

  it("accepts our own video and clearing it", async () => {
    expect((await patch("v1", "https://res.cloudinary.com/ours/video/upload/v1/a.mp4")).status).toBe(200);
    expect((await patch("v1", "")).status).toBe(200);
    expect(state.updated).toHaveLength(2);
  });

  it("leaves other CMS rows alone", async () => {
    expect((await patch("t1", "javascript:anything")).status).toBe(200);
  });

  it("refuses to auto-translate hero-video rows", async () => {
    const res = await request(app).post("/api/admin/cms-content/auto-translate").send({ id: "s1" });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run server/routes/cms-hero-video.routes.test.ts`
Expected: FAIL (invalid values are accepted with 201/200).

- [ ] **Step 3: Implement the validation**

In `server/routes/site.routes.ts`, add imports at the top with the others:

```ts
import { heroVideoSettingError, isHeroVideoKey, HERO_VIDEO_BLOCK } from "../../shared/hero-video.js";
import { cloudinaryService } from "../infrastructure/storage/cloudinary-service.js";
```

(Match how this file already imports from `shared/`. If it uses `@shared/…` or a different relative path, use that.)

Replace the create handler body:

```ts
  app.post("/api/admin/cms-content", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertCmsContentSchema.parse(req.body);
      const heroError = heroVideoSettingError(
        { blockSlug: validatedData.blockSlug, key: validatedData.contentKey, value: validatedData.value, locale: validatedData.locale },
        cloudinaryService.cloudName(),
      );
      if (heroError) return res.status(400).json({ error: heroError });
      const content = await storage.createCmsContent(validatedData);
      res.status(201).json(content);
    } catch (error) {
      res.status(400).json({ error: "Failed to create content" });
    }
  });
```

Replace the patch handler body:

```ts
  app.patch("/api/admin/cms-content/:id", requireAdmin, async (req, res) => {
    try {
      if (req.body && "value" in req.body) {
        const existing = await storage.getCmsContentItem(req.params.id);
        if (existing) {
          const heroError = heroVideoSettingError(
            { blockSlug: existing.blockSlug, key: existing.contentKey, value: req.body.value, locale: existing.locale },
            cloudinaryService.cloudName(),
          );
          if (heroError) return res.status(400).json({ error: heroError });
        }
      }
      const content = await storage.updateCmsContent(req.params.id, req.body);
      if (!content) return res.status(404).json({ error: "Content not found" });
      res.json(content);
    } catch (error) {
      res.status(400).json({ error: "Failed to update content" });
    }
  });
```

In the auto-translate handler, right after `if (!source) return res.status(404)…`, add:

```ts
      if (source.blockSlug === HERO_VIDEO_BLOCK && isHeroVideoKey(source.contentKey)) {
        return res.status(400).json({ error: "Hero video settings aren't translated: they apply to every language." });
      }
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run server/routes/cms-hero-video.routes.test.ts server/routes/site-settings-bank.routes.test.ts`
Expected: PASS (both files: the existing bank test must still pass with the new import).

- [ ] **Step 5: Commit**

```bash
git add server/routes/site.routes.ts server/routes/cms-hero-video.routes.test.ts
git commit -m "feat(cms): validate hero video settings on save

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Storefront components: background loop and Short card

**Files:**
- Create: `client/src/hooks/use-hero-video.ts`
- Create: `client/src/components/hero-background-video.tsx`
- Create: `client/src/components/hero-short.tsx`
- Create: `client/src/lib/hero-video-render.test.ts`
- Modify: `client/src/locales/en.json`, `fr.json`, `es.json`, `zh.json`, `bi.json`

**Interfaces:**
- Consumes: `resolveHeroVideo`, `shouldPlayLoop`, `LOOP_MIN_WIDTH`, `SHORT_PLATFORM_NAME`, types `HeroVideoPage`, `HeroVideoSettings`, `LoopSources`, `HeroShortData` (Task 1); `useCmsText` (`client/src/hooks/use-cms-text.ts`).
- Produces:
  - `useHeroVideo(page: HeroVideoPage): HeroVideoSettings`
  - `<HeroBackgroundVideo sources: LoopSources; position?: string />`
  - `<HeroShort short: HeroShortData />`

- [ ] **Step 1: Write the failing render-safety test**

The vitest environment is Node, and its include pattern covers `client/src/lib/**/*.test.ts`. `renderToString` runs no effects, which is exactly what the prerendered snapshot and the first hydration render see.

`client/src/lib/hero-video-render.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { HeroBackgroundVideo } from "@/components/hero-background-video";
import { HeroShort } from "@/components/hero-short";
import { resolveHeroVideo } from "@shared/hero-video";

const settings = resolveHeroVideo("home", (key) =>
  ({
    hero_video: "https://res.cloudinary.com/ours/video/upload/v1/a.mp4",
    hero_short_url: "https://youtu.be/dQw4w9WgXcQ",
    hero_short_cover: "",
    hero_video_pages: "",
  })[key],
);

describe("hero video first render (prerender + hydration)", () => {
  it("background loop renders nothing until the browser says it may play", () => {
    expect(renderToString(createElement(HeroBackgroundVideo, { sources: settings.loop! }))).toBe("");
  });

  it("Short card renders the cover and no player", () => {
    const html = renderToString(createElement(HeroShort, { short: settings.short! }));
    expect(html).toContain("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("youtube-nocookie");
  });

  it("Short card without a cover image shows the platform name instead", () => {
    const ig = resolveHeroVideo("home", (key) => (key === "hero_short_url" ? "https://www.instagram.com/reel/C9xYz_ab-12/" : "")).short!;
    const html = renderToString(createElement(HeroShort, { short: ig }));
    expect(html).toContain("Instagram");
    expect(html).not.toContain("<iframe");
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run client/src/lib/hero-video-render.test.ts`
Expected: FAIL (components not found).

- [ ] **Step 3: Implement the hook**

`client/src/hooks/use-hero-video.ts`:

```ts
import { useCmsText } from "@/hooks/use-cms-text";
import { HERO_VIDEO_BLOCK, resolveHeroVideo, type HeroVideoPage, type HeroVideoSettings } from "@shared/hero-video";

/**
 * The hero video for a page: Admin → CMS → Home Page → Hero video.
 * Home always uses it; Tours, Transfers and About only when ticked there.
 * The settings are English-only rows, which every language falls back to.
 */
export function useHeroVideo(page: HeroVideoPage): HeroVideoSettings {
  const cms = useCmsText(HERO_VIDEO_BLOCK);
  return resolveHeroVideo(page, (key) => cms.text(key));
}
```

- [ ] **Step 4: Implement the background loop**

`client/src/components/hero-background-video.tsx`:

```tsx
/**
 * Muted looping video behind a hero, over (not instead of) the hero photo.
 *
 * It renders nothing on the server and on the first client render, so the prerendered
 * snapshot and hydration keep only the photo (the page's LCP image). After mount it
 * plays only where shouldPlayLoop allows: tablets and computers, no reduced motion,
 * no data saver, no 2G. If the video can't load or play, it removes itself and the
 * photo stays.
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { LOOP_MIN_WIDTH, shouldPlayLoop, type LoopSources } from "@shared/hero-video";

type Connection = { saveData?: boolean; effectiveType?: string };

export function HeroBackgroundVideo({ sources, position }: { sources: LoopSources; position?: string }) {
  const [allowed, setAllowed] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wide = window.matchMedia(`(min-width: ${LOOP_MIN_WIDTH}px)`);
    const connection = (navigator as Navigator & { connection?: Connection }).connection;
    const update = () =>
      setAllowed(
        shouldPlayLoop({
          width: window.innerWidth,
          reducedMotion: reduced.matches,
          saveData: connection?.saveData,
          effectiveType: connection?.effectiveType,
        }),
      );
    update();
    reduced.addEventListener("change", update);
    wide.addEventListener("change", update);
    return () => {
      reduced.removeEventListener("change", update);
      wide.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    if (!allowed) setReady(false);
    else ref.current?.play()?.catch(() => setFailed(true));
  }, [allowed]);

  if (!allowed || failed) return null;
  return (
    <video
      ref={ref}
      muted
      loop
      playsInline
      autoPlay
      preload="auto"
      aria-hidden
      tabIndex={-1}
      onCanPlay={() => setReady(true)}
      className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-700", ready ? "opacity-100" : "opacity-0")}
      style={{ objectPosition: position }}
    >
      <source src={sources.webm} type="video/webm" />
      {/* Errors fire on the last <source> when none can play. */}
      <source src={sources.mp4} type="video/mp4" onError={() => setFailed(true)} />
    </video>
  );
}
```

- [ ] **Step 5: Implement the Short card**

`client/src/components/hero-short.tsx`:

```tsx
/**
 * The admin's YouTube / Instagram / Facebook Short in a hero.
 *
 * Desktop: a 9:16 "phone" card beside the headline. Mobile: a "Watch our video" pill
 * that opens the player in a dialog. Both are pure CSS switches (hydration-safe). The
 * platform player (and its scripts and cookies) loads only after a click.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Play } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { SHORT_PLATFORM_NAME, type HeroShortData } from "@shared/hero-video";

function ShortPlayer({ short, title }: { short: HeroShortData; title: string }) {
  return (
    <iframe
      src={short.embedUrl}
      title={title}
      className="h-full w-full border-0"
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}

function ShortCover({ short }: { short: HeroShortData }) {
  const src = short.cover ?? short.thumbnailUrl;
  if (src) return <img src={src} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />;
  return (
    <span className="absolute inset-0 flex items-start justify-center bg-gradient-to-br from-[#12324a] via-[#1d5a73] to-primary pt-6 text-sm font-semibold uppercase tracking-[0.2em] text-white/90">
      {SHORT_PLATFORM_NAME[short.platform]}
    </span>
  );
}

export function HeroShort({ short }: { short: HeroShortData }) {
  const { t } = useTranslation();
  const [playing, setPlaying] = useState(false);
  const [open, setOpen] = useState(false);
  const label = t("hero.watchVideo", "Watch our video");
  const platform = SHORT_PLATFORM_NAME[short.platform];
  const watchOn = t("hero.watchOn", { platform, defaultValue: "Watch on {{platform}}" });
  const watchLink = (
    <a href={short.watchUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block text-center text-xs font-medium text-white/85 underline underline-offset-2 hover:text-white">
      {watchOn}
    </a>
  );

  return (
    <>
      {/* Desktop: phone card */}
      <div className="hidden md:block">
        <div className="relative aspect-[9/16] w-[190px] overflow-hidden rounded-[1.75rem] border-4 border-white/85 bg-black shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)] lg:w-[220px]">
          {playing ? (
            <ShortPlayer short={short} title={label} />
          ) : (
            <button type="button" onClick={() => setPlaying(true)} aria-label={`${label} (${platform})`} className="group absolute inset-0 text-white">
              <ShortCover short={short} />
              <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#12324a] shadow-lg transition-transform group-hover:scale-110">
                <Play className="ml-0.5 h-6 w-6 fill-current" />
              </span>
              <span className="absolute inset-x-0 bottom-4 text-center text-sm font-semibold">{label}</span>
            </button>
          )}
        </div>
        {watchLink}
      </div>

      {/* Mobile: pill + dialog */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-[#12324a] shadow-lg"
        >
          <Play className="h-4 w-4 fill-current" />
          {label}
        </button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="w-[min(92vw,380px)] max-w-none border-0 bg-black p-3">
            <DialogTitle className="sr-only">{label}</DialogTitle>
            <div className="aspect-[9/16] w-full overflow-hidden rounded-lg">{open && <ShortPlayer short={short} title={label} />}</div>
            {watchLink}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
```

- [ ] **Step 6: Add the translations**

The locale files are flat (`"hero.titlePart1": …`). Add these two keys next to the other `hero.*` keys in each file:

| File | `hero.watchVideo` | `hero.watchOn` |
|---|---|---|
| `en.json` | `Watch our video` | `Watch on {{platform}}` |
| `fr.json` | `Voir notre vidéo` | `Voir sur {{platform}}` |
| `es.json` | `Ver nuestro vídeo` | `Ver en {{platform}}` |
| `zh.json` | `观看我们的视频` | `在 {{platform}} 上观看` |
| `bi.json` | `Lukim vidio blong mifala` | `Lukim long {{platform}}` |

The two Bislama lines must go to the native-speaker review list. Tell the user in the final summary.

- [ ] **Step 7: Run the tests and confirm they pass**

Run: `npx vitest run client/src/lib/hero-video-render.test.ts`
Expected: PASS. If the Dialog import fails under Node because of a CSS or DOM-only dependency, mock it at the top of the test with `vi.mock("@/components/ui/dialog", () => ({ Dialog: () => null, DialogContent: () => null, DialogTitle: () => null }))`. A closed dialog renders nothing either way.

- [ ] **Step 8: Type-check and commit**

Run: `npm run check`
Expected: no errors.

```bash
git add client/src/hooks/use-hero-video.ts client/src/components/hero-background-video.tsx client/src/components/hero-short.tsx client/src/lib/hero-video-render.test.ts client/src/locales/*.json
git commit -m "feat(hero-video): background loop and click-to-play Short card

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Wire into `PageHero` and the four pages

**Files:**
- Modify: `client/src/components/page-hero.tsx`
- Modify: `client/src/components/hero.tsx` (`Hero()` at the bottom)
- Modify: `client/src/pages/tours.tsx`, `client/src/pages/transfers.tsx`, `client/src/pages/about.tsx`

**Interfaces:**
- Consumes: `useHeroVideo` (Task 5), `HeroBackgroundVideo`, `HeroShort` (Task 5), types from Task 1.
- Produces: `PageHero` props `video?: LoopSources | null`, `short?: HeroShortData | null`.

- [ ] **Step 1: Extend `PageHero`**

In `client/src/components/page-hero.tsx`:

Add the imports:

```tsx
import { HeroBackgroundVideo } from "@/components/hero-background-video";
import { HeroShort } from "@/components/hero-short";
import type { HeroShortData, LoopSources } from "@shared/hero-video";
```

Add `video = null` and `short = null` to the destructured props, and these to the props type:

```tsx
  /** Background loop (Admin → CMS → Home Page → Hero video). Plays over the photo on larger screens only. */
  video?: LoopSources | null;
  /** YouTube / Instagram / Facebook Short shown as a phone card beside the headline. */
  short?: HeroShortData | null;
```

In the background layer, directly after the `<img … />` and before the gradient `<div>`s, add:

```tsx
        {video && <HeroBackgroundVideo sources={video} position={photoPosition} />}
```

Then take the existing headline `<motion.div initial={{ opacity: 0, y: 18 }} …>…</motion.div>` element unchanged and assign it to a constant above the `return`, `const heading = ( <motion.div …>…</motion.div> );`. In the JSX, replace it with:

```tsx
        {short ? (
          <div className="flex w-full flex-col items-center md:flex-row md:items-center md:justify-center md:gap-12">
            {heading}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
              className="mt-6 shrink-0 md:mt-0"
            >
              <HeroShort short={short} />
            </motion.div>
          </div>
        ) : (
          heading
        )}
```

The JSX that builds `heading` references `greeting`, `Heading`, `kicker`, `title`, `size` and `subtitle`, which are all props, so moving it above the `return` is safe. Without `short` the markup is identical to today.

- [ ] **Step 2: Pass the settings from each page**

`client/src/components/hero.tsx`, in `Hero()`: add `import { useHeroVideo } from "@/hooks/use-hero-video";`, then `const heroVideo = useHeroVideo("home");`, and on `<PageHero …>` add `video={heroVideo.loop} short={heroVideo.short}`.

`client/src/pages/tours.tsx`: add the same import; in `Tours()` add `const heroVideo = useHeroVideo("tours");`; on `<PageHero …>` add `video={heroVideo.loop} short={heroVideo.short}`.

`client/src/pages/transfers.tsx`: the same with `useHeroVideo("transfers")`.

`client/src/pages/about.tsx`: the same with `useHeroVideo("about")`.

- [ ] **Step 3: Type-check and run the whole suite**

Run: `npm run check`, then `npm test`
Expected: no type errors; all tests pass (previous count + the new ones).

- [ ] **Step 4: Commit**

```bash
git add client/src/components/page-hero.tsx client/src/components/hero.tsx client/src/pages/tours.tsx client/src/pages/transfers.tsx client/src/pages/about.tsx
git commit -m "feat(hero-video): show the loop and Short on Home, and on Tours/Transfers/About when ticked

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Admin "Hero video" card

**Files:**
- Modify: `client/src/lib/api.ts` (add `uploadHeroVideo`, plus `HERO_VIDEO_MAX_BYTES` and `HERO_VIDEO_TYPES`)
- Create: `client/src/components/admin/hero-video-settings.tsx`
- Modify: `client/src/pages/admin/cms.tsx` (render the card at the top of the `home-page` tab)

**Interfaces:**
- Consumes: `POST /api/admin/uploads/video-signature` (Task 3), `parseShortUrl`, `cloudinaryLoopSources`, `heroVideoPages`, `HERO_VIDEO_KEYS`, `HERO_VIDEO_EXTRA_PAGES`, `SHORT_PLATFORM_NAME` (Task 1); `uploadImage` (existing, `client/src/lib/api.ts`); `getContent(key)` and `handleSave(item, value)` (existing, in `cms.tsx`).
- Produces: `uploadHeroVideo(file: File, onProgress: (fraction: number) => void): Promise<string>`; `<HeroVideoSettings getContent onSave />`.

- [ ] **Step 1: Add the upload function**

Append to `client/src/lib/api.ts`:

```ts
// Hero background video: the browser uploads straight to Cloudinary with a signature
// from our server, so large files never pass through it.
export const HERO_VIDEO_MAX_BYTES = 100 * 1024 * 1024;
export const HERO_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

interface VideoUploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
}

export async function uploadHeroVideo(file: File, onProgress: (fraction: number) => void): Promise<string> {
  if (!HERO_VIDEO_TYPES.includes(file.type)) throw new Error("Choose an MP4, WebM or MOV video.");
  if (file.size > HERO_VIDEO_MAX_BYTES) throw new Error("The video is over 100 MB. Trim or compress it first.");

  const sig: VideoUploadSignature = await (await apiRequest("POST", "/api/admin/uploads/video-signature")).json();
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", String(sig.timestamp));
  form.append("folder", sig.folder);
  form.append("signature", sig.signature);

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${encodeURIComponent(sig.cloudName)}/video/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      let body: any = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* handled below */
      }
      if (xhr.status >= 200 && xhr.status < 300 && typeof body?.secure_url === "string") resolve(body.secure_url);
      else reject(new Error(body?.error?.message || `Upload failed (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload. Check the connection and try again."));
    xhr.send(form);
  });
}
```

- [ ] **Step 2: Build the admin card**

`client/src/components/admin/hero-video-settings.tsx`:

```tsx
/**
 * Admin → CMS → Home Page → Hero video. Four English-only settings (shared/hero-video.ts):
 * background loop upload, Short link, optional Short cover, and "Also show on" pages.
 * Kept out of the generic field list because these rows must not get translate buttons.
 */
import { useState } from "react";
import { Loader2, Trash2, Upload, Video } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { uploadHeroVideo, uploadImage, HERO_VIDEO_TYPES } from "@/lib/api";
import {
  HERO_VIDEO_EXTRA_PAGES,
  HERO_VIDEO_KEYS,
  SHORT_PLATFORM_NAME,
  cloudinaryLoopSources,
  heroVideoPages,
  parseShortUrl,
  type HeroVideoExtraPage,
} from "@shared/hero-video";

type Item = { id?: string; key: string; value: string };

const PAGE_LABEL: Record<HeroVideoExtraPage, string> = { tours: "Tours", transfers: "Transfers", about: "About" };

export function HeroVideoSettings({
  getContent,
  onSave,
}: {
  getContent: (key: string) => Item;
  onSave: (item: Item, value: string) => void;
}) {
  const { toast } = useToast();
  const videoItem = getContent(HERO_VIDEO_KEYS.video);
  const shortItem = getContent(HERO_VIDEO_KEYS.shortUrl);
  const coverItem = getContent(HERO_VIDEO_KEYS.shortCover);
  const pagesItem = getContent(HERO_VIDEO_KEYS.pages);

  const [progress, setProgress] = useState<number | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [shortDraft, setShortDraft] = useState<string | null>(null);

  const loop = cloudinaryLoopSources(videoItem.value);
  const shortValue = shortDraft ?? shortItem.value ?? "";
  const parsed = parseShortUrl(shortValue);
  const shortInvalid = shortValue.trim() !== "" && !parsed;
  const pages = heroVideoPages(pagesItem.value);

  const onVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setProgress(0);
    try {
      const url = await uploadHeroVideo(file, setProgress);
      onSave(videoItem, url);
    } catch (err: any) {
      toast({ title: "Video upload failed", description: err?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setProgress(null);
    }
  };

  const onCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCoverUploading(true);
    try {
      onSave(coverItem, (await uploadImage(file)).url);
    } catch {
      toast({ title: "Cover upload failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setCoverUploading(false);
    }
  };

  const togglePage = (page: HeroVideoExtraPage, on: boolean) => {
    const next = new Set(pages);
    if (on) next.add(page);
    else next.delete(page);
    onSave(pagesItem, HERO_VIDEO_EXTRA_PAGES.filter((p) => next.has(p)).join(","));
  };

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Video className="h-4 w-4" /> Hero video
        </CardTitle>
        <CardDescription>
          Shown on the Home page hero, and on the pages ticked below. These settings apply to every language.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Background loop */}
        <section className="space-y-2">
          <Label className="font-semibold">Background video</Label>
          <p className="text-xs text-muted-foreground">
            Plays muted and looped behind the headline (first 15 seconds) on tablets and computers. Phones show the photo. Use a
            landscape clip with nothing important at the very top or bottom. MP4, WebM or MOV, up to 100 MB.
          </p>
          {loop && (
            <video src={loop.mp4} poster={loop.poster} muted loop autoPlay playsInline className="aspect-video w-full max-w-md rounded-lg bg-black object-cover" />
          )}
          {progress !== null ? (
            <div className="max-w-md space-y-1">
              <Progress value={Math.round(progress * 100)} />
              <p className="text-xs text-muted-foreground">Uploading… {Math.round(progress * 100)}%</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <label className="cursor-pointer">
                  <Upload className="mr-2 h-4 w-4" />
                  {loop ? "Replace video" : "Upload video"}
                  <input type="file" accept={HERO_VIDEO_TYPES.join(",")} className="hidden" onChange={onVideo} />
                </label>
              </Button>
              {videoItem.value && (
                <Button size="sm" variant="outline" onClick={() => onSave(videoItem, "")}>
                  <Trash2 className="mr-2 h-4 w-4" /> Remove video
                </Button>
              )}
            </div>
          )}
        </section>

        {/* Short */}
        <section className="space-y-2">
          <Label htmlFor="hero-short-url" className="font-semibold">Short (YouTube, Instagram or Facebook)</Label>
          <div className="flex max-w-xl gap-2">
            <Input
              id="hero-short-url"
              value={shortValue}
              placeholder="https://www.youtube.com/shorts/…"
              onChange={(e) => setShortDraft(e.target.value)}
            />
            <Button
              size="sm"
              disabled={shortInvalid || shortDraft === null || shortDraft === (shortItem.value ?? "")}
              onClick={() => {
                onSave(shortItem, shortValue.trim());
                setShortDraft(null);
              }}
            >
              Save
            </Button>
          </div>
          <p className={shortInvalid ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
            {parsed
              ? `${SHORT_PLATFORM_NAME[parsed.platform]} video detected. Visitors click to play it.`
              : shortInvalid
                ? "Not a YouTube, Instagram or Facebook video link. For Facebook, open the video and copy the full facebook.com address."
                : "Leave empty for no Short."}
          </p>
        </section>

        {/* Cover */}
        <section className="space-y-2">
          <Label className="font-semibold">Short cover image (optional)</Label>
          <p className="text-xs text-muted-foreground">
            YouTube supplies its own. Instagram and Facebook don't, so upload a portrait image or a branded card is shown.
          </p>
          {coverItem.value && <img src={coverItem.value} alt="" className="aspect-[9/16] w-24 rounded-lg object-cover" />}
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline" disabled={coverUploading}>
              <label className="cursor-pointer">
                {coverUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {coverItem.value ? "Replace cover" : "Upload cover"}
                <input type="file" accept="image/*" className="hidden" onChange={onCover} disabled={coverUploading} />
              </label>
            </Button>
            {coverItem.value && (
              <Button size="sm" variant="outline" onClick={() => onSave(coverItem, "")}>
                <Trash2 className="mr-2 h-4 w-4" /> Remove cover
              </Button>
            )}
          </div>
        </section>

        {/* Pages */}
        <section className="space-y-2">
          <Label className="font-semibold">Also show on</Label>
          <div className="flex flex-wrap gap-5">
            {HERO_VIDEO_EXTRA_PAGES.map((page) => (
              <label key={page} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={pages.has(page)} onCheckedChange={(v) => togglePage(page, v === true)} />
                {PAGE_LABEL[page]}
              </label>
            ))}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
```

Check before using: `client/src/hooks/use-toast.ts` exists (`cms.tsx` already calls `toast(…)`; use the same import path it uses). `Button` supports `asChild` (shadcn default). If either differs, match `cms.tsx`.

- [ ] **Step 3: Render it in the CMS page**

In `client/src/pages/admin/cms.tsx`, add `import { HeroVideoSettings } from "@/components/admin/hero-video-settings";`. Inside `<TabsContent key={key} value={key} …>`, before `{section.fields.map(…)}`, add:

```tsx
              {key === "home-page" &&
                (activeLocale === "en" ? (
                  <HeroVideoSettings getContent={getContent} onSave={handleSave} />
                ) : (
                  <p className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                    Hero video settings are on the English tab and apply to every language.
                  </p>
                ))}
```

The server's 400 message (Task 4) only appears if the admin UI is bypassed, because the card blocks invalid Short links client-side. The existing mutation `onError` toast ("Failed to save content.") is enough for that case.

- [ ] **Step 4: Type-check and run the full suite**

Run: `npm run check`, then `npm test`
Expected: no type errors; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/api.ts client/src/components/admin/hero-video-settings.tsx client/src/pages/admin/cms.tsx
git commit -m "feat(admin): Hero video settings card (direct upload, Short link, cover, pages)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Handover note and end-to-end verification

**Files:**
- Modify: `docs/CLIENT_HANDOVER.md`

- [ ] **Step 1: Write the handover section**

Append to `docs/CLIENT_HANDOVER.md` (match its heading level):

```markdown
## Hero video

Admin → CMS → Home Page (English tab) → **Hero video**.

- **Background video**: upload a landscape clip (MP4, WebM or MOV, up to 100 MB). The site
  plays the first 15 seconds, muted and looped, behind the headline on tablets and computers.
  Phones always show the photo, to save visitors' mobile data. **Remove video** goes back to the photo.
- **Short**: paste a YouTube Short, Instagram Reel or Facebook video link. It appears as a
  phone-shaped card beside the headline (a "Watch our video" button on phones) and plays when
  clicked. For Facebook, open the video and copy the full facebook.com address (not an fb.watch link).
- **Short cover image**: optional. YouTube supplies one. For Instagram and Facebook, upload a
  portrait image or a branded card is shown.
- **Also show on**: tick Tours, Transfers and/or About to show the same video there too.

Changes show on the site straight away. No redeploy is needed for the video itself.
```

- [ ] **Step 2: Full local verification (one at a time, not in parallel)**

Run: `npm run check`
Expected: no errors.

Run: `npm test`
Expected: all tests pass. Record the total count.

- [ ] **Step 3: Browser check without touching the live DB**

The local `.env` points at the LIVE database. Do not save CMS values locally against it. Pick one:
- (a) Create a Neon branch (`mcp__Neon__create_branch` on the project in `.env`), point `DATABASE_URL` at it for this session only, run `npm run dev`, set the four values in the admin, and check the site; or
- (b) Check only the zero-config path locally (`npm run dev`, no values set) and do the full check on production after deploy, with the user.

With values set (a), use Playwright:
1. Desktop 1440×900 `/`: hero photo is visible at once; the `<video>` appears and fades in; the Short card is right of the headline; clicking it creates exactly one `<iframe>` from `youtube-nocookie.com`; no CSP errors in the console.
2. 375×812 `/`: no `<video>` element; the "Watch our video" pill opens a dialog with the player; closing it removes the iframe.
3. Desktop with `emulateMedia({ reducedMotion: "reduce" })`: no `<video>`.
4. `/tours` before and after ticking Tours: no video, then video.
5. No values set: `/`, `/tours`, `/transfers`, `/about` look identical to the current site (compare screenshots).

Prerender check: run `npm run build` with prerender on ONLY while `DATABASE_URL` points at the Neon branch (never the live DB), or check production after deploy. Fetch `/` and confirm the HTML contains the hero `<img>` and no `<video>` or `<iframe>`.

- [ ] **Step 4: Commit**

```bash
git add docs/CLIENT_HANDOVER.md
git commit -m "docs(handover): how to use the hero video

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: Report**

Tell the user: commits made, test count before/after, what was checked in the browser and on which database, and that the two Bislama lines (`hero.watchVideo`, `hero.watchOn`) need native review. Do not push until they say so.

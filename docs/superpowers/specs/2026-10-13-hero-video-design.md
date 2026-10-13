# Hero video — design

Date: 2026-10-13
Status: approved in conversation, awaiting written-spec review

## Goal

Let the admin add video to the page heroes without hurting page speed, SEO or
visitors' mobile data:

1. **Background loop**: a short, silent, looping clip behind the hero headline,
   uploaded in the admin.
2. **Short**: a YouTube Short, Instagram Reel or Facebook video/reel shown in a
   vertical "phone card" in the hero, played on click.

Both are configured once (CMS → Home Page) and always shown on the Home hero.
Tick boxes add them to the Tours, Transfers and About heroes as well.

## Decisions (from the conversation)

| Question | Decision |
|---|---|
| Video types | Both: uploaded background loop, and embedded YouTube / Instagram / Facebook Short |
| Where the Short appears | Phone card beside the headline (desktop); "Watch our video" pill opening a pop-up (mobile) |
| Other pages | One set of settings on Home, plus "Also show on: Tours / Transfers / About" tick boxes |
| Background loop on phones | Never: phones always show the photo |
| Upload route | Signed direct upload from the admin's browser to Cloudinary; our server never handles the file |

## Non-goals

- A separate video per page (YAGNI: reuse plus tick boxes was chosen).
- Videos on the Contact or Manage Booking heroes, or anywhere outside the hero.
- Fetching Instagram/Facebook thumbnails through their APIs (they need app tokens).
- Sound on the background loop.
- Using the Short as the background (vertical video cropped to a wide hero; IG/FB can't autoplay muted).

## Constraints that shaped the design

- **Server memory.** Uploads currently go through Express with `multer.memoryStorage()`
  capped at 5 MB, images only (`server/routes/shared.ts:122-141`). The live instance has
  0.15 CPU and 512 MB RAM, so a 30–100 MB video must not pass through it.
  The image upload path stays as it is.
- **SEO and LCP.** The hero `<img>` in `client/src/components/page-hero.tsx` is the page's
  LCP element and is in the prerendered snapshot. It must stay the first paint and remain
  in the snapshot. Video is added only after hydration.
- **Hydration.** Pages are prerendered and hydrated (see the prerender/hydration notes).
  Anything that depends on the browser (screen width, reduced motion, data saver) must
  render nothing on the server and on the first client render, and switch on in an effect,
  so the hydrated markup matches the snapshot.
- **CSP** (`server/index.ts:93-152`) has no `media-src` and allows only Stripe and
  Trustpilot frames. New origins must be added explicitly.
- **CMS is locale-aware.** `useCmsText` reads per-locale rows with English fallback. Video
  settings are not translatable, so they are always stored and read as English rows.

## Data: CMS keys (block `home-page`, locale `en`)

No schema change or migration: these are ordinary `cms_content` rows.

| Key | Admin field type | Value |
|---|---|---|
| `hero_video` | `video` (new) | Cloudinary video `secure_url` of the original upload, or empty |
| `hero_short_url` | `text` | Pasted YouTube / Instagram / Facebook URL, or empty |
| `hero_short_cover` | `image` | Optional cover image for the Short card (used for IG/FB; overrides YouTube's) |
| `hero_video_pages` | `checklist` (new) | Comma-separated subset of `tours,transfers,about`; empty = Home only |

Rules:
- Home shows whatever is set. Another page shows the video settings only if its id is in `hero_video_pages`.
- Background loop and Short are independent: either, both or neither.
- Empty or invalid values mean "no video": the hero renders exactly as today.

## Units

Each unit has one job and can be tested on its own.

### 1. `shared/hero-video.ts`: pure logic (no React, no DOM)

- `parseShortUrl(url): ShortEmbed | null`, where
  `ShortEmbed = { platform: "youtube" | "instagram" | "facebook"; id: string; embedUrl: string; thumbnailUrl: string | null; watchUrl: string }`.
  - YouTube: `youtube.com/shorts/ID`, `youtu.be/ID`, `youtube.com/watch?v=ID`, with or without `www.`/`m.`.
    Embed: `https://www.youtube-nocookie.com/embed/ID?autoplay=1&playsinline=1&rel=0`.
    Thumbnail: `https://i.ytimg.com/vi/ID/hqdefault.jpg`. ID must match `^[A-Za-z0-9_-]{11}$`.
  - Instagram: `instagram.com/reel/ID`, `/reels/ID`, `/p/ID`.
    Embed: `https://www.instagram.com/reel/ID/embed`. No thumbnail.
  - Facebook: `facebook.com/reel/ID`, `facebook.com/<page>/videos/ID`, `facebook.com/watch/?v=ID`, `fb.watch/ID`.
    Embed: `https://www.facebook.com/plugins/video.php?href=<encoded canonical URL>&show_text=false&autoplay=true`. No thumbnail.
  - Anything else (other hosts, `javascript:`, missing ID) → `null`. IDs are validated
    against strict character classes before any URL is built, so admin input never reaches
    an iframe `src` unchecked.
- `cloudinaryLoopSources(url): { webm: string; mp4: string; poster: string } | null`.
  Accepts only `https://res.cloudinary.com/<cloud>/video/upload/...`; returns `null` for anything else.
  Inserts transformations after `/upload/`: `ac_none,du_15,c_fill,ar_16:9,w_1280,q_auto:eco`
  plus `f_webm` / `f_mp4`. Poster is the same path with `so_0`, `f_jpg`, `.jpg`.
- `heroVideoPages(value): Set<"tours" | "transfers" | "about">`: parses the checklist value and ignores unknown ids.
- `shouldPlayLoop(env): boolean`, where `env = { width, reducedMotion, saveData, effectiveType }`.
  True only when width ≥ 768, reduced motion is off, `saveData` is not true, and
  `effectiveType` is not `slow-2g`/`2g`.

### 2. `client/src/hooks/use-hero-video.ts`

`useHeroVideo(page: "home" | "tours" | "transfers" | "about")` reads the `home-page` CMS
block (English values) and returns `{ loop: LoopSources | null, short: (ShortEmbed & { cover: string | null }) | null }`.
It returns both as `null` when `page !== "home"` and the page isn't ticked.

### 3. `client/src/components/hero-background-video.tsx`

- Renders `null` on the server and on the first client render.
- After mount, evaluates `shouldPlayLoop` from `matchMedia`/`navigator.connection` and
  listens for changes to width and reduced motion.
- When allowed, renders `<video muted loop playsInline autoPlay preload="none" poster=… aria-hidden>`
  with WebM then MP4 `<source>`s. It sits above the photo and below the gradient
  overlays, starts at `opacity-0` and fades in on `canplay`.
- On `error` or a rejected `play()` it removes itself, leaving the photo.
- If reduced motion is turned on mid-session, it pauses and hides.

### 4. `client/src/components/hero-short.tsx`

- **Desktop (≥ md):** a 9:16 card (about 220–260 px wide) next to the headline: cover
  image (YouTube thumbnail, admin cover, or a branded gradient with the platform name),
  a ▶ button and the label "Watch our video". On click, the card's content becomes the
  platform `<iframe>`, loaded only then (`allow="autoplay; encrypted-media; picture-in-picture"`, `allowFullScreen`,
  `referrerPolicy="strict-origin-when-cross-origin"`, `title` set for accessibility).
- **Mobile:** a "▶ Watch our video" pill under the headline that opens the shared shadcn
  `Dialog` with the same 9:16 iframe; closing the dialog unmounts the iframe and stops playback.
- No third-party request before the click (cover images from `i.ytimg.com` and Cloudinary are the only exception).
- A "Watch on YouTube/Instagram/Facebook" text link (`watchUrl`) is the fallback if the
  embed is blocked (for example, Instagram posts with embedding turned off).
- The visible text goes through i18n (`hero.watchVideo`, `hero.watchOn`) in all locales,
  with Bislama lines flagged for the native-speaker review.

### 5. `PageHero` changes (`client/src/components/page-hero.tsx`)

Two new optional props: `video?: LoopSources | null` and `short?: ShortEmbed | null`.
- `video` → `<HeroBackgroundVideo>` inside the existing `aria-hidden` background layer, after the `<img>`.
- `short` → the heading area becomes a two-column layout on `md+` (headline left, card
  right) for `size="page"` and `size="home"`. Without `short` the layout is unchanged,
  pixel for pixel. On mobile the pill sits under the heading.
- `Hero` (home), `tours.tsx`, `transfers.tsx` and `about.tsx` pass `useHeroVideo(<page>)`.

### 6. Signed upload endpoint (server)

`POST /api/admin/uploads/video-signature` (`requireAdmin`, CSRF as the other admin routes)
→ `{ cloudName, apiKey, timestamp, folder: "ace-tours/hero-video", signature }`, signed
with the Cloudinary API secret from the existing `CLOUDINARY_URL` config via
`cloudinary.utils.api_sign_request`. It lives in the existing storage service, next to
`uploadImage`. It returns 503 when Cloudinary isn't configured.

### 7. Save-time validation (server)

When a `cms_content` row with key `hero_video` is created or updated, the value must be
empty or match `^https://res\.cloudinary\.com/<our cloud>/video/upload/` (otherwise 400).
`hero_short_url` must be empty or parse with `parseShortUrl` (otherwise 400). This stops
an arbitrary URL being saved even if the admin UI is bypassed.

### 8. Admin UI (`client/src/pages/admin/cms.tsx`, Home Page tab)

A "Hero video" group after the hero text fields:
- **Background video** (`video` field type): drop zone with `accept="video/mp4,video/webm,video/quicktime"`,
  client-side limit of 100 MB, upload progress bar (XHR to `https://api.cloudinary.com/v1_1/<cloud>/video/upload`
  with the signed params), a preview `<video>` once saved, and a "Remove video" button.
  Help text: "Shown on tablets and computers, muted, first 15 seconds, looped. Phones show the photo."
- **Short link** (`text`): the platform detected by `parseShortUrl` is shown live under
  the input ("YouTube Short detected" / "Not a YouTube, Instagram or Facebook link").
  Save is blocked while the link is invalid.
- **Short cover image** (`image`): the existing image upload.
- **Also show on** (`checklist` field type): three checkboxes; saved as a comma list.
- The group appears only in the English locale tab, with a note that it applies to all
  languages. Auto-translate skips these keys.

### 9. CSP (`server/index.ts`)

- `mediaSrc: ["'self'", "https://res.cloudinary.com"]`
- `frameSrc` += `https://www.youtube-nocookie.com`, `https://www.instagram.com`, `https://www.facebook.com`
- `imgSrc` += `https://i.ytimg.com`
- `connectSrc` += `https://api.cloudinary.com` (admin direct upload)

## Data flow

```
Admin picks file ─▶ POST /api/admin/uploads/video-signature ─▶ {signature,…}
                 └▶ XHR file ─▶ api.cloudinary.com (direct) ─▶ secure_url
                 └▶ save cms row hero_video=secure_url ─▶ server validates host/path

Visitor ─▶ prerendered HTML (photo only) ─▶ hydrate
        ─▶ useHeroVideo(page) from /api/content-blocks
        ─▶ effect: shouldPlayLoop? ─▶ <video> fades in over photo (720p webm/mp4)
        ─▶ Short card/pill (cover only) ─▶ click ─▶ platform iframe
```

## Error handling

| Failure | Behaviour |
|---|---|
| Cloudinary not configured | Signature endpoint 503; admin toast "Video upload isn't set up"; nothing saved |
| Upload fails or file > 100 MB / wrong type | Admin toast with reason; existing value unchanged |
| Saved URL not ours / Short URL invalid | Server 400; admin shows the message |
| Video fails to load or play on visitor's device | `<video>` removed, photo remains |
| Short embed blocked by the platform | "Watch on …" link under the player |
| CMS fetch fails | No video, no card: hero as today |

## Testing

- **Unit** (`shared/hero-video.test.ts`): `parseShortUrl` (each URL shape per platform,
  look-alike hosts such as `youtube.com.evil.test`, `javascript:`, bad IDs);
  `cloudinaryLoopSources` (transform insertion, poster, rejects non-Cloudinary and image URLs);
  `heroVideoPages`; `shouldPlayLoop` truth table.
- **Server:** signature endpoint returns 401/403 when not admin and a verifiable signature
  for admin; save validation rejects foreign `hero_video` and invalid `hero_short_url`;
  CSP header contains the new directives.
- **Component:** `HeroBackgroundVideo` renders nothing on the first render (hydration
  safety) and nothing when `shouldPlayLoop` is false; `HeroShort` mounts no iframe until clicked.
- **Manual / Playwright (local, `PRERENDER=0`):** desktop shows loop + card; 375 px
  shows photo + pill + dialog; `prefers-reduced-motion` shows the photo only; Tours shows the
  video only when ticked; prerendered HTML still contains the hero `<img>` and no `<video>`/`<iframe>`.
- `tsc` and the full test suite pass locally before pushing (CI is not available).

## Rollout

- Ships switched off: with no CMS values set, every hero renders exactly as today.
- After deploy, the client uploads a clip and/or pastes a Short link. As with the photos,
  a redeploy re-prerenders pages. The video itself loads client-side, so it appears
  without a redeploy.
- Update `docs/CLIENT_HANDOVER.md` with a short "Hero video" how-to (recommended clip:
  landscape, 10–15 s, no important action in the top/bottom edges).

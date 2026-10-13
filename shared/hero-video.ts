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
    // instagram.com/<username>/reel/<id>/ (newer web links)
    if (parts[1] === "reel" || parts[1] === "reels") return instagram("reel", parts[2]);
    if (parts[1] === "p") return instagram("p", parts[2]);
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

/** Shown when a Short link can't be used (admin card and server). */
export const SHORT_URL_HELP =
  "Paste a YouTube, Instagram or Facebook video link. For Facebook, open the video and copy the address from the browser bar (facebook.com/reel/… or …/videos/…), not a \u201cCopy link\u201d share link.";

// ─── Background loop ─────────────────────────────────────────────────────────

export interface LoopSources {
  webm: string;
  mp4: string;
  poster: string;
}

// Silent, first 15 s, 16:9 at 1280 px, economy quality: a 50 MB upload plays as ~2–4 MB.
const LOOP_TRANSFORM = "ac_none,du_15,c_fill,ar_16:9,w_1280,q_auto:eco";
const POSTER_TRANSFORM = "so_0,c_fill,ar_16:9,w_1280,q_auto";

/**
 * The same three versions, built by Cloudinary right after upload (eager, async). Large
 * videos can't be transformed on the fly when first requested, so without this a big
 * upload would save fine but never play. Signed into the upload request.
 */
export const HERO_LOOP_EAGER = [`${LOOP_TRANSFORM}/webm`, `${LOOP_TRANSFORM}/mp4`, `${POSTER_TRANSFORM}/jpg`].join("|");
const CLD_VIDEO = /^https:\/\/res\.cloudinary\.com\/([a-z0-9_-]+)\/video\/upload\/([A-Za-z0-9_\-./:,]+)\.([A-Za-z0-9]{2,5})$/;

/** Delivery URLs for the hero loop, from the Cloudinary URL of the original upload. */
export function cloudinaryLoopSources(url: string | null | undefined): LoopSources | null {
  const m = CLD_VIDEO.exec((url ?? "").trim());
  if (!m) return null;
  const [, cloud, path] = m;
  // "." / ".." segments would let the browser resolve the URL outside our folder or cloud.
  if (path.split("/").some((seg) => seg === "." || seg === "..")) return null;
  const root = `https://res.cloudinary.com/${cloud}/video/upload`;
  return {
    webm: `${root}/${LOOP_TRANSFORM}/${path}.webm`,
    mp4: `${root}/${LOOP_TRANSFORM}/${path}.mp4`,
    poster: `${root}/${POSTER_TRANSFORM}/${path}.jpg`,
  };
}

/**
 * <source> order for the loop. Browsers play the first one they support; at our settings
 * the MP4 is the smaller file (e.g. 4.5 MB vs 6.4 MB WebM) and every browser plays it.
 */
export function loopSourceList(sources: LoopSources): { src: string; type: string }[] {
  return [
    { src: sources.mp4, type: "video/mp4" },
    { src: sources.webm, type: "video/webm" },
  ];
}

export function isOwnCloudinaryVideo(url: string, cloudName: string): boolean {
  return cloudinaryLoopSources(url) !== null && url.trim().startsWith(`https://res.cloudinary.com/${cloudName}/video/upload/`);
}

/** Formats the admin may upload (also signed into the upload, so Cloudinary refuses others). */
export const HERO_VIDEO_FORMATS = ["mp4", "webm", "mov"] as const;
const HERO_VIDEO_MIME = new Set(["video/mp4", "video/webm", "video/quicktime"]);

/** True for an MP4/WebM/MOV file. Windows often reports no type for .mov, so fall back to the extension. */
export function isAcceptedHeroVideoFile(file: { name: string; type: string }): boolean {
  if (file.type) return HERO_VIDEO_MIME.has(file.type);
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return (HERO_VIDEO_FORMATS as readonly string[]).includes(ext);
}

/** A play() rejection that means "give up and keep the photo". AbortError only means play was interrupted. */
export function isFatalPlayError(err: unknown): boolean {
  return !(err && typeof err === "object" && (err as { name?: unknown }).name === "AbortError");
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
      return parseShortUrl(value) ? null : SHORT_URL_HELP;
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

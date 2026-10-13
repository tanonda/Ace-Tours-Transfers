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
  HERO_LOOP_EAGER,
  HERO_VIDEO_FORMATS,
  SHORT_URL_HELP,
  isAcceptedHeroVideoFile,
  isFatalPlayError,
  loopSourceList,
  type HeroVideoKey,
} from "./hero-video.js";

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
    for (const key of Object.values(HERO_VIDEO_KEYS) as string[]) expect(heroVideoSettingError(row(key, ""), "ours")).toBeNull();
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

describe("HERO_LOOP_EAGER (pre-built at upload so big videos still play)", () => {
  it("lists exactly the three versions the storefront requests", () => {
    const s = cloudinaryLoopSources("https://res.cloudinary.com/ours/video/upload/v1/a.mov")!;
    const wanted = [
      [s.webm, "webm"],
      [s.mp4, "mp4"],
      [s.poster, "jpg"],
    ].map(([url, ext]) => `${url.split("/video/upload/")[1].split("/v1/")[0]}/${ext}`);
    expect(HERO_LOOP_EAGER.split("|")).toEqual(wanted);
  });
});

describe("review follow-ups", () => {
  it("rejects dot segments that would leave our Cloudinary folder", () => {
    const sneaky = "https://res.cloudinary.com/ours/video/upload/../../../../evil/video/upload/v1/x.mp4";
    expect(cloudinaryLoopSources(sneaky)).toBeNull();
    expect(isOwnCloudinaryVideo(sneaky, "ours")).toBe(false);
    expect(cloudinaryLoopSources("https://res.cloudinary.com/ours/video/upload/v1/./x.mp4")).toBeNull();
    expect(cloudinaryLoopSources("https://res.cloudinary.com/ours/video/upload/v1/my.clip.mp4")).not.toBeNull();
  });

  it("accepts Instagram links that include the username", () => {
    expect(parseShortUrl("https://www.instagram.com/acetours/reel/C9xYz_ab-12/?igsh=1")).toMatchObject({ platform: "instagram", id: "C9xYz_ab-12" });
    expect(parseShortUrl("https://www.instagram.com/acetours/p/C9xYz_ab-12/")).toMatchObject({ platform: "instagram", id: "C9xYz_ab-12" });
  });

  it("explains that Facebook share links won't work", () => {
    expect(parseShortUrl("https://www.facebook.com/share/r/1AbCdEf/")).toBeNull();
    expect(SHORT_URL_HELP).toMatch(/share link/);
    expect(heroVideoSettingError({ blockSlug: "home-page", key: "hero_short_url", value: "https://www.facebook.com/share/r/1AbCdEf/" }, "ours")).toBe(SHORT_URL_HELP);
  });

  it("accepts videos by type, or by extension when the browser reports no type", () => {
    expect(HERO_VIDEO_FORMATS).toEqual(["mp4", "webm", "mov"]);
    expect(isAcceptedHeroVideoFile({ name: "a.mp4", type: "video/mp4" })).toBe(true);
    expect(isAcceptedHeroVideoFile({ name: "Beach.MOV", type: "" })).toBe(true);
    expect(isAcceptedHeroVideoFile({ name: "clip.webm", type: "" })).toBe(true);
    expect(isAcceptedHeroVideoFile({ name: "notes.txt", type: "" })).toBe(false);
    expect(isAcceptedHeroVideoFile({ name: "a.mov", type: "image/png" })).toBe(false);
    expect(isAcceptedHeroVideoFile({ name: "a.avi", type: "video/x-msvideo" })).toBe(false);
  });

  it("treats an interrupted play() as temporary, other failures as final", () => {
    expect(isFatalPlayError(new DOMException("interrupted", "AbortError"))).toBe(false);
    expect(isFatalPlayError(new DOMException("blocked", "NotAllowedError"))).toBe(true);
    expect(isFatalPlayError(new DOMException("bad", "NotSupportedError"))).toBe(true);
    expect(isFatalPlayError(undefined)).toBe(true);
  });
});

describe("loopSourceList", () => {
  it("offers MP4 first (smaller at our settings, plays everywhere), then WebM", () => {
    const s = cloudinaryLoopSources("https://res.cloudinary.com/ours/video/upload/v1/a.mov")!;
    expect(loopSourceList(s)).toEqual([
      { src: s.mp4, type: "video/mp4" },
      { src: s.webm, type: "video/webm" },
    ]);
  });
});

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

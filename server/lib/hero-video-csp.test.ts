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

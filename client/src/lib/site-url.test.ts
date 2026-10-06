import { describe, it, expect, vi } from "vitest";
import { resolveSiteUrl, DEFAULT_SITE_URL } from "./site-url";

describe("resolveSiteUrl", () => {
  it("uses a complete https:// origin, without a trailing slash", () => {
    expect(resolveSiteUrl("https://acetoursvanuatu.com")).toBe("https://acetoursvanuatu.com");
    expect(resolveSiteUrl(" https://acetoursvanuatu.com/ ")).toBe("https://acetoursvanuatu.com");
  });

  it("falls back to the default when unset", () => {
    expect(resolveSiteUrl(undefined)).toBe(DEFAULT_SITE_URL);
    expect(resolveSiteUrl("")).toBe(DEFAULT_SITE_URL);
  });

  it.each([
    ["missing //", "https:acetoursvanuatu.com"],
    ["one slash", "https:/acetoursvanuatu.com"],
    ["plain http", "http://acetoursvanuatu.com"],
    ["no scheme", "acetoursvanuatu.com"],
    ["with a path", "https://acetoursvanuatu.com/tours"],
    ["no domain dot", "https://acetoursvanuatu"],
    ["javascript", "javascript:alert(1)"],
  ])("ignores a malformed value (%s)", (_why, raw) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolveSiteUrl(raw)).toBe(DEFAULT_SITE_URL);
    warn.mockRestore();
  });

  it("allows a local dev address", () => {
    expect(resolveSiteUrl("http://localhost:5000")).toBe("http://localhost:5000");
  });
});

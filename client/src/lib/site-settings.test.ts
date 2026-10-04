import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPublicSiteSettings, SITE_SETTINGS_QUERY_KEY } from "./site-settings";

afterEach(() => vi.unstubAllGlobals());

describe("fetchPublicSiteSettings", () => {
  it("returns the settings array", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([{ key: "app_url", value: "x" }]))));
    expect(await fetchPublicSiteSettings()).toEqual([{ key: "app_url", value: "x" }]);
  });

  it("degrades to an empty list on HTTP errors, bad payloads and network failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("oops", { status: 500 })));
    expect(await fetchPublicSiteSettings()).toEqual([]);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ not: "an array" }))));
    expect(await fetchPublicSiteSettings()).toEqual([]);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await fetchPublicSiteSettings()).toEqual([]);
  });

  it("shares the cache key the admin settings page invalidates after a save", () => {
    expect(SITE_SETTINGS_QUERY_KEY).toEqual(["settings"]);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPublicSiteSettings, productContact, SITE_SETTINGS_QUERY_KEY } from "./site-settings";

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

describe("productContact", () => {
  const settings = [
    { key: "contact_email", value: "acetoursvanuatu@outlook.com" },
    { key: "contact_phone", value: "+678 7114045" },
    { key: "contact_phone_2", value: "7342389" },
  ];

  it("falls back to the contact page's email and both phone numbers", () => {
    expect(productContact({}, settings)).toEqual({
      email: "acetoursvanuatu@outlook.com",
      phones: [
        { display: "+678 711 4045", tel: "tel:+6787114045" },
        { display: "+678 734 2389", tel: "tel:+6787342389" },
      ],
    });
  });

  it("uses the product's own email and phone when it has them", () => {
    expect(productContact({ supportEmail: "a@b.vu", supportPhone: "5551234" }, settings)).toEqual({
      email: "a@b.vu",
      phones: [{ display: "+678 555 1234", tel: "tel:+6785551234" }],
    });
  });

  it("treats blank product fields as unset", () => {
    expect(productContact({ supportEmail: " ", supportPhone: "" }, settings).phones).toHaveLength(2);
  });

  it("uses the built-in numbers before settings have loaded", () => {
    expect(productContact({}, undefined)).toEqual(productContact({}, settings));
  });
});

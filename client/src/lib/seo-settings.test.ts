import { describe, expect, it } from "vitest";
import { readSeoSettings, resolveSeo } from "./seo-settings";

const FALLBACKS = {
  siteName: "Ace Tours & Transfers Vanuatu",
  description: "Built-in default description.",
  image: "https://res.cloudinary.com/x/default.png",
  keywords: ["Ace Tours Vanuatu", "Efate tours"],
};

const settingsFrom = (values: Record<string, unknown>) => readSeoSettings((key) => values[key] ?? null);

describe("readSeoSettings", () => {
  it("reads the admin SEO settings", () => {
    expect(
      settingsFrom({
        seo_site_name: "Ace Tours",
        seo_title_template: "{page} | Ace Tours Vanuatu",
        seo_default_description: "Admin description.",
        seo_default_keywords: "vanuatu tours, port vila transfers",
        seo_og_image: "https://res.cloudinary.com/x/og.png",
      }),
    ).toEqual({
      siteName: "Ace Tours",
      titleTemplate: "{page} | Ace Tours Vanuatu",
      defaultDescription: "Admin description.",
      defaultKeywords: ["vanuatu tours", "port vila transfers"],
      ogImage: "https://res.cloudinary.com/x/og.png",
    });
  });

  it("ignores blank, non-string and non-http values", () => {
    expect(
      settingsFrom({
        seo_site_name: "   ",
        seo_title_template: 42,
        seo_default_description: { not: "a string" },
        seo_default_keywords: " , ,",
        seo_og_image: "javascript:alert(1)",
      }),
    ).toEqual({});
  });
});

describe("resolveSeo", () => {
  const page = { title: "Efate Tours", description: "Page description.", keywords: ["blue lagoon"] };

  it("applies the title template", () => {
    const seo = resolveSeo(page, { titleTemplate: "{page} | Ace Tours Vanuatu" }, FALLBACKS);
    expect(seo.fullTitle).toBe("Efate Tours | Ace Tours Vanuatu");
  });

  it("falls back to 'title | site name' when the template has no {page}", () => {
    expect(resolveSeo(page, { titleTemplate: "Ace Tours" }, FALLBACKS).fullTitle).toBe(
      "Efate Tours | Ace Tours & Transfers Vanuatu",
    );
    expect(resolveSeo(page, { siteName: "Ace Tours" }, FALLBACKS).fullTitle).toBe("Efate Tours | Ace Tours");
  });

  it("drops a brand suffix the page title already carries before applying the template", () => {
    const template = { titleTemplate: "{page} | Ace Tours Vanuatu" };
    const full = (title: string) => resolveSeo({ title }, template, FALLBACKS).fullTitle;
    expect(full("Pele Island Beach Day Tour | Ace Tours")).toBe("Pele Island Beach Day Tour | Ace Tours Vanuatu");
    expect(full("Efate Scenic Tour | Ace Tours Vanuatu")).toBe("Efate Scenic Tour | Ace Tours Vanuatu");
    expect(full("Havannah Transfers | Port Vila | ace tours")).toBe("Havannah Transfers | Port Vila | Ace Tours Vanuatu");
  });

  it("uses a title that already names the brand as-is", () => {
    const seo = resolveSeo(
      { title: "Ace Tours & Transfers - Private Tours in Vanuatu", isHomePage: true },
      { titleTemplate: "{page} | Ace Tours Vanuatu" },
      FALLBACKS,
    );
    expect(seo.fullTitle).toBe("Ace Tours & Transfers - Private Tours in Vanuatu");
  });

  it("keeps a page's own description on inner pages", () => {
    const seo = resolveSeo(page, { defaultDescription: "Admin description." }, FALLBACKS);
    expect(seo.description).toBe("Page description.");
  });

  it("uses the admin default description on the homepage", () => {
    const seo = resolveSeo({ ...page, isHomePage: true }, { defaultDescription: "Admin description." }, FALLBACKS);
    expect(seo.description).toBe("Admin description.");
  });

  it("uses the admin default description when a page has none", () => {
    const seo = resolveSeo({ title: "Contact" }, { defaultDescription: "Admin description." }, FALLBACKS);
    expect(seo.description).toBe("Admin description.");
    expect(seo.businessDescription).toBe("Admin description.");
  });

  it("falls back to built-in values when no settings exist", () => {
    const seo = resolveSeo({ title: "Contact" }, {}, FALLBACKS);
    expect(seo).toMatchObject({
      fullTitle: "Contact | Ace Tours & Transfers Vanuatu",
      siteName: "Ace Tours & Transfers Vanuatu",
      description: "Built-in default description.",
      image: "https://res.cloudinary.com/x/default.png",
      keywords: "Ace Tours Vanuatu, Efate tours",
    });
  });

  it("replaces the built-in keywords with the admin defaults, then adds page keywords without duplicates", () => {
    const seo = resolveSeo(
      { title: "T", keywords: ["blue lagoon", "Vanuatu Tours"] },
      { defaultKeywords: ["vanuatu tours", "port vila transfers"] },
      FALLBACKS,
    );
    expect(seo.keywords).toBe("vanuatu tours, port vila transfers, blue lagoon");
  });

  it("uses the admin OG image only when the page has no image of its own", () => {
    const settings = { ogImage: "https://res.cloudinary.com/x/og.png" };
    expect(resolveSeo({ title: "T" }, settings, FALLBACKS).image).toBe("https://res.cloudinary.com/x/og.png");
    expect(resolveSeo({ title: "T", image: "https://p/tour.jpg" }, settings, FALLBACKS).image).toBe("https://p/tour.jpg");
  });
});

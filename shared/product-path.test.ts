import { describe, expect, it } from "vitest";
import { isProductId, productPath, productSlugBase } from "./product-path";

describe("productPath", () => {
  it("uses the slug under the section for the product's category", () => {
    expect(productPath({ id: "abc", slug: "mele-cascades-tour", category: "tour" })).toBe("/tours/mele-cascades-tour");
    expect(productPath({ id: "abc", slug: "airport-transfer", category: "transfer" })).toBe("/transfers/airport-transfer");
  });

  it("falls back to the id while a product has no slug", () => {
    expect(productPath({ id: "abc", slug: null, category: "tour" })).toBe("/tours/abc");
    expect(productPath({ id: "abc", category: "transfer" })).toBe("/transfers/abc");
  });
});

describe("productSlugBase", () => {
  it("keeps the main title before any ' | ' subtitle", () => {
    expect(productSlugBase("Roots & Routes Cultural Tour | Kava Tasting | Port Vila, Custom Village Experience")).toBe(
      "roots-routes-cultural-tour",
    );
  });

  it("caps long titles at 60 characters on a word boundary", () => {
    const slug = productSlugBase("Events Transfer Package: Professional Group Logistics for Conferences Weddings and Festivals");
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug).toBe("events-transfer-package-professional-group-logistics-for");
  });

  it("drops emoji and accents", () => {
    expect(productSlugBase("✈️ Premium Airport Transfer")).toBe("premium-airport-transfer");
    expect(productSlugBase("Café Tour")).toBe("cafe-tour");
  });

  it("never returns an empty slug", () => {
    expect(productSlugBase("✈️")).toBe("product");
  });
});

describe("isProductId", () => {
  it("recognises UUIDs, not slugs", () => {
    expect(isProductId("90b13e31-6e1b-44e9-942c-667203409126")).toBe(true);
    expect(isProductId("blue-lagoon-turtle-bay-combo")).toBe(false);
  });
});

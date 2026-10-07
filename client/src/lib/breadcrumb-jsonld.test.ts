import { describe, expect, it } from "vitest";
import { buildBreadcrumbJsonLd } from "./breadcrumb-jsonld";

describe("buildBreadcrumbJsonLd", () => {
  it("lists each crumb with its position and absolute URL", () => {
    expect(
      buildBreadcrumbJsonLd(
        [
          { name: "Home", path: "/" },
          { name: "Tours", path: "/tours" },
          { name: "Blue Lagoon & Turtle Bay Combo", path: "/tours/abc" },
        ],
        "https://acetoursvanuatu.com",
      ),
    ).toEqual({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://acetoursvanuatu.com/" },
        { "@type": "ListItem", position: 2, name: "Tours", item: "https://acetoursvanuatu.com/tours" },
        {
          "@type": "ListItem",
          position: 3,
          name: "Blue Lagoon & Turtle Bay Combo",
          item: "https://acetoursvanuatu.com/tours/abc",
        },
      ],
    });
  });

  it("emits nothing for fewer than two crumbs", () => {
    expect(buildBreadcrumbJsonLd([{ name: "Home", path: "/" }], "https://acetoursvanuatu.com")).toBeNull();
  });
});

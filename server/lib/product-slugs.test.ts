import { describe, expect, it } from "vitest";
import { assignProductSlugs } from "./product-slugs";

describe("assignProductSlugs", () => {
  it("gives slug-less products a slug from their title", () => {
    expect(
      assignProductSlugs([
        { id: "a", title: "Mele Cascades Waterfall Tour", slug: null },
        { id: "b", title: "Wharf / Cruise Ship Transfer", slug: null },
      ]),
    ).toEqual([
      { id: "a", slug: "mele-cascades-waterfall-tour" },
      { id: "b", slug: "wharf-cruise-ship-transfer" },
    ]);
  });

  it("never changes an existing slug and avoids taking it", () => {
    expect(
      assignProductSlugs([
        { id: "a", title: "Renamed Tour", slug: "blue-lagoon-tour" },
        { id: "b", title: "Blue Lagoon Tour", slug: null },
      ]),
    ).toEqual([{ id: "b", slug: "blue-lagoon-tour-2" }]);
  });

  it("de-duplicates titles that share a slug", () => {
    expect(
      assignProductSlugs([
        { id: "a", title: "Airport Transfer", slug: null },
        { id: "b", title: "Airport Transfer | Premium", slug: null },
      ]),
    ).toEqual([
      { id: "a", slug: "airport-transfer" },
      { id: "b", slug: "airport-transfer-2" },
    ]);
  });
});

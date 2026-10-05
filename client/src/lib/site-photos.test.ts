import { describe, it, expect } from "vitest";
import { PHOTO_SLOTS, resolvePhoto, photoCredits } from "./site-photos";

const tours = PHOTO_SLOTS.toursHero;

describe("resolvePhoto", () => {
  it("uses the built-in photo and its credit when the admin has not replaced it", () => {
    expect(resolvePhoto(tours, "", "")).toEqual({ src: tours.src, credit: tours.credit, replaced: false });
  });

  it("uses the admin's photo and drops the built-in credit", () => {
    expect(resolvePhoto(tours, "https://res.cloudinary.com/x/owner.jpg", "")).toEqual({
      src: "https://res.cloudinary.com/x/owner.jpg", credit: null, replaced: true,
    });
  });

  it("keeps a credit the admin typed for a replacement photo", () => {
    const r = resolvePhoto(tours, "https://res.cloudinary.com/x/stock.jpg", "Photo by Jane Doe (CC BY 4.0)");
    expect(r.credit).toEqual({ text: "Photo by Jane Doe (CC BY 4.0)" });
  });

  it("treats a value equal to the built-in photo as not replaced", () => {
    expect(resolvePhoto(tours, tours.src, "").replaced).toBe(false);
  });
});

describe("PHOTO_SLOTS", () => {
  it("gives every slot a unique admin field", () => {
    const fields = Object.values(PHOTO_SLOTS).map((s) => `${s.block}/${s.key}`);
    expect(new Set(fields).size).toBe(fields.length);
  });

  it("ships every built-in photo with a credit", () => {
    for (const slot of Object.values(PHOTO_SLOTS)) expect(slot.credit, slot.label).toBeTruthy();
  });
});

describe("photoCredits", () => {
  it("lists built-in photos once each and skips replaced ones without a credit", () => {
    const cms = (block: string, key: string) =>
      block === "tours-page" && key === "hero_image" ? "https://owner/photo.jpg" : "";
    const list = photoCredits(cms);
    const srcs = list.map((c) => c.src);
    expect(srcs).not.toContain("https://owner/photo.jpg");
    expect(new Set(srcs).size).toBe(srcs.length); // mele-cascades is used twice but listed once
    expect(list.every((c) => c.text || c.credit)).toBe(true);
  });
});

describe("photoCredits for product photos", () => {
  it("credits active products that use a licensed product photo", () => {
    const list = photoCredits(() => "", [
      { title: "Hideaway Island Resort Transfer", image: "/assets/products/hideaway-island-kayaks.webp", isActive: true },
      { title: "Ekasup Cultural Village Tour", image: "/assets/products/ekasup-cultural-village.webp", isActive: false },
      { title: "Roots & Routes | Kava", image: "https://res.cloudinary.com/x/owner-photo.jpg", isActive: true },
    ]);
    const product = list.filter((c) => c.usedOn.some((u) => u.startsWith("Product")));
    expect(product).toHaveLength(1);
    expect(product[0]).toMatchObject({ src: "/assets/products/hideaway-island-kayaks.webp", usedOn: ["Product — Hideaway Island Resort Transfer"] });
    expect(product[0].credit?.author).toBe("Simon_sees");
  });
});

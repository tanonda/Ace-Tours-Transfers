import { describe, expect, it } from "vitest";
import { getProductImage, hasTextContaminatedImage } from "./product-images";

describe("product image cleanup", () => {
  it("detects known generated images with baked-in text", () => {
    expect(hasTextContaminatedImage("/attached_assets/images/vila_city_market_1772981742791.png")).toBe(true);
    expect(hasTextContaminatedImage("https://res.cloudinary.com/demo/image/upload/blue-lagoon-turtle.webp")).toBe(true);
  });

  it("leaves clean product images unchanged", () => {
    const cleanImage = "/assets/mele-cascades.webp";
    expect(hasTextContaminatedImage(cleanImage)).toBe(false);
    expect(getProductImage(cleanImage)).toBe(cleanImage);
  });

  it("uses a text-free fallback for contaminated images", () => {
    expect(getProductImage("/attached_assets/images/events_transport_1772981918262.png")).toBe("/assets/hero_bg.png");
    expect(getProductImage(undefined)).toBe("/assets/hero_bg.png");
  });
});

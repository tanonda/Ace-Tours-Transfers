/**
 * Every editable photo on the public site, in one place.
 *
 * Each slot has a built-in Efate photo (openly licensed, credited) and an admin
 * field (Admin → CMS → <block> → <key>). Uploading a photo there replaces the
 * built-in one and drops its credit; `<key>_credit` lets the admin add a credit
 * for a replacement that needs one. Credits are listed on /photo-credits only,
 * never on the content pages.
 */
import { IMAGE_CREDITS, PRODUCT_PHOTO_CREDITS, type ImageCredit } from "./image-credits";

export interface PhotoSlot {
  block: string;
  key: string;
  page: string;
  label: string;
  src: string;
  credit: ImageCredit;
}

const slot = (block: string, key: string, page: string, label: string, src: string, credit: ImageCredit): PhotoSlot =>
  ({ block, key, page, label, src: `/assets/home/${src}`, credit });

export const PHOTO_SLOTS = {
  homeHero: slot("home-page", "hero_image", "Home", "Hero background", "mele-sunset-yachts.webp", IMAGE_CREDITS.meleSunset),
  homeAbout1: slot("home-page", "about_image", "Home", "About — first polaroid", "mele-cascades.webp", IMAGE_CREDITS.meleCascades),
  homeAbout2: slot("home-page", "about_image_2", "Home", "About — second polaroid", "eratap-beach.webp", IMAGE_CREDITS.eratap),
  homeTours: slot("home-page", "tours_backdrop", "Home", "Tours section background", "vila-bay-ship-sunset.webp", IMAGE_CREDITS.vilaBayShip),
  homeCraft1: slot("home-page", "craft_image_1", "Home", "Local makers — first polaroid", "cocoa-pods-vila-market.webp", IMAGE_CREDITS.cocoaPods),
  homeCraft2: slot("home-page", "craft_image_2", "Home", "Local makers — second polaroid", "port-vila-market-baskets.webp", IMAGE_CREDITS.vilaMarket),
  toursHero: slot("tours-page", "hero_image", "Tours", "Hero background", "blue-lagoon-efate.webp", IMAGE_CREDITS.blueLagoon),
  transfersHero: slot("transfers-page", "hero_image", "Transfers", "Hero background", "iririki-port-vila.webp", IMAGE_CREDITS.iririki),
  aboutHero: slot("about", "hero_image", "About", "Hero background", "erakor-sunset.webp", IMAGE_CREDITS.erakorSunset),
  aboutStory1: slot("about", "story_image", "About", "Our story — first polaroid", "mele-cascades.webp", IMAGE_CREDITS.meleCascades),
  aboutStory2: slot("about", "story_image_2", "About", "Our story — second polaroid", "toniliu-village.webp", IMAGE_CREDITS.toniliu),
  contactHero: slot("contact", "hero_image", "Contact", "Hero background", "port-vila-harbour-day.webp", IMAGE_CREDITS.vilaHarbourDay),
  manageHero: slot("manage-booking", "hero_image", "Manage Booking", "Hero background", "erakor-lagoon.webp", IMAGE_CREDITS.erakorLagoon),
  footer: slot("footer", "background_image", "Every page", "Footer background", "vila-harbour-dusk.webp", IMAGE_CREDITS.vilaHarbourDusk),
} satisfies Record<string, PhotoSlot>;

export type PhotoSlotId = keyof typeof PHOTO_SLOTS;

/** A credit is either a built-in licence credit or free text the admin typed. */
export type PhotoCredit = ImageCredit | { text: string };

export interface ResolvedPhoto {
  src: string;
  credit: PhotoCredit | null;
  replaced: boolean;
}

export function resolvePhoto(slot: PhotoSlot, cmsValue: string | null | undefined, cmsCredit: string | null | undefined): ResolvedPhoto {
  const value = (cmsValue ?? "").trim();
  const customCredit = (cmsCredit ?? "").trim();
  if (!value || value === slot.src) return { src: slot.src, credit: slot.credit, replaced: false };
  return { src: value, credit: customCredit ? { text: customCredit } : null, replaced: true };
}

export interface CreditEntry {
  src: string;
  usedOn: string[];
  credit?: ImageCredit;
  text?: string;
}

/** Credits for every photo currently shown (each photo once), for the Photo credits page. */
export function photoCredits(
  cms: (block: string, key: string) => string,
  products: ReadonlyArray<{ title: string; image?: string | null; isActive?: boolean | null }> = [],
): CreditEntry[] {
  const bySrc = new Map<string, CreditEntry>();
  for (const s of Object.values(PHOTO_SLOTS)) {
    const r = resolvePhoto(s, cms(s.block, s.key), cms(s.block, `${s.key}_credit`));
    if (!r.credit) continue; // the owner's own photo: nothing to credit
    const where = `${s.page} — ${s.label}`;
    const existing = bySrc.get(r.src);
    if (existing) { existing.usedOn.push(where); continue; }
    bySrc.set(r.src, "text" in r.credit
      ? { src: r.src, usedOn: [where], text: r.credit.text }
      : { src: r.src, usedOn: [where], credit: r.credit });
  }
  // Product listing photos that come from openly licensed sources.
  for (const p of products) {
    if (p.isActive === false || !p.image) continue;
    const credit = PRODUCT_PHOTO_CREDITS[p.image];
    if (!credit) continue;
    const where = `Product — ${p.title.split(" | ")[0]}`;
    const existing = bySrc.get(p.image);
    if (existing) existing.usedOn.push(where);
    else bySrc.set(p.image, { src: p.image, usedOn: [where], credit });
  }
  return Array.from(bySrc.values());
}

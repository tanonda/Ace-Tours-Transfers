import { z } from "zod";
import { storage } from "../storage.js";

export type ReviewableBooking = { id: string; userId: string | null; customerName: string; customerEmail: string };
export type ReviewEntry = { productId: string; rating: number; comment?: string };

/** "Sarah Mitchell" → "Sarah M." — public reviews show first name + last initial only. */
export function reviewerDisplayName(customerName: string | null | undefined): string {
  const parts = (customerName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Guest";
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const first = cap(parts[0]);
  return parts.length === 1 ? first : `${first} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

/** Distinct products in a booking; legacy bookings without items fall back to the booking's tour. */
export function bookingProducts(
  booking: { tourId: string; tourName: string },
  items: { productId: string; productName: string }[],
): { productId: string; productName: string }[] {
  const seen = new Map<string, string>();
  for (const it of items) if (!seen.has(it.productId)) seen.set(it.productId, it.productName);
  if (seen.size === 0) seen.set(booking.tourId, booking.tourName);
  return [...seen].map(([productId, productName]) => ({ productId, productName }));
}

export const reviewEntriesSchema = z.object({
  reviews: z.array(z.object({
    productId: z.string().min(1).max(64),
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(2000).optional(),
  }).strict()).min(1).max(10),
}).strict();

/** Save reviews with identity taken from the booking. Pairs already reviewed are reported, not thrown. */
export async function saveVerifiedReviews(booking: ReviewableBooking, entries: ReviewEntry[]) {
  const created: string[] = [];
  const alreadyReviewed: string[] = [];
  for (const e of entries) {
    const review = await storage.createVerifiedReview({
      bookingId: booking.id,
      userId: booking.userId ?? null,
      tourId: e.productId,
      rating: e.rating,
      comment: e.comment ? e.comment : null,
      guestName: reviewerDisplayName(booking.customerName),
      guestEmail: booking.customerEmail || null,
      isGuest: !booking.userId,
    });
    (review ? created : alreadyReviewed).push(e.productId);
  }
  return { created, alreadyReviewed };
}

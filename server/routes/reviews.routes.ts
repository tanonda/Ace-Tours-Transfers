import type { Express, Response } from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import { verifyReviewToken } from "../lib/review-token.js";
import { bookingProducts, reviewEntriesSchema, reviewerDisplayName, saveVerifiedReviews } from "../lib/review-invite.js";
import { sendAdminEmail } from "../lib/mail.js";
import { escapeHtml } from "../lib/escape-html.js";
import { requireAuth, reviewInviteLimiter } from "./shared.js";

const expired = (res: Response) => res.status(410).json({ error: "link_expired" });

/** The completed booking a token points to, or null (bad token, missing, or not completed). */
async function bookingForToken(token: string) {
  const claim = verifyReviewToken(token);
  if (!claim) return null;
  const booking = await storage.getBooking(claim.bookingId);
  return booking && booking.status === "completed" ? booking : null;
}

async function productsFor(booking: any) {
  return bookingProducts(booking, await storage.getBookingItems(booking.id));
}

function notifyAdmin(booking: any, count: number) {
  // Best-effort: a failed notification never fails the customer's submission.
  sendAdminEmail(
    "New review awaiting approval",
    `<p>${count} new review(s) from <strong>${escapeHtml(reviewerDisplayName(booking.customerName))}</strong> are waiting in Admin → Reviews.</p>`,
  ).catch((err) => console.error("[REVIEWS] admin notification failed:", err));
}

const signedInReviewSchema = z.object({
  bookingId: z.string().min(1).max(64),
  tourId: z.string().min(1).max(64),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
}).strict();

export function registerReviewRoutes(app: Express) {
  // Public: approved reviews for the coming-soon page. Whitelisted fields only —
  // raw rows carry guestEmail, userId and bookingId.
  app.get("/api/reviews/approved", async (_req, res) => {
    try {
      const allReviews = await storage.getAllReviews();
      const approved = allReviews
        .filter((r: any) => r.status === "approved" && r.comment)
        .sort((a: any, b: any) => b.rating - a.rating)
        .slice(0, 20)
        .map((r: any) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          authorName: r.authorName,
          tourTitle: r.tourTitle,
        }));
      res.json(approved);
    } catch (error: any) {
      console.error("[ROUTE] GET /api/reviews/approved failed:", error?.message);
      res.status(500).json({ error: "Failed to load reviews." });
    }
  });

  app.get("/api/reviews/invite/:token", async (req, res) => {
    try {
      const booking = await bookingForToken(req.params.token);
      if (!booking) return expired(res);
      const reviewed = new Set(await storage.getReviewedProductIds(booking.id));
      const items = (await productsFor(booking)).map((p) => ({ ...p, reviewed: reviewed.has(p.productId) }));
      res.json({ firstName: reviewerDisplayName(booking.customerName).split(" ")[0], items });
    } catch (error: any) {
      console.error("[ROUTE] GET /api/reviews/invite failed:", error?.message);
      res.status(500).json({ error: "Failed to load review invite." });
    }
  });

  app.post("/api/reviews/invite/:token", reviewInviteLimiter, async (req, res) => {
    try {
      const booking = await bookingForToken(req.params.token);
      if (!booking) return expired(res);
      const parsed = reviewEntriesSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid review." });
      const ids = parsed.data.reviews.map((r) => r.productId);
      if (new Set(ids).size !== ids.length) {
        return res.status(400).json({ error: "Each product can only be reviewed once per submission." });
      }
      const allowed = new Set((await productsFor(booking)).map((p) => p.productId));
      if (ids.some((id) => !allowed.has(id))) {
        return res.status(400).json({ error: "That product is not part of this booking." });
      }
      const result = await saveVerifiedReviews(booking, parsed.data.reviews);
      if (result.created.length === 0) return res.status(409).json({ error: "already_reviewed" });
      notifyAdmin(booking, result.created.length);
      res.json(result);
    } catch (error: any) {
      console.error("[ROUTE] POST /api/reviews/invite failed:", error?.message);
      res.status(500).json({ error: "Failed to submit review. Please try again." });
    }
  });

  app.post("/api/reviews", requireAuth, reviewInviteLimiter, async (req, res) => {
    try {
      const parsed = signedInReviewSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid review." });
      const { bookingId, tourId, rating, comment } = parsed.data;
      const booking = await storage.getBooking(bookingId);
      if (!booking || booking.userId !== req.session.userId || booking.status !== "completed") {
        return res.status(403).json({ error: "You can review a booking once it is completed." });
      }
      if (!(await productsFor(booking)).some((p) => p.productId === tourId)) {
        return res.status(400).json({ error: "That product is not part of this booking." });
      }
      const result = await saveVerifiedReviews(booking, [{ productId: tourId, rating, comment }]);
      if (result.created.length === 0) return res.status(409).json({ error: "already_reviewed" });
      notifyAdmin(booking, 1);
      res.json(result);
    } catch (error: any) {
      console.error("[ROUTE] POST /api/reviews failed:", error?.message);
      res.status(500).json({ error: "Failed to submit review. Please try again." });
    }
  });
}

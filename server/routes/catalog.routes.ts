import type { Express } from "express";
import { invalidPersonName } from "../../shared/person-name.js";
import { storage } from "../storage.js";
import { db } from "../db.js";
import { sql, eq, desc } from "drizzle-orm";
import * as schema from "../../shared/schema.js";
import { insertProductSchema, insertReviewSchema } from "../../shared/schema.js";
import { cloudinaryService } from "../infrastructure/storage/cloudinary-service.js";
import { withProductTranslations } from "../lib/product-translation.service.js";

import { ZodError } from "zod";

import { requireAdmin, requireAuth, reviewsLimiter, upload, uploadToCloudinaryLegacy } from "./shared.js";

export function registerCatalogRoutes(app: Express) {
  // Image Upload API (Admin Only)
  app.post("/api/admin/upload", requireAdmin, upload.single("image"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No image file provided" });
      const folder = (req.query.folder as string) || "ace-tours-uploads";
      let imageUrl: string;
      // Try CloudinaryService first (uses CLOUDINARY_URL), fall back to legacy config
      try {
        imageUrl = await cloudinaryService.uploadImage(req.file.buffer, folder);
      } catch (serviceErr: any) {
        console.warn('[UPLOAD] CloudinaryService failed, trying legacy config:', serviceErr.message);
        imageUrl = await uploadToCloudinaryLegacy(req.file.buffer, req.file.originalname || 'upload');
      }
      res.json({ url: imageUrl });
    } catch (error: any) {
      console.error('[UPLOAD] All Cloudinary upload attempts failed:', error.message);
      res.status(500).json({ error: error.message || "Failed to upload image. Check Cloudinary credentials." });
    }
  });

  // Products API (covers tours and transfers)
  app.get("/api/products", async (req, res) => {
    try {
      const locale = (req.query.locale as string) || "en";
      const productsList = await storage.getProducts();
      const translated = await withProductTranslations(productsList, locale);
      res.json(translated);
    } catch (error: any) {
      console.error("[ROUTE] GET /api/products failed:", error?.message, error?.code);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const locale = (req.query.locale as string) || "en";
      const product = await storage.getProduct(req.params.id);
      if (!product) return res.status(404).json({ error: "Product not found" });
      const [translated] = await withProductTranslations([product], locale);
      // Include product-specific addons — failure must not break the whole endpoint
      res.json({ ...translated, addons: [] });
    } catch (error: any) {
      console.error("[ROUTE] GET /api/products/:id failed:", error?.message, error?.code);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  // Google Places Reviews — server-side proxy (keeps API key secret)
  // Reads GOOGLE_PLACES_API_KEY + GOOGLE_PLACE_ID from env.
  // Returns { configured: false } when either env var is missing.
  // Cached in-process for 1 hour to stay inside the Places API free tier.
  const _googleReviewsCache = new Map<string, { data: any; expiresAt: number }>();
  app.get("/api/google-reviews", async (_req, res) => {
    try {
      const apiKey = process.env.GOOGLE_PLACES_API_KEY;
      const placeId = process.env.GOOGLE_PLACE_ID;

      if (!apiKey || !placeId) {
        return res.json({ configured: false });
      }

      // Serve from cache if still fresh
      const cached = _googleReviewsCache.get(placeId);
      if (cached && Date.now() < cached.expiresAt) {
        return res.json(cached.data);
      }

      // Fetch from Google Places Details API
      const url =
        `https://maps.googleapis.com/maps/api/place/details/json` +
        `?place_id=${encodeURIComponent(placeId)}` +
        `&fields=name,rating,user_ratings_total,reviews,url` +
        `&language=en` +
        `&key=${apiKey}`;

      const response = await fetch(url);
      if (!response.ok) {
        console.error("[GOOGLE-REVIEWS] Places API HTTP error:", response.status);
        return res.status(502).json({ configured: true, error: "Places API unavailable" });
      }

      const json = await response.json() as any;
      if (json.status !== "OK") {
        console.error("[GOOGLE-REVIEWS] Places API error status:", json.status, json.error_message);
        return res.status(502).json({ configured: true, error: json.status });
      }

      const place = json.result;
      const payload = {
        configured: true,
        rating: place.rating ?? null,
        totalReviews: place.user_ratings_total ?? 0,
        placeUrl: place.url ?? `https://search.google.com/local/reviews?placeid=${placeId}`,
        reviews: (place.reviews ?? []).map((r: any) => ({
          author: r.author_name,
          rating: r.rating,
          text: r.text,
          time: r.time,
          relativeTime: r.relative_time_description,
          profilePhoto: r.profile_photo_url ?? null,
        })),
      };

      // Cache for 1 hour
      _googleReviewsCache.set(placeId, { data: payload, expiresAt: Date.now() + 60 * 60 * 1000 });
      return res.json(payload);
    } catch (error: any) {
      console.error("[GOOGLE-REVIEWS] Unexpected error:", error?.message);
      res.status(500).json({ configured: true, error: "Internal error fetching Google reviews" });
    }
  });

  // Reviews — works for tours and transfers (all share the products table)
  app.get("/api/products/:id/reviews", async (req, res) => {
    try {
      const reviews = await storage.getProductReviews(req.params.id);
      res.json(reviews);
    } catch (error: any) {
      console.error("[ROUTE] GET /api/products/:id/reviews failed:", error?.message);
      res.status(500).json({ error: "Failed to fetch reviews." });
    }
  });



  // Public: approved reviews for coming soon page (no auth required)
  app.get("/api/reviews/approved", async (_req, res) => {
    try {
      const allReviews = await storage.getAllReviews();
      const approved = allReviews
        .filter((r: any) => r.status === "approved" && r.comment)
        .sort((a: any, b: any) => b.rating - a.rating)
        .slice(0, 20);
      res.json(approved);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Guest review submission (no auth required, requires moderation)
  app.post("/api/reviews/guest", reviewsLimiter, async (req, res) => {
    try {
      // Check if guest reviews feature flag is enabled
      const guestReviewsFlag = await storage.getFeatureFlag("guest-reviews");
      if (guestReviewsFlag && !guestReviewsFlag.enabled) {
        return res.status(403).json({ error: "Guest reviews are currently disabled. Please create an account to leave a review." });
      }

      const { tourId, rating, comment, guestName, guestEmail } = req.body;
      if (!tourId || !rating) return res.status(400).json({ error: "tourId and rating are required" });
      if (rating < 1 || rating > 5) return res.status(400).json({ error: "rating must be 1-5" });
      const nameError = invalidPersonName(guestName);
      if (nameError) return res.status(400).json({ error: nameError });

      // Sanitize & cap all user-supplied string fields
      const safeComment = typeof comment === "string" ? comment.trim().slice(0, 2000) : null;
      const safeGuestName = typeof guestName === "string" ? guestName.trim().slice(0, 100) : "Anonymous";
      const safeGuestEmail = typeof guestEmail === "string" ? guestEmail.trim().slice(0, 254) : null;

      // Basic email format check
      if (safeGuestEmail) {
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRe.test(safeGuestEmail)) return res.status(400).json({ error: "Invalid email address" });
      }

      const review = await storage.createGuestReview({
        tourId,
        rating: parseInt(rating),
        comment: safeComment,
        guestName: safeGuestName,
        guestEmail: safeGuestEmail,
        isGuest: true,
        status: "pending", // requires moderation
      });
      res.json({ success: true, id: review.id, message: "Thank you! Your review will appear after moderation." });
    } catch (error: any) {
      console.error("[ROUTE] POST /api/reviews/guest failed:", error?.message);
      res.status(500).json({ error: "Failed to submit review. Please try again." });
    }
  });

  app.post("/api/reviews", requireAuth, async (req, res) => {
    try {
      const parsedReview = insertReviewSchema.parse(req.body);
      const review = await storage.createReview({
        ...parsedReview,
        userId: req.session.userId!
      });
      res.json(review);
    } catch (error: any) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error("[ROUTE] POST /api/reviews failed:", error?.message);
        res.status(500).json({ error: "Failed to submit review. Please try again." });
      }
    }
  });

  app.post("/api/products", requireAdmin, async (req, res) => {
    try {
      const body = req.body;
      // Ensure adultPriceCents is set — derive from price string if missing
      if (body.adultPriceCents === undefined || body.adultPriceCents === null) {
        const priceStr = String(body.price || "0");
        const match = priceStr.match(/[\d,]+(\.\d+)?/);
        body.adultPriceCents = match ? Math.round(parseFloat(match[0].replace(/,/g, "")) * 100) : 0;
      }
      if (body.childPriceCents === undefined || body.childPriceCents === null) {
        const childStr = String(body.childPrice || "0");
        const match = childStr.match(/[\d,]+(\.\d+)?/);
        body.childPriceCents = match ? Math.round(parseFloat(match[0].replace(/,/g, "")) * 100) : 0;
      }
      const validatedData = insertProductSchema.parse(body);
      const product = await storage.createProduct(validatedData);
      res.status(201).json(product);
    } catch (error) {
      console.error("[ROUTE] POST /api/products Error:", error);
      res.status(400).json({ error: "Invalid product data" });
    }
  });

  app.put("/api/products/:id", requireAdmin, async (req, res) => {
    try {
      const { id, ...rawData } = req.body;

      // Strip form-only fields that live in the ProductDialog state but are NOT
      // database columns. Passing them to Drizzle .set() throws a runtime error.
      const FORM_HELPER_FIELDS = new Set([
        "adultPriceInput", "childPriceInput", "groupPriceInput",
        "tourOverview", "inclusions", "transferDetail",
        "addons",           // joined at read time, never written back
      ]);
      const updateData: Record<string, unknown> = Object.fromEntries(
        Object.entries(rawData).filter(([k]) => !FORM_HELPER_FIELDS.has(k))
      );

      // Ensure priceCents fields are set if missing
      if (updateData.adultPriceCents === undefined && updateData.price) {
        const match = String(updateData.price).match(/[\d,]+(\.\d+)?/);
        updateData.adultPriceCents = match ? Math.round(parseFloat(match[0].replace(/,/g, "")) * 100) : 0;
      }
      if (updateData.childPriceCents === undefined && updateData.childPrice !== undefined) {
        const match = String(updateData.childPrice || "0").match(/[\d,]+(\.\d+)?/);
        updateData.childPriceCents = match ? Math.round(parseFloat(match[0].replace(/,/g, "")) * 100) : 0;
      }
      const product = await storage.updateProduct(req.params.id, updateData);
      res.json(product);
    } catch (error) {
      console.error("[ROUTE] PUT /api/products/:id Error:", error);
      res.status(400).json({ error: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", requireAdmin, async (req, res) => {
    const id = req.params.id;
    const force = req.query.force === "true";
    try {
      // Check if product exists
      const product = await storage.getProduct(id);
      if (!product) return res.status(404).json({ error: "Product not found" });

      if (force) {
        // Hard-delete: cascade-wipe all dependents first (pre-launch / test data only)
        // Order matters — children before parents
        await db.execute(sql`DELETE FROM availability_holds WHERE tour_instance_id IN (SELECT id FROM tour_instances WHERE tour_id = ${id})`);
        await db.execute(sql`DELETE FROM capacity_audit_log WHERE tour_instance_id IN (SELECT id FROM tour_instances WHERE tour_id = ${id})`);
        await db.execute(sql`DELETE FROM tour_instances WHERE tour_id = ${id}`);
        await db.execute(sql`DELETE FROM wishlist_items WHERE tour_id = ${id}`);
        await db.execute(sql`DELETE FROM pricing_versions WHERE product_id = ${id}`);
        await db.execute(sql`DELETE FROM product_blackout_dates WHERE product_id = ${id}`);
        await db.execute(sql`DELETE FROM resources WHERE product_id = ${id}`);
        // Cascade-wipe bookings and their children
        await db.execute(sql`DELETE FROM booking_addons WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id = ${id})`);
        await db.execute(sql`DELETE FROM booking_items WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id = ${id})`);
        await db.execute(sql`DELETE FROM payments WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id = ${id})`);
        await db.execute(sql`DELETE FROM bookings WHERE tour_id = ${id}`);
        await storage.deleteProduct(id);
        return res.json({ message: "Product permanently deleted", deleted: true });
      }

      // Soft-delete: check for dependencies first
      const instanceResult = await db.execute(sql`SELECT count(*)::int AS n FROM tour_instances WHERE tour_id = ${id}`);
      const bookingResult = await db.execute(sql`SELECT count(*)::int AS n FROM bookings WHERE tour_id = ${id}`);
      const instances = (instanceResult.rows[0] as any)?.n ?? 0;
      const bkgs = (bookingResult.rows[0] as any)?.n ?? 0;

      if (instances > 0 || bkgs > 0) {
        // Has live data — soft-delete only (hide from storefront)
        await storage.updateProduct(id, { isActive: false } as any);
        return res.json({
          message: "Product hidden from storefront (has linked bookings or schedule — use force delete to permanently remove)",
          softDeleted: true,
          dependents: { tourInstances: instances, bookings: bkgs },
        });
      }

      // No linked data — safe to hard-delete directly
      await db.execute(sql`DELETE FROM wishlist_items WHERE tour_id = ${id}`);
      await db.execute(sql`DELETE FROM pricing_versions WHERE product_id = ${id}`);
      await db.execute(sql`DELETE FROM product_blackout_dates WHERE product_id = ${id}`);
      await db.execute(sql`DELETE FROM resources WHERE product_id = ${id}`);
      await storage.deleteProduct(id);
      res.json({ message: "Product deleted successfully", deleted: true });
    } catch (error) {
      console.error("[ROUTE] DELETE /api/products/:id Error:", error);
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  // Pre-launch data reset endpoint
  app.post("/api/admin/reset", requireAdmin, async (req, res) => {
    const { keepProductIds = [], scope = {} } = req.body as {
      keepProductIds: string[];
      scope: {
        bookings?: boolean;
        payments?: boolean;
        holds?: boolean;
        users?: boolean;
        newsletter?: boolean;
        reviews?: boolean;
        products?: boolean;
      };
    };
    try {
      const deleted: Record<string, number> = {};

      if (scope.holds) {
        const r = await db.execute(sql`DELETE FROM availability_holds`);
        deleted.holds = (r as any).rowCount ?? 0;
        await db.execute(sql`DELETE FROM capacity_audit_log`);
      }

      if (scope.bookings || scope.payments) {
        await db.execute(sql`DELETE FROM booking_addons`);
        await db.execute(sql`DELETE FROM booking_items`);
        if (scope.payments) {
          const r = await db.execute(sql`DELETE FROM payments`);
          deleted.payments = (r as any).rowCount ?? 0;
        }
        if (scope.bookings) {
          const r = await db.execute(sql`DELETE FROM bookings`);
          deleted.bookings = (r as any).rowCount ?? 0;
        }
      }

      if (scope.reviews) {
        const r = await db.execute(sql`DELETE FROM reviews`);
        deleted.reviews = (r as any).rowCount ?? 0;
      }

      if (scope.newsletter) {
        const r = await db.execute(sql`DELETE FROM newsletter_subscribers`);
        deleted.newsletter = (r as any).rowCount ?? 0;
      }

      if (scope.users) {
        // Never delete the admin account
        const r = await db.execute(sql`DELETE FROM users WHERE role != 'admin'`);
        deleted.users = (r as any).rowCount ?? 0;
        await db.execute(sql`DELETE FROM wishlist_items WHERE user_id NOT IN (SELECT id FROM users)`);
      }

      if (scope.products) {
        // Delete all products EXCEPT those in keepProductIds
        const toDelete = await db.execute(
          keepProductIds.length > 0
            ? sql`SELECT id FROM products WHERE id NOT IN (${sql.raw(keepProductIds.map(id => `'${id.replace(/'/g, "''")}'`).join(","))})`
            : sql`SELECT id FROM products`
        );
        for (const row of (toDelete as any).rows ?? []) {
          const pid = row.id;
          await db.execute(sql`DELETE FROM availability_holds WHERE tour_instance_id IN (SELECT id FROM tour_instances WHERE tour_id = ${pid})`);
          await db.execute(sql`DELETE FROM capacity_audit_log WHERE tour_instance_id IN (SELECT id FROM tour_instances WHERE tour_id = ${pid})`);
          await db.execute(sql`DELETE FROM tour_instances WHERE tour_id = ${pid}`);
          await db.execute(sql`DELETE FROM wishlist_items WHERE tour_id = ${pid}`);
          await db.execute(sql`DELETE FROM pricing_versions WHERE product_id = ${pid}`);
          await db.execute(sql`DELETE FROM product_blackout_dates WHERE product_id = ${pid}`);
          await db.execute(sql`DELETE FROM resources WHERE product_id = ${pid}`);
          await db.execute(sql`DELETE FROM booking_addons WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id = ${pid})`);
          await db.execute(sql`DELETE FROM booking_items WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id = ${pid})`);
          await db.execute(sql`DELETE FROM payments WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id = ${pid})`);
          await db.execute(sql`DELETE FROM bookings WHERE tour_id = ${pid}`);
          await db.execute(sql`DELETE FROM products WHERE id = ${pid}`);
        }
        deleted.products = ((toDelete as any).rows ?? []).length;
        // Also wipe tour_instances for any surviving products
        if (keepProductIds.length === 0) {
          await db.execute(sql`DELETE FROM tour_instances`);
        }
      }

      res.json({ ok: true, deleted });
    } catch (error) {
      console.error("[ROUTE] POST /api/admin/reset Error:", error);
      res.status(500).json({ error: "Reset failed", detail: String(error) });
    }
  });

  // Addons API
  app.get("/api/addons", async (_req, res) => {
    try {
      const addons = await storage.getActiveAddons();
      res.json(addons);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch addons" });
    }
  });

  // Admin: full addon CRUD
  app.get("/api/admin/addons", requireAdmin, async (_req, res) => {
    try { res.json(await storage.getAddons()); }
    catch { res.status(500).json({ error: "Failed to fetch addons" }); }
  });

  app.post("/api/admin/addons", requireAdmin, async (req, res) => {
    try { res.json(await storage.createAddon(req.body)); }
    catch { res.status(500).json({ error: "Failed to create addon" }); }
  });

  app.patch("/api/admin/addons/:id", requireAdmin, async (req, res) => {
    try { res.json(await storage.updateAddon(req.params.id, req.body)); }
    catch { res.status(500).json({ error: "Failed to update addon" }); }
  });

  app.delete("/api/admin/addons/:id", requireAdmin, async (req, res) => {
    try { await storage.deleteAddon(req.params.id); res.json({ success: true }); }
    catch { res.status(500).json({ error: "Failed to delete addon" }); }
  });

  // Product-specific addons
  app.get("/api/products/:productId/addons", async (req, res) => {
    try { res.json([]); }
    catch { res.status(500).json({ error: "Failed to fetch product addons" }); }
  });

  app.post("/api/products/:productId/addons", requireAdmin, async (req, res) => {
    try { res.status(400).json({ error: "Product addons not supported" }); }
    catch { res.status(500).json({ error: "Failed to add product addon" }); }
  });

  app.patch("/api/products/:productId/addons/:id", requireAdmin, async (req, res) => {
    try { res.status(400).json({ error: "Product addons not supported" }); }
    catch { res.status(500).json({ error: "Failed to update product addon" }); }
  });

  app.delete("/api/products/:productId/addons/:addonId", requireAdmin, async (req, res) => {
    try { res.status(204).end(); }
    catch { res.status(500).json({ error: "Failed to remove product addon" }); }
  });

  // Admin Reviews API
  app.get("/api/admin/reviews", requireAdmin, async (req, res) => {
    try {
      const allReviews = await storage.getAllReviews();
      res.json(allReviews);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/reviews/:id", requireAdmin, async (req, res) => {
    try {
      const { status } = req.body;
      if (!["approved", "rejected", "pending"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      const review = await storage.updateReviewStatus(req.params.id, status);
      res.json(review);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/reviews/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteReview(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Promotions API
  app.get("/api/admin/promotions", requireAdmin, async (_req, res) => {
    try {
      const rows = await db.select().from(schema.promotions).orderBy(desc(schema.promotions.createdAt));
      res.json(rows);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });
  app.post("/api/admin/promotions", requireAdmin, async (req, res) => {
    try {
      const d = req.body;
      const [promo] = await db.insert(schema.promotions).values({
        code: (d.code || "").toUpperCase().trim(), description: d.description || "",
        discountType: d.discountType || "percentage", discountValue: parseInt(d.discountValue) || 0,
        minPurchaseCents: Math.round((parseFloat(d.minPurchase || 0)) * 100),
        maxUses: parseInt(d.maxUses) || 0, validFrom: d.validFrom, validTo: d.validTo,
        applicableTo: d.applicableTo || "all", isActive: d.isActive !== false,
        createdBy: (req as any).user?.id,
      }).returning();
      res.json(promo);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });
  app.patch("/api/admin/promotions/:id", requireAdmin, async (req, res) => {
    try {
      const [p] = await db.update(schema.promotions).set(req.body).where(eq(schema.promotions.id, req.params.id)).returning();
      res.json(p || {});
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });
  app.delete("/api/admin/promotions/:id", requireAdmin, async (req, res) => {
    try {
      await db.delete(schema.promotions).where(eq(schema.promotions.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });
  app.post("/api/promotions/validate", async (req, res) => {
    try {
      const { code, subtotalCents } = req.body;
      if (!code) return res.json({ valid: false, message: "No code provided" });
      const [promo] = await db.select().from(schema.promotions).where(eq(schema.promotions.code, (code as string).toUpperCase().trim())).limit(1);
      if (!promo) return res.json({ valid: false, message: "Invalid promo code" });
      if (!promo.isActive) return res.json({ valid: false, message: "Promo code is inactive" });
      const today = new Date().toISOString().split("T")[0];
      if (today < promo.validFrom) return res.json({ valid: false, message: "Promo not yet valid" });
      if (today > promo.validTo) return res.json({ valid: false, message: "Promo has expired" });
      if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses) return res.json({ valid: false, message: "Usage limit reached" });
      if (promo.minPurchaseCents > 0 && (subtotalCents || 0) < promo.minPurchaseCents)
        return res.json({ valid: false, message: `Minimum purchase of ${Math.round(promo.minPurchaseCents / 100).toLocaleString()} VT required` });
      const discountCents = promo.discountType === "percentage" ? Math.round((subtotalCents || 0) * (promo.discountValue / 100)) : promo.discountValue;
      res.json({
        valid: true, promoId: promo.id, code: promo.code, description: promo.description,
        discountType: promo.discountType, discountValue: promo.discountValue, discountCents,
        message: (promo.discountType === "percentage" ? promo.discountValue + "% off" : Math.round(promo.discountValue / 100).toLocaleString() + " VT off") + " applied!"
      });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

}

import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import {
  insertBookingSchema,
  insertTourSchema,
  insertUserSchema,
  insertContentBlockSchema,
  insertSiteSettingSchema,
  insertPaymentGatewaySchema,
  insertPaymentSchema,
  insertWishlistItemSchema,
  insertNewsletterSubscriberSchema,
  insertCmsContentSchema,
  insertAvailabilityHoldSchema,
  insertTourInstanceSchema,
  insertReviewSchema,
  Booking,
  PaymentGateway,
} from "../shared/schema.js";
import bcrypt from "bcryptjs";
import { getStripePublishableKey } from "./stripeClient.js";
import { registerAuthRoutes } from "./application/auth.routes.js";
import { registerUserRoutes } from "./application/user.routes.js";
import { registerPaymentRoutes } from "./application/payment.routes.js";
import { AvailabilityApplicationService } from "./application/availability/availability.application-service.js";
import { registerRecoveryRoutes } from "./routes/recovery.js";
import { registerBookingEngineRoutes } from "./routes/booking-engine.js";
import { BackupIntegrityGuard } from "./infrastructure/recovery/integrity-guard.js";
import { ExpressSessionAdapter } from "./infrastructure/session.adapter.js";
import { AvailabilityDomainService } from "./domain/services/availability.domain-service.js";
import { BookingApplicationService } from "./application/booking.application-service.js";
import { PriceCartService } from "./application/pricing/PriceCartService.js";
import { cloudinaryService } from "./infrastructure/storage/cloudinary-service.js";
import { metricsService } from "./infrastructure/metrics/metrics.service.js";

import crypto from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";
import * as cloudinary from "cloudinary";
import {
  sendEmail,
  getBookingConfirmationTemplate,
  getAdminNewBookingTemplate,
  getPaymentConfirmationTemplate,
  getBookingStatusUpdateTemplate,
  getNewsletterConfirmationTemplate,
  getContactFormTemplate,
  getTestEmailTemplate
} from "./lib/mail.js";
import { ZodError, z } from "zod";

// Ensure uploads directory exists (legacy support if needed)
const uploadDir = path.join(process.cwd(), 'attached_assets', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const uploadMultiple = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 10 }
});

// Configure Cloudinary (Legacy style for direct usage in routes)
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadToCloudinaryLegacy = (fileBuffer: Buffer, filename: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.v2.uploader.upload_stream(
      {
        folder: 'ace-tours-uploads',
        public_id: `${Date.now()}_${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`,
        resource_type: 'image',
        transformation: [
          { width: 1200, height: 1200, crop: 'limit' },
          { quality: 'auto' }
        ]
      },
      (error: any, result: any) => {
        if (error) reject(error);
        else if (result) resolve(result.secure_url);
        else reject(new Error('Upload failed'));
      }
    );
    uploadStream.end(fileBuffer);
  });
};

// Auth middleware
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    if (req.path !== "/api/auth/me") {
      console.log(`[AUTH] 401 Unauthorized: ${req.method} ${req.path}`);
    }
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (req.session.userRole !== "admin") {
    console.log(`[ADMIN] 403 Forbidden: ${req.method} ${req.path}`);
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

export function requireStaff(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const userRole = req.session.userRole;
  if (userRole !== "admin" && userRole !== "field_service") {
    return res.status(403).json({ error: "Staff access required" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // 1. Enforce Integrity Guard
  app.use(BackupIntegrityGuard.enforceReadOnly);

  registerAuthRoutes(app);
  registerUserRoutes(app);

  const availabilityDomainService = new AvailabilityDomainService(storage);
  const bookingApplicationService = new BookingApplicationService(storage, availabilityDomainService);
  const availabilityAppService = new AvailabilityApplicationService(storage);

  // Availability API
  app.get("/api/availability", async (req, res) => {
    try {
      const tourId = req.query.tourId as string;
      const date = req.query.date as string;
      const slot = req.query.slot as string | undefined;
      const startTime = req.query.startTime as string | undefined;
      const endTime = req.query.endTime as string | undefined;
      if (!tourId || !date) return res.status(400).json({ error: "Missing tourId or date" });
      const result = await availabilityAppService.getAvailability(tourId, date, slot, startTime, endTime);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch availability" });
    }
  });

  app.get("/api/availability/range", async (req, res) => {
    try {
      const productId = req.query.productId as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const minGuests = req.query.minGuests ? parseInt(req.query.minGuests as string) : undefined;

      if (!productId || !startDate || !endDate) {
        return res.status(400).json({ error: "Missing required query parameters: productId, startDate, endDate" });
      }

      const results = await bookingApplicationService.getServiceAvailabilityRange(productId, startDate, endDate, minGuests);
      res.json(results);
    } catch (error) {
      console.error("[AVAILABILITY RANGE ERROR]", error);
      res.status(500).json({ error: "Failed to fetch availability range" });
    }
  });

  app.post("/api/availability/check", async (req, res) => {
    try {
      const { serviceId, date, adultPax, childPax, addonIds, startTime, endTime } = req.body;

      if (!serviceId || !date || adultPax === undefined || childPax === undefined) {
        return res.status(400).json({ error: "Missing required fields: serviceId, date, adultPax, childPax" });
      }

      const result = await bookingApplicationService.checkServiceAvailability(
        serviceId,
        date,
        {
          adultPax: parseInt(adultPax),
          childPax: parseInt(childPax),
          addonIds,
          startTime,
          endTime
        }
      );

      res.json(result);
    } catch (error: any) {
      console.error("[AVAILABILITY CHECK ERROR]", error);
      console.error("Stack:", error.stack);
      console.error("Payload:", req.body);
      res.status(500).json({ error: "Failed to check availability", details: error.message });
    }
  });

  app.get("/api/availability/slots", async (req, res) => {
    try {
      const { serviceId, date, guests } = req.query;

      if (!serviceId || !date || !guests) {
        return res.status(400).json({ error: "Missing required fields: serviceId, date, guests" });
      }

      const slots = await bookingApplicationService.getAvailableSlots(
        String(serviceId),
        String(date),
        parseInt(String(guests))
      );

      res.json(slots);
    } catch (error: any) {
      console.error("[AVAILABILITY SLOTS ERROR]", error);
      res.status(500).json({ error: "Failed to fetch slots", details: error.message });
    }
  });

  app.post("/api/holds", async (req, res) => {
    try {
      const { tourId, date, slot, quantity, startTime, endTime } = req.body;
      const sessionId = req.sessionID;
      if (!tourId || !date || !quantity) return res.status(400).json({ error: "Missing required fields" });
      const hold = await availabilityAppService.createHold({
        tourId,
        date,
        slot,
        quantity: parseInt(quantity),
        sessionId,
        startTime,
        endTime
      });
      res.status(201).json(hold);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Admin: Capacity Overview Dashboard
  app.get("/api/admin/capacity-overview", requireAdmin, async (req, res) => {
    try {
      const startDate = (req.query.start as string) || new Date().toISOString().split("T")[0];
      const endDate = (req.query.end as string) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const { CapacityOverviewService } = await import("./application/admin/capacity-overview.service.js");
      const service = new CapacityOverviewService(storage);
      const overview = await service.getCapacityOverview(startDate, endDate);

      res.json(overview);
    } catch (error) {
      console.error("[CAPACITY OVERVIEW ERROR]", error);
      res.status(500).json({ error: "Failed to fetch capacity overview" });
    }
  });

  // Admin: Blackout Dates CRUD
  app.get("/api/admin/blackouts/:productId", requireAdmin, async (req, res) => {
    try {
      const productId = req.params.productId;
      const dates = await storage.getBlackoutDates(productId);
      res.json(dates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch blackout dates" });
    }
  });

  app.post("/api/admin/blackouts", requireAdmin, async (req, res) => {
    try {
      const { productId, date, reason } = req.body;
      if (!productId || !date) return res.status(400).json({ error: "Missing productId or date" });
      const created = await storage.createBlackoutDate({ productId, date, reason, createdBy: req.session.userId });
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/admin/blackouts/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteBlackoutDate(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete blackout date" });
    }
  });

  // Admin: Pricing Versions CRUD
  app.get("/api/admin/pricing/:productId", requireAdmin, async (req, res) => {
    try {
      const productId = req.params.productId;
      const versions = await storage.getPricingVersions(productId);
      res.json(versions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pricing versions" });
    }
  });

  app.post("/api/admin/pricing", requireAdmin, async (req, res) => {
    try {
      const { productId, effectiveFrom, adultPriceCents, childPriceCents, ruleMetadata } = req.body;
      if (!productId || !effectiveFrom || adultPriceCents === undefined) return res.status(400).json({ error: "Missing required pricing fields" });
      const created = await storage.createPricingVersion({ productId, effectiveFrom, adultPriceCents, childPriceCents: childPriceCents || 0, ruleMetadata, createdBy: req.session.userId });
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Admin Metrics & Alerts
  app.get("/api/admin/metrics", requireAdmin, async (_req, res) => {
    try {
      const metrics = await metricsService.getMetrics();
      const alerts = await metricsService.getAlerts();
      res.json({ metrics, alerts });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch metrics" });
    }
  });

  app.get("/api/admin/capacity-summary", requireAdmin, async (req, res) => {
    try {
      const startDate = (req.query.start as string) || new Date().toISOString().split("T")[0];
      const endDate = (req.query.end as string) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const { CapacityOverviewService } = await import("./application/admin/capacity-overview.service.js");
      const service = new CapacityOverviewService(storage);
      const summary = await service.getCapacitySummary(startDate, endDate);

      res.json(summary);
    } catch (error) {
      console.error("[CAPACITY SUMMARY ERROR]", error);
      res.status(500).json({ error: "Failed to fetch capacity summary" });
    }
  });


  // Admin Capacity & Availability Management
  app.post("/api/admin/capacity/override", requireAdmin, async (req, res) => {
    try {
      const { instanceId, totalCapacity, blockedCount } = req.body;
      if (!instanceId) return res.status(400).json({ error: "Missing instanceId" });
      const result = await availabilityAppService.updateCapacity(instanceId, totalCapacity, blockedCount);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/admin/availability", requireAdmin, async (req, res) => {
    try {
      const result = await availabilityAppService.upsertInstance(req.body);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/admin/availability/:id", requireAdmin, async (req, res) => {
    try {
      await availabilityAppService.deleteInstance(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Cart Pricing API - Server-side price validation
  const priceCartService = new PriceCartService(storage);
  app.post("/api/cart/price", async (req, res) => {
    try {
      // Phase 2E: Feature flag controls which pricing system is used
      const { isFeatureEnabled } = await import('./feature-flags.js');
      const usePricingEngine = isFeatureEnabled('USE_PRICING_ENGINE' as any, (req as any).user?.id, req.sessionID);

      const { items } = req.body;
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Missing or invalid items array" });
      }

      const cartId = req.sessionID || 'anonymous';
      const parsedItems = items.map((item: any) => ({
        productId: String(item.productId || item.id),
        adultPax: parseInt(item.adultPax) || 0,
        childPax: parseInt(item.childPax) || 0,
        quantity: parseInt(item.quantity) || 1,
        addonIds: item.addonIds || []
      }));

      let snapshot;
      if (usePricingEngine) {
        // Phase 2E: Production - Use new PricingEngine (after Wave 1 validation)
        snapshot = await priceCartService.priceCart(cartId, parsedItems);
      } else {
        // Phase 2: Legacy pricing (fallback during deployment)
        // Using old system for backward compatibility
        snapshot = await priceCartService.priceCart(cartId, parsedItems);
        // Note: Both systems currently use PricingEngine internally
        // Old system available as fallback during Phase 2E waves
      }

      // Add metadata for monitoring
      res.json({
        ...snapshot,
        _metadata: {
          pricingSystem: usePricingEngine ? 'PricingEngine' : 'Legacy',
          rolloutPercentage: usePricingEngine ? '(enabled)' : '(disabled)',
        }
      });
    } catch (error: any) {
      console.error("Cart pricing error:", error);
      res.status(400).json({ error: error.message || "Failed to price cart" });
    }
  });

  // Image Upload API (Admin Only)
  app.post("/api/admin/upload", requireAdmin, upload.single("image"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No image file provided" });
      const folder = (req.query.folder as string) || "ace-tours";
      const imageUrl = await cloudinaryService.uploadImage(req.file.buffer, folder);
      res.json({ url: imageUrl });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to upload image" });
    }
  });

  // Tours API
  app.get("/api/tours", async (_req, res) => {
    try {
      const tours = await storage.getTours();
      res.json(tours);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tours" });
    }
  });

  app.get("/api/tours/:id", async (req, res) => {
    try {
      const tour = await storage.getTour(req.params.id);
      if (!tour) return res.status(404).json({ error: "Tour not found" });
      res.json(tour);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tour" });
    }
  });

  // Reviews
  app.get("/api/tours/:id/reviews", async (req, res) => {
    try {
      const reviews = await storage.getTourReviews(req.params.id);
      res.json(reviews);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
        res.status(500).json({ error: error.message });
      }
    }
  });

  app.post("/api/tours", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertTourSchema.parse(req.body);
      const tour = await storage.createTour(validatedData);
      res.status(201).json(tour);
    } catch (error) {
      res.status(400).json({ error: "Invalid tour data" });
    }
  });

  app.put("/api/tours/:id", requireAdmin, async (req, res) => {
    try {
      const tour = await storage.updateTour(req.params.id, req.body);
      res.json(tour);
    } catch (error) {
      res.status(400).json({ error: "Failed to update tour" });
    }
  });

  app.delete("/api/tours/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteTour(req.params.id);
      res.json({ message: "Tour deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete tour" });
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

  // Vehicles API
  app.get("/api/vehicles", async (_req, res) => {
    try {
      const allTours = await storage.getTours();
      res.json(allTours.filter(t => t.category === "vehicle"));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vehicles" });
    }
  });

  app.get("/api/vehicles/:id", async (req, res) => {
    try {
      const tour = await storage.getTour(req.params.id);
      if (!tour || tour.category !== "vehicle") return res.status(404).json({ error: "Vehicle not found" });
      res.json(tour);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vehicle" });
    }
  });

  // Bookings API
  app.get("/api/bookings", requireAdmin, async (_req, res) => {
    try {
      const bookings = await storage.getBookings();
      res.json(bookings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bookings" });
    }
  });

  app.get("/api/bookings/export", requireAdmin, async (_req, res) => {
    try {
      const bookings = await storage.getBookings();
      const escapeCSV = (value: any): string => {
        const str = String(value ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };
      const csvHeader = "ID,Customer,Tour,Date,Amount,Status,Guests\n";
      const csvRows = bookings.map((b: Booking) =>
        [b.id, b.customerName, b.tourName, b.date, b.amount, b.status, b.guests].map(escapeCSV).join(',')
      ).join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=bookings.csv");
      res.send(csvHeader + csvRows);
    } catch (error) {
      res.status(500).json({ error: "Failed to export bookings" });
    }
  });

  // Advanced Analytics (Admin only)
  app.get("/api/analytics/revenue/daily", requireAdmin, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const data = await storage.getRevenueDaily(days);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/analytics/top-tours", requireAdmin, async (_req, res) => {
    try {
      const data = await storage.getTopPerformingTours(5);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bookings/user/:userId", requireAuth, async (req, res) => {
    try {
      if (req.session.userRole !== 'admin' && req.session.userId !== req.params.userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const bookings = await storage.getUserBookings(req.params.userId);
      res.json(bookings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user bookings" });
    }
  });

  app.get("/api/bookings/:id", async (req, res) => {
    try {
      const booking = await storage.getBooking(req.params.id);
      if (!booking) return res.status(404).json({ error: "Booking not found" });
      res.json(booking);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch booking" });
    }
  });

  app.get("/api/bookings/:id/items", async (req, res) => {
    try {
      const items = await storage.getBookingItems(req.params.id);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch booking items" });
    }
  });

  app.post("/api/bookings", async (req, res) => {
    try {
      const { CreateBookingFromCartService } = await import("./application/booking/CreateBookingFromCartService.js");
      const bookingService = new CreateBookingFromCartService(storage);
      const { items, customerName, customerEmail } = req.body;
      const idempotencyKey = (req.headers['idempotency-key'] || req.body.idempotencyKey) as string | undefined;
      if (!items || !items.length) return res.status(400).json({ error: "Cart is empty" });
      const booking = await bookingService.execute({
        customerName,
        customerEmail,
        items,
        sessionId: req.sessionID,
        idempotencyKey
      });
      res.status(201).json(booking);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/bookings/:id", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getBooking(req.params.id);
      if (!existing) return res.status(404).json({ error: "Booking not found" });
      if (req.session.userRole !== 'admin' && existing.userId !== req.session.userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      // If cancelling, release holds associated with this booking
      const updates = { ...req.body } as any;
      if (updates.status === 'cancelled' && existing) {
        try {
          // Release primary hold if exists
          if (existing.holdId) {
            const { AvailabilityApplicationService } = await import("./application/availability/availability.application-service.js");
            const svc = new AvailabilityApplicationService(storage);
            await svc.releaseHold(existing.holdId).catch(console.error);
          }

          // Release session holds
          if (existing.bookingSessionId) {
            const holds = await storage.getHoldsBySession(existing.bookingSessionId);
            const { AvailabilityApplicationService } = await import("./application/availability/availability.application-service.js");
            const svc = new AvailabilityApplicationService(storage);
            for (const h of holds) {
              await svc.releaseHold(h.id).catch(console.error);
            }
          }
        } catch (err) {
          console.error('[BOOKING][CANCEL] Error releasing holds for booking', existing.id, err);
        }
      }

      const booking = await storage.updateBooking(req.params.id, updates);
      res.json(booking);
    } catch (error) {
      res.status(400).json({ error: "Failed to update booking" });
    }
  });

  app.delete("/api/bookings/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteBooking(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete booking" });
    }
  });

  // Settings API
  app.get("/api/settings", async (_req, res) => {
    try {
      const settings = await storage.getSiteSettings();
      res.json(settings);
    } catch (error: any) {
      console.error("[SETTINGS ERROR]", error);
      res.status(500).json({ error: "Failed to fetch settings", details: error.message });
    }
  });

  app.get("/api/settings/:key", async (req, res) => {
    try {
      const setting = await storage.getSiteSetting(req.params.key);
      if (!setting) return res.status(404).json({ error: "Setting not found" });
      res.json(setting);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch setting" });
    }
  });

  app.put("/api/admin/settings/:key", requireAdmin, async (req, res) => {
    try {
      const setting = await storage.upsertSiteSetting({
        key: req.params.key,
        value: req.body.value,
      });
      res.json(setting);
    } catch (error) {
      res.status(400).json({ error: "Failed to update setting" });
    }
  });

  // Wishlist API
  app.get("/api/wishlist", requireAuth, async (req, res) => {
    try {
      const items = await storage.getWishlistItems(req.session.userId!);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch wishlist" });
    }
  });

  app.post("/api/wishlist", requireAuth, async (req, res) => {
    try {
      const validatedData = insertWishlistItemSchema.parse({ ...req.body, userId: req.session.userId });
      const item = await storage.addToWishlist(validatedData);
      res.status(201).json(item);
    } catch (error) {
      res.status(400).json({ error: "Failed to add to wishlist" });
    }
  });

  app.delete("/api/wishlist/:tourId", requireAuth, async (req, res) => {
    try {
      await storage.removeFromWishlist(req.session.userId!, req.params.tourId);
      res.json({ message: "Removed from wishlist" });
    } catch (error) {
      res.status(400).json({ error: "Failed to remove from wishlist" });
    }
  });

  // Newsletter API
  app.get("/api/newsletter/subscribers", requireAdmin, async (_req, res) => {
    try {
      const subs = await storage.getNewsletterSubscribers();
      res.json(subs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch subscribers" });
    }
  });

  app.post("/api/newsletter/subscribe", async (req, res) => {
    try {
      const { email, name, locale, source } = req.body;
      if (!email) return res.status(400).json({ error: "Email is required" });
      const subscriber = await storage.subscribeNewsletter({ email, name: name || null, locale: locale || 'en', source: source || 'website' });
      res.status(201).json({ message: "Subscribed!", subscriber });
    } catch (error) {
      res.status(400).json({ error: "Failed to subscribe" });
    }
  });

  // CMS/Content Blocks API
  app.get("/api/content-blocks", async (_req, res) => {
    try {
      const blocks = await storage.getContentBlocks();
      res.json(blocks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch content blocks" });
    }
  });

  app.get("/api/cms-content/:blockSlug", async (req, res) => {
    try {
      const content = await storage.getCmsContent(req.params.blockSlug, req.query.locale as string);
      res.json(content);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch content" });
    }
  });

  app.post("/api/admin/cms-content", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertCmsContentSchema.parse(req.body);
      const content = await storage.createCmsContent(validatedData);
      res.status(201).json(content);
    } catch (error) {
      res.status(400).json({ error: "Failed to create content" });
    }
  });

  // Feature Flags
  app.get("/api/feature-flags", async (_req, res) => {
    try {
      const flags = await storage.getFeatureFlags();
      res.json(flags);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch feature flags" });
    }
  });

  app.patch("/api/admin/feature-flags/:slug", requireAdmin, async (req, res) => {
    try {
      const { slug } = req.params;
      const { enabled } = req.body;

      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: "Enabled state must be a boolean" });
      }

      const flag = await storage.getFeatureFlag(slug);
      if (!flag) {
        return res.status(404).json({ error: "Feature flag not found" });
      }

      const updated = await storage.upsertFeatureFlag({
        ...flag,
        enabled
      });

      console.log(`[FEATURE-FLAG] ${updated.slug} toggled to ${updated.enabled ? 'ON' : 'OFF'} by admin`);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update feature flag" });
    }
  });

  // Notifications
  app.get("/api/notifications", requireAuth, async (req, res) => {
    const notifications = await storage.getUnreadNotifications(req.session.userRole === 'admin' ? undefined : req.session.userId);
    res.json(notifications);
  });

  app.patch("/api/notifications/:id/read", requireAuth, async (req, res) => {
    await storage.markNotificationAsRead(req.params.id);
    res.json({ success: true });
  });

  // Stripe & Payments
  app.get("/api/stripe/config", (_req, res) => {
    res.json({ publishableKey: getStripePublishableKey() });
  });

  registerPaymentRoutes(app, storage);
  await registerRecoveryRoutes(app, storage);
  registerBookingEngineRoutes(app, storage, requireAdmin);

  return httpServer;
}
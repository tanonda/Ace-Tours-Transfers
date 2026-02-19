import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { config } from "./config.js";
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
// LOW-4: stripeClient import removed — Stripe route deprecated
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
  sendAdminEmail,
  getBookingConfirmationTemplate,
  getAdminNewBookingTemplate,
  getPaymentConfirmationTemplate,
  getBookingStatusUpdateTemplate,
  getNewsletterConfirmationTemplate,
  getContactFormTemplate,
  getTestEmailTemplate
} from "./lib/mail.js";
import { ZodError, z } from "zod";
import { rateLimit as customRateLimit } from "./lib/rate-limiter.js";
import { rateLimit } from "express-rate-limit";

// Rate limiter for availability check
const availabilityLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // limit each IP to 60 requests per windowMs
  message: { error: "Too many availability checks, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const bookingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many booking attempts, please try again later." },
});

const verifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many verification attempts, please try again later." },
});

// C6 Fix: Zod schema for booking creation
const createBookingItemSchema = z.object({
  productId: z.string(),
  adultPax: z.number().int().min(0),
  childPax: z.number().int().min(0),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  addonIds: z.array(z.string()).optional(),
  slot: z.string().optional(),
  quantity: z.number().int().min(1).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});

const createBookingBodySchema = z.object({
  customerName: z.string().min(1, "Name is required").max(100),
  customerEmail: z.string().email("Invalid email address"),
  items: z.array(createBookingItemSchema).min(1, "At least one item is required"),
  pickupLocation: z.string().max(500).nullable().optional(),
  idempotencyKey: z.string().optional(),
}).refine(data => {
  const totalPax = data.items.reduce((sum, item) => sum + (item.adultPax || 0) + (item.childPax || 0), 0);
  return totalPax >= 1;
}, {
  message: "At least one guest (adult or child) is required across all items",
  path: ["items"],
});


// Ensure uploads directory exists (legacy support if needed)
const uploadDir = path.join(process.cwd(), 'attached_assets', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer configuration
// MED-4 FIX: Restrict uploads to image MIME types only
const imageFileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Only images (JPEG, PNG, GIF, WebP, SVG) are allowed.`));
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: imageFileFilter,
});

const uploadMultiple = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: imageFileFilter,
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

/**
 * Middleware: requires a valid, non-expired booking session.
 * Guests create a booking session via POST /api/bookings/session.
 */
export function requireBookingSession(req: Request, res: Response, next: NextFunction) {
  const { bookingSessionId, bookingSessionExpiresAt } = req.session;
  if (!bookingSessionId) {
    return res.status(401).json({ error: "No booking session. Please verify your booking first." });
  }
  if (bookingSessionExpiresAt && Date.now() > bookingSessionExpiresAt) {
    // Clear expired session fields
    delete req.session.bookingSessionId;
    delete req.session.bookingSessionExpiresAt;
    return res.status(401).json({ error: "Booking session expired. Please verify again." });
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
      console.error("[AVAILABILITY ERROR]", error); // H3 Fix
      res.status(500).json({ error: "Internal error", ref: Date.now().toString() });
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

  app.post("/api/availability/check", availabilityLimiter, async (req, res) => {
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

      // MED-7 FIX: Mark availability as advisory so API consumers know this is
      // a point-in-time snapshot, NOT a guaranteed reservation. A hold must be
      // created to actually reserve seats.
      res.json({ ...result, advisory: true });
    } catch (error: any) {
      const correlationId = Date.now().toString();
      console.error(`[AVAILABILITY CHECK ERROR][${correlationId}]`, error); // H3 Fix
      res.status(500).json({ error: "Internal error", ref: correlationId });
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
      const correlationId = Date.now().toString();
      console.error(`[AVAILABILITY SLOTS ERROR][${correlationId}]`, error);
      res.status(500).json({ error: "Internal error", ref: correlationId });
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
      // Ensure specific fields are included for the admin dashboard
      const enrichedBookings = bookings.map(b => ({
        ...b,
        totalAmountCents: b.totalAmountCents || 0,
        currency: b.currency || "VUV",
        customerEmail: b.customerEmail || "",
        customerPhone: b.customerPhone || "",
        tourName: b.tourName || "",
        pickupLocation: b.pickupLocation || "",
        confirmedAt: b.confirmedAt ? b.confirmedAt.toISOString() : null,
      }));
      res.json(enrichedBookings);
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

  // ─────────────────────────────────────────────────────────────────────────
  // GUEST RESERVATION PORTAL: verify and self-service cancel
  // These routes power the public-facing "Find my booking" lookup form.
  // They are deliberately guest-accessible (no requireAuth) but rate-limited
  // and require ownership proof (booking ref + email / last name).
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * POST /api/bookings/verify
   * Look up a booking by its confirmation number + one verification factor.
   * Returns a sanitised booking view (internal IDs stripped).
   */
  app.post("/api/bookings/verify", verifyLimiter, async (req, res) => {
    try {
      const { bookingId, type, value } = req.body as {
        bookingId?: string;
        type?: string;
        value?: string;
      };

      if (!bookingId || !type || !value) {
        return res.status(400).json({ error: "bookingId, type and value are all required." });
      }

      if (!["email", "phone", "lastname"].includes(type)) {
        return res.status(400).json({ error: "type must be 'email', 'phone', or 'lastname'." });
      }

      const booking = await storage.getBooking(bookingId);

      // Use the same response for not-found and failed-verification to prevent
      // confirmation-number enumeration.
      const VERIFY_FAIL = { error: "Booking not found or verification failed." };

      if (!booking) return res.status(404).json(VERIFY_FAIL);

      let verified = false;
      const normalise = (s?: string | null) => (s ?? "").trim().toLowerCase();

      if (type === "email") {
        verified = normalise(booking.customerEmail) === normalise(value);
      } else if (type === "lastname") {
        const lastName = (booking.customerName ?? "").trim().split(/\s+/).pop() ?? "";
        verified = normalise(lastName) === normalise(value);
      } else if (type === "phone") {
        const storedPhone = (booking as any).customerPhone ?? "";
        verified = normalise(storedPhone) === normalise(value);
      }

      if (!verified) return res.status(403).json(VERIFY_FAIL);

      // Return a public view — strip all internal tracking fields
      const {
        holdId: _holdId,
        bookingSessionId: _sessionId,
        userId: _userId,
        idempotencyKey: _iKey,
        ...publicBooking
      } = booking as any;

      // Mask the email so we don't echo it back in full
      const maskedEmail = (() => {
        const em = booking.customerEmail ?? "";
        const [local, domain] = em.split("@");
        if (!domain || local.length < 2) return em;
        return `${local[0]}${"*".repeat(Math.max(1, local.length - 1))}@${domain}`;
      })();

      return res.json({ ...publicBooking, customerEmail: maskedEmail });
    } catch (error) {
      const ref = Date.now().toString();
      console.error(`[BOOKING VERIFY ERROR][${ref}]`, error);
      res.status(500).json({ error: "Internal error", ref });
    }
  });

  /**
   * POST /api/bookings/:id/cancel
   * Guest self-service cancel. Requires the same ownership proof as /verify.
   * Only pending bookings may be self-cancelled; confirmed/completed bookings
   * must be handled by staff.
   */
  app.post("/api/bookings/:id/cancel", verifyLimiter, async (req, res) => {
    try {
      const { type, value } = req.body as { type?: string; value?: string };
      const booking = await storage.getBooking(req.params.id);

      const VERIFY_FAIL = { error: "Booking not found or verification failed." };
      if (!booking) return res.status(404).json(VERIFY_FAIL);

      // Re-verify ownership (same logic as /verify)
      let verified = false;
      const normalise = (s?: string | null) => (s ?? "").trim().toLowerCase();

      if (type === "email") {
        verified = normalise(booking.customerEmail) === normalise(value);
      } else if (type === "lastname") {
        const lastName = (booking.customerName ?? "").trim().split(/\s+/).pop() ?? "";
        verified = normalise(lastName) === normalise(value);
      } else if (type === "phone") {
        verified = normalise((booking as any).customerPhone) === normalise(value);
      }

      if (!verified) return res.status(403).json(VERIFY_FAIL);

      // Only allow self-cancel of pending bookings
      if (booking.status !== "pending") {
        return res.status(400).json({
          error: `This booking is '${booking.status}' and cannot be self-cancelled. Please contact us directly.`,
        });
      }

      const { AtomicBookingConfirmationService } = await import("./application/booking/AtomicBookingConfirmationService.js");
      const svc = new AtomicBookingConfirmationService(storage);
      const result = await svc.cancelBookingAtomically(booking.id, "guest_self_cancel");

      if (!result.success) {
        return res.status(500).json({ error: result.message });
      }

      // Notify the customer their cancellation was received
      try {
        await sendEmail({
          to: booking.customerEmail!,
          subject: `Booking Cancelled — Ref #${booking.id.slice(0, 8).toUpperCase()}`,
          html: `<p>Hi ${booking.customerName},</p>
                 <p>Your booking (Ref #${booking.id.slice(0, 8).toUpperCase()}) has been cancelled as requested.</p>
                 <p>If you did not request this cancellation please contact us immediately.</p>
                 <p>Thank you,<br/>Ace Tours & Transfers</p>`,
        });
      } catch (emailErr) {
        console.error("[BOOKING CANCEL] Cancellation email failed (non-fatal):", emailErr);
      }

      return res.json({ success: true, message: "Booking cancelled successfully." });
    } catch (error) {
      const ref = Date.now().toString();
      console.error(`[BOOKING CANCEL ERROR][${ref}]`, error);
      res.status(500).json({ error: "Internal error", ref });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // BOOKING SESSION MANAGEMENT: scoped, short-lived guest access
  // These routes let guests manage a single booking without an account.
  // A session is created via POST /api/bookings/session after email verification.
  // ─────────────────────────────────────────────────────────────────────────

  const BOOKING_SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

  /**
   * POST /api/bookings/session
   * Verify booking ownership (bookingId + email) and create a scoped session.
   * Returns sanitised booking data on success.
   */
  app.post("/api/bookings/session", verifyLimiter, async (req, res) => {
    try {
      const { bookingId, email } = req.body as { bookingId?: string; email?: string };

      if (!bookingId || !email) {
        return res.status(400).json({ error: "bookingId and email are required." });
      }

      const booking = await storage.getBooking(bookingId);
      const VERIFY_FAIL = { error: "Booking not found or verification failed." };

      if (!booking) return res.status(404).json(VERIFY_FAIL);

      const normalise = (s?: string | null) => (s ?? "").trim().toLowerCase();
      if (normalise(booking.customerEmail) !== normalise(email)) {
        return res.status(403).json(VERIFY_FAIL);
      }

      // Create scoped session
      req.session.bookingSessionId = booking.id;
      req.session.bookingSessionExpiresAt = Date.now() + BOOKING_SESSION_TTL_MS;

      // Return sanitised booking
      const items = await storage.getBookingItems(booking.id);
      const payments = await storage.getPaymentsByBooking(booking.id);
      const {
        holdId: _h, bookingSessionId: _bs, userId: _u, idempotencyKey: _ik,
        ...publicBooking
      } = booking as any;

      const maskedEmail = (() => {
        const em = booking.customerEmail ?? "";
        const [local, domain] = em.split("@");
        if (!domain || local.length < 2) return em;
        return `${local[0]}${"*".repeat(Math.max(1, local.length - 1))}@${domain}`;
      })();

      return res.json({
        booking: { ...publicBooking, customerEmail: maskedEmail },
        items,
        payments: payments.map(p => ({
          id: p.id, status: p.status, amount: p.amount, currency: p.currency, createdAt: p.createdAt,
        })),
        sessionExpiresAt: req.session.bookingSessionExpiresAt,
      });
    } catch (error) {
      const ref = Date.now().toString();
      console.error(`[BOOKING SESSION ERROR][${ref}]`, error);
      res.status(500).json({ error: "Internal error", ref });
    }
  });

  /**
   * GET /api/bookings/session/current
   * Fetch the current booking associated with an active booking session.
   */
  app.get("/api/bookings/session/current", requireBookingSession, async (req, res) => {
    try {
      const booking = await storage.getBooking(req.session.bookingSessionId!);
      if (!booking) return res.status(404).json({ error: "Booking no longer exists." });

      const items = await storage.getBookingItems(booking.id);
      const paymentRecords = await storage.getPaymentsByBooking(booking.id);

      const {
        holdId: _h, bookingSessionId: _bs, userId: _u, idempotencyKey: _ik,
        ...publicBooking
      } = booking as any;

      const maskedEmail = (() => {
        const em = booking.customerEmail ?? "";
        const [local, domain] = em.split("@");
        if (!domain || local.length < 2) return em;
        return `${local[0]}${"*".repeat(Math.max(1, local.length - 1))}@${domain}`;
      })();

      return res.json({
        booking: { ...publicBooking, customerEmail: maskedEmail },
        items,
        payments: paymentRecords.map(p => ({
          id: p.id, status: p.status, amount: p.amount, currency: p.currency, createdAt: p.createdAt,
        })),
        sessionExpiresAt: req.session.bookingSessionExpiresAt,
      });
    } catch (error) {
      const ref = Date.now().toString();
      console.error(`[BOOKING SESSION CURRENT ERROR][${ref}]`, error);
      res.status(500).json({ error: "Internal error", ref });
    }
  });

  /**
   * PATCH /api/bookings/session/update
   * Safe updates: pickup location, notes, phone. No price or availability impact.
   */
  app.patch("/api/bookings/session/update", requireBookingSession, async (req, res) => {
    try {
      const bookingId = req.session.bookingSessionId!;
      const booking = await storage.getBooking(bookingId);
      if (!booking) return res.status(404).json({ error: "Booking not found." });

      // Only allow safe fields
      const { pickupLocation, notes, customerPhone } = req.body as {
        pickupLocation?: string;
        notes?: string;
        customerPhone?: string;
      };

      const updateData: Record<string, any> = {};
      if (pickupLocation !== undefined) updateData.pickupLocation = pickupLocation;
      if (notes !== undefined) updateData.notes = notes;
      if (customerPhone !== undefined) updateData.customerPhone = customerPhone;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "No valid fields to update." });
      }

      updateData.updatedAt = new Date();
      const updated = await storage.updateBooking(bookingId, updateData);

      return res.json({ success: true, booking: updated });
    } catch (error) {
      const ref = Date.now().toString();
      console.error(`[BOOKING SESSION UPDATE ERROR][${ref}]`, error);
      res.status(500).json({ error: "Internal error", ref });
    }
  });

  /**
   * POST /api/bookings/session/modify
   * Inventory-impacting modifications: date or pax changes.
   * Re-checks availability, calculates price diff, creates additional payment if needed.
   */
  app.post("/api/bookings/session/modify", requireBookingSession, async (req, res) => {
    try {
      const bookingId = req.session.bookingSessionId!;
      const booking = await storage.getBooking(bookingId);
      if (!booking) return res.status(404).json({ error: "Booking not found." });

      if (booking.status !== "pending" && booking.status !== "confirmed") {
        return res.status(400).json({ error: `Cannot modify a booking with status '${booking.status}'.` });
      }

      const { date, adultPax, childPax } = req.body as {
        date?: string;
        adultPax?: number;
        childPax?: number;
      };

      const newDate = date || booking.date;
      const newAdultPax = adultPax ?? booking.adultPaxTotal;
      const newChildPax = childPax ?? booking.childPaxTotal;

      // Check if anything actually changed
      if (newDate === booking.date && newAdultPax === booking.adultPaxTotal && newChildPax === booking.childPaxTotal) {
        return res.json({ changed: false, message: "No changes detected." });
      }

      // Check availability for the new parameters
      const availResult = await bookingApplicationService.checkServiceAvailability(
        booking.tourId,
        newDate,
        { adultPax: newAdultPax, childPax: newChildPax }
      );

      if (!availResult.isAvailable) {
        return res.status(400).json({
          error: "Requested changes are not available.",
          availabilityMessage: availResult.message,
        });
      }

      // Calculate new total from the availability result pricing
      const newTotalCents = (availResult as any).totalPriceCents ||
        ((availResult as any).adultPrice * newAdultPax + (availResult as any).childPrice * newChildPax) ||
        booking.totalAmountCents; // fallback if pricing not returned

      const priceDifference = newTotalCents - booking.totalAmountCents;

      // Build audit trail in notes
      const auditEntry = `[${new Date().toISOString()}] Modification: date ${booking.date}->${newDate}, pax ${booking.adultPaxTotal}A+${booking.childPaxTotal}C->${newAdultPax}A+${newChildPax}C, price ${booking.totalAmountCents}->${newTotalCents}`;
      const updatedNotes = booking.notes ? `${booking.notes}\n${auditEntry}` : auditEntry;

      // Update the booking
      const updateData: Record<string, any> = {
        date: newDate,
        adultPaxTotal: newAdultPax,
        childPaxTotal: newChildPax,
        guests: newAdultPax + newChildPax,
        totalAmountCents: newTotalCents,
        amount: String(newTotalCents),
        notes: updatedNotes,
        updatedAt: new Date(),
      };

      let additionalPayment = null;

      if (priceDifference > 0) {
        // Price increase — create additional payment record
        try {
          // Find the manual gateway for additional payment
          const manualGateway = await storage.getPaymentGatewayBySlug('manual');
          if (manualGateway) {
            additionalPayment = await storage.createPayment({
              bookingId: booking.id,
              gatewayId: manualGateway.id,
              amount: priceDifference,
              currency: booking.currency || "VUV",
              status: "pending",
              metadata: {
                type: "modification_supplement",
                originalAmountCents: booking.totalAmountCents,
                newAmountCents: newTotalCents,
                modifiedAt: new Date().toISOString(),
              },
            });
          }
        } catch (payErr) {
          console.error("[BOOKING MODIFY] Failed to create additional payment (non-fatal):", payErr);
        }
      }

      await storage.updateBooking(bookingId, updateData);

      return res.json({
        changed: true,
        priceDifference,
        requiresAdditionalPayment: priceDifference > 0,
        creditPending: priceDifference < 0,
        additionalAmountCents: priceDifference > 0 ? priceDifference : 0,
        additionalPaymentId: additionalPayment?.id || null,
        newTotalCents,
        message: priceDifference > 0
          ? `Modification requires additional payment of ${priceDifference} ${booking.currency || "VUV"}.`
          : priceDifference < 0
            ? `Price decreased by ${Math.abs(priceDifference)} ${booking.currency || "VUV"}. Credit is pending admin review.`
            : "Booking updated successfully.",
      });
    } catch (error) {
      const ref = Date.now().toString();
      console.error(`[BOOKING SESSION MODIFY ERROR][${ref}]`, error);
      res.status(500).json({ error: "Internal error", ref });
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

      // C3 Fix: Require authentication or email verification for guest access
      const isAdmin = req.session.userRole === 'admin';
      const isOwner = booking.userId === req.session.userId || booking.bookingSessionId === req.sessionID;

      if (!isAdmin && !isOwner) {
        return res.status(401).json({ error: "Unauthorized access to booking details" });
      }

      res.json(booking);
    } catch (error) {
      const correlationId = Date.now().toString();
      console.error(`[BOOKING LOOKUP ERROR][${correlationId}]`, error);
      res.status(500).json({ error: "Internal error", ref: correlationId });
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

  app.post("/api/bookings", bookingLimiter, async (req, res) => {
    try {
      // C6 Fix: Validate input body
      const validatedBody = createBookingBodySchema.parse(req.body);
      const { items, customerName, customerEmail, pickupLocation, idempotencyKey } = validatedBody;

      // M1 Fix: Past-date validation
      const today = new Date().toISOString().split('T')[0];
      for (const item of items) {
        if (item.date < today) {
          return res.status(400).json({ error: `Cannot book for a past date: ${item.date}` });
        }
      }

      const { CreateBookingFromCartService } = await import("./application/booking/CreateBookingFromCartService.js");
      const bookingService = new CreateBookingFromCartService(storage);

      const booking = await bookingService.execute({
        customerName,
        customerEmail,
        items,
        sessionId: req.sessionID,
        idempotencyKey,
        pickupLocation
      });

      // ✅ Send booking notification emails
      try {
        const bookingItems = await storage.getBookingItems(booking.id);
        const firstItem = bookingItems[0];
        const tourData = firstItem ? await storage.getTour(firstItem.productId) : null;
        const tourInfo = tourData || { title: 'Tour/Transfer Booking', category: 'tour' };

        const emailBooking = {
          ...booking,
          date: booking.date || new Date().toISOString().split('T')[0],
          guests: `${firstItem?.adultPax || 1} Adult(s)${firstItem?.childPax ? ', ' + firstItem.childPax + ' Child(ren)' : ''}`,
          amount: `VT ${(booking.totalAmountCents || 0).toLocaleString()}`,
        };

        // Send customer notification
        if (booking.customerEmail) {
          await sendEmail({
            to: booking.customerEmail,
            subject: `Booking Request Received — Ref #${booking.id.slice(0, 8).toUpperCase()}`,
            html: getBookingConfirmationTemplate(emailBooking, tourInfo),
          });
        }

        // Send admin notification
        await sendAdminEmail(
          `🔔 New Booking: ${booking.customerName} — ${tourInfo.title}`,
          getAdminNewBookingTemplate(emailBooking, tourInfo)
        );
      } catch (emailError) {
        console.error('[BOOKING] Email notification failed (non-fatal):', emailError);
      }

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

      const updates = { ...req.body } as any;

      // FIX (HIGH-8 / audit report section 3.3): Enforce an immutable-field whitelist.
      // Financial and identity fields must never be overwritten via this route.
      const IMMUTABLE_FIELDS = [
        'totalAmountCents', 'amount', 'tourId', 'customerEmail',
        'idempotencyKey', 'holdId', 'bookingSessionId', 'id', 'createdAt',
      ];
      for (const field of IMMUTABLE_FIELDS) {
        if (updates[field] !== undefined) {
          return res.status(400).json({ error: `Field '${field}' cannot be modified.` });
        }
      }

      // FIX: Enforce booking status state machine.
      // Only admin users are allowed to drive status transitions.
      const ALLOWED_TRANSITIONS: Record<string, string[]> = {
        'pending': ['confirmed', 'cancelled'],
        'confirmed': ['completed', 'cancelled'],
        'completed': [],
        'cancelled': [],
        'price_mismatch': ['confirmed', 'cancelled'],  // admin manual resolution
        'inventory_conflict': ['cancelled'],             // admin manual resolution
      };

      if (updates.status && updates.status !== existing.status) {
        const allowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
        if (!allowed.includes(updates.status)) {
          return res.status(400).json({
            error: `Invalid status transition: '${existing.status}' → '${updates.status}'. Allowed: [${allowed.join(', ') || 'none'}]`,
          });
        }
      }

      // If cancelling, release holds associated with this booking
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

      // ✅ Send email when status changes
      if (updates.status && updates.status !== existing.status && booking.customerEmail) {
        try {
          const bookingItems = await storage.getBookingItems(booking.id);
          const firstItem = bookingItems[0];
          const tourData = firstItem ? await storage.getTour(firstItem.productId) : null;
          const tourInfo = tourData || { title: 'Tour/Transfer Booking' };

          const emailBooking = {
            ...booking,
            date: booking.date || new Date().toISOString().split('T')[0],
            guests: `${firstItem?.adultPax || 1} Adult(s)${firstItem?.childPax ? ', ' + firstItem.childPax + ' Child(ren)' : ''}`,
            amount: `VT ${(booking.totalAmountCents || 0).toLocaleString()}`,
          };

          await sendEmail({
            to: booking.customerEmail,
            subject: `Booking Update: ${updates.status.toUpperCase()} — Ref #${booking.id.slice(0, 8).toUpperCase()}`,
            html: getBookingStatusUpdateTemplate(emailBooking, updates.status, tourInfo),
          });
        } catch (emailErr) {
          console.error('[BOOKING][STATUS] Email failed (non-fatal):', emailErr);
        }
      }

      res.json(booking);
    } catch (error) {
      res.status(400).json({ error: "Failed to update booking" });
    }
  });

  app.delete("/api/bookings/:id", requireAdmin, async (req, res) => {
    try {
      // HIGH-8 FIX: Verify existence before delete to prevent silent double-delete
      const booking = await storage.getBooking(req.params.id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      await storage.deleteBooking(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete booking" });
    }
  });

  // Site Configuration API
  app.get("/api/config", (_req, res) => {
    res.json({
      ddd: config.ddd,
      payments: {
        enabled: config.payments.enabled,
        manual: config.payments.manual,
      },
      killSwitches: config.killSwitches
    });
  });

  // Settings API
  app.get("/api/settings", async (_req, res) => {
    try {
      const settings = await storage.getSiteSettings();
      res.json(settings);
    } catch (error) {
      const ref = Date.now().toString();
      console.error(`[SETTINGS ERROR][${ref}]`, error);
      res.status(500).json({ error: "Internal error", ref });
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

  app.get("/api/wishlist/check/:tourId", requireAuth, async (req, res) => {
    try {
      const inWishlist = await storage.isInWishlist(req.session.userId!, req.params.tourId);
      res.json({ inWishlist });
    } catch (error) {
      res.status(500).json({ error: "Failed to check wishlist" });
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

  // Analytics API
  app.get("/api/analytics/stats", requireAdmin, async (_req, res) => {
    try {
      const stats = await storage.getBookingStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get("/api/analytics/revenue/daily", requireAdmin, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const revenue = await storage.getRevenueDaily(days);
      res.json(revenue);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch revenue data" });
    }
  });

  // LOW-4: Stripe routes removed — not available to Vanuatu merchants.

  registerPaymentRoutes(app, storage);
  await registerRecoveryRoutes(app, storage);
  registerBookingEngineRoutes(app, storage, requireAdmin);

  // Safety 404 for /api routes to prevent hitting Vite middleware
  app.all("/api/*any", (req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
  });

  return httpServer;
}
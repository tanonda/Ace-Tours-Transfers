import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { config } from "./config.js";
import { db } from "./db.js";
import { sql, eq, desc } from "drizzle-orm";
import * as schema from "../shared/schema.js";
import {
  insertBookingSchema,
  insertProductSchema,
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
  insertArticleSchema,
  newsletterSubscribers,
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
import { PaymentReconciliationService } from "./application/payment-reconciliation.service.js";
import { PriceCartService } from "./application/pricing/PriceCartService.js";
import { cloudinaryService } from "./infrastructure/storage/cloudinary-service.js";
import { metricsService } from "./infrastructure/metrics/metrics.service.js";
import { withProductTranslations, autoTranslateProduct, getProductTranslations, upsertProductTranslation } from "./lib/product-translation.service.js";
import { slugify, uniqueSlug } from "./lib/slugify.js";
import { sanitizeServerHtml } from "./lib/sanitize-server.js";

import crypto from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";
import * as cloudinary from "cloudinary";
import {
  sendEmail,
  sendAdminEmail,
  getBookingRequestTemplate,
  getAdminNewBookingTemplate,
  getPaymentConfirmationTemplate,
  getBookingStatusUpdateTemplate,
  getNewsletterConfirmationTemplate,
  getContactFormTemplate,
  getTestEmailTemplate,
  shortBookingRef
} from "./lib/mail.js";
import { ZodError, z } from "zod";
import { rateLimit as customRateLimit } from "./lib/rate-limiter.js";
import { rateLimit } from "express-rate-limit";
import { adminAudit } from "./infrastructure/audit/admin-audit-log.service.js";

// Security: HTML/XML encoding helpers to prevent XSS in server-rendered templates
function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Keep in sync with client/src/lib/landing-pages.ts (LANDING_SLUGS).
const SEO_LANDING_SLUGS = [
  "port-vila-airport-transfers",
  "efate-island-day-tours",
  "blue-lagoon-vanuatu-tour",
  "mele-cascades-tour",
  "vanuatu-cultural-tours",
  "port-vila-private-transfers",
];

/**
 * robots.txt served from an in-memory constant via an explicit always-200 route
 * (see below). Kept in sync with client/public/robots.txt. Serving it from code —
 * with no DB or async work — guarantees crawlers never get a 5xx for /robots.txt
 * during a deploy/restart window. A 5xx on robots.txt makes Google cache
 * "disallow everything" for up to 24h, which previously blocked the whole site.
 */
function buildRobotsTxt(): string {
  const siteUrl = (process.env.APP_URL || "https://acetoursvanuatu.com").replace(/\/$/, "");
  return [
    "User-agent: *",
    "Allow: /",
    "",
    "# Block admin panel from indexing",
    "Disallow: /admin/",
    "Disallow: /api/",
    "",
    "# Block checkout flow from indexing",
    "Disallow: /cart",
    "Disallow: /payment",
    "Disallow: /confirmation",
    "",
    `Sitemap: ${siteUrl}/sitemap.xml`,
    "",
  ].join("\n");
}

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
  windowMs: 15 * 60 * 1000, // 15-minute window
  max: 5,                    // 5 attempts per IP — tight enough to block brute-force, fine for real guests
  message: { error: "Too many verification attempts, please try again in 15 minutes." },
});

const newsletterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // max 5 subscribe attempts per IP per 15 minutes
  message: { error: "Too many subscription attempts, please try again later." },
});

const reviewsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // max 3 guest reviews per IP per hour
  message: { error: "Too many review submissions. Please try again later." },
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // max 5 contact form submissions per IP per hour
  message: { error: "Too many messages sent. Please try again later." },
});

const holdsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: "Too many hold requests, please try again later." },
});

const cartPriceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "Too many pricing requests, please try again later." },
});

// C6 Fix: Zod schema for booking creation
const createBookingItemSchema = z.object({
  productId: z.string(),
  adultPax: z.number().int().min(0),
  childPax: z.number().int().min(0),
  infantPax: z.number().int().min(0).default(0), // NEW — infants under 2, free, no capacity impact
  petPax: z.number().int().min(0).default(0), // NEW — pets, free, manifesting only
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
  locale: z.string().optional().default("en"),
}).refine(data => {
  const totalPax = data.items.reduce((sum, item) => sum + (item.adultPax || 0) + (item.childPax || 0), 0);
  return totalPax >= 1;
}, {
  message: "At least one guest (adult or child) is required across all items",
  path: ["items"],
});


// Ensure uploads directory exists (legacy support if needed)
const basePath = path.resolve(process.cwd(), 'attached_assets');
const uploadDir = path.normalize(path.join(basePath, 'uploads'));
if (!uploadDir.startsWith(basePath)) {
  throw new Error('Invalid upload directory path detected');
}
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

  // ── Vehicle hire retirement (Vanuatu FIU compliance) ─────────────────────
  // /vehicles and /vehicles/:id are permanently retired. 301 to /transfers
  // so any inbound link or bookmark lands on the closest equivalent offering.
  app.get("/vehicles", (_req, res) => res.redirect(301, "/transfers"));
  app.get("/vehicles/:id", (_req, res) => res.redirect(301, "/transfers"));

  // ── SEO: Sitemap ──────────────────────────────────────────────────────────
  // Always-200 robots.txt, served from an in-memory string with no DB/async work
  // so a deploy/restart window can never return a 5xx here (which Google caches as
  // "block everything"). Registered before the static middleware so it wins, and
  // before /sitemap.xml to keep the SEO routes together.
  app.get("/robots.txt", (_req, res) => {
    res.header("Content-Type", "text/plain; charset=utf-8");
    res.header("Cache-Control", "public, max-age=3600");
    res.send(buildRobotsTxt());
  });

  app.get("/sitemap.xml", async (_req, res) => {
    try {
      const SITE_URL = process.env.APP_URL || "https://acetoursvanuatu.com";
      const products = await storage.getProducts();
      const now = new Date().toISOString().split("T")[0];

      const staticPages = [
        { loc: "/",          priority: "1.0", changefreq: "weekly",  lastmod: now },
        { loc: "/tours",     priority: "0.9", changefreq: "daily",   lastmod: now },
        { loc: "/transfers", priority: "0.9", changefreq: "daily",   lastmod: now },
        { loc: "/faq",       priority: "0.7", changefreq: "monthly", lastmod: now },
        { loc: "/about",     priority: "0.6", changefreq: "monthly", lastmod: now },
        { loc: "/contact",   priority: "0.6", changefreq: "monthly", lastmod: now },
      ];

      for (const slug of SEO_LANDING_SLUGS) {
        staticPages.push({ loc: `/${slug}`, priority: "0.8", changefreq: "monthly", lastmod: now });
      }

      const productPages = products
        .filter((p: any) => p.isActive !== false && p.category !== "vehicle")
        .map((p: any) => {
          const type = p.category === "transfer" ? "transfers" : "tours";
          // Use the product's own updatedAt so Googlebot knows when content last changed
          const lastmod = p.updatedAt
            ? new Date(p.updatedAt).toISOString().split("T")[0]
            : now;
          return { loc: `/${type}/${p.id}`, priority: "0.8", changefreq: "weekly", lastmod };
        });

      const allPages = [...staticPages, ...productPages];

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map(p => `  <url>
    <loc>${escapeXml(SITE_URL)}${escapeXml(p.loc)}</loc>
    <lastmod>${escapeXml(p.lastmod)}</lastmod>
    <changefreq>${escapeXml(p.changefreq)}</changefreq>
    <priority>${escapeXml(p.priority)}</priority>
  </url>`).join("\n")}
</urlset>`;

      res.header("Content-Type", "application/xml");
      res.header("Cache-Control", "public, max-age=3600");
      res.send(xml);
    } catch {
      res.status(500).send("<!-- sitemap generation failed -->");
    }
  });

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

  app.post("/api/holds", holdsLimiter, async (req, res) => {
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
      // Translate known domain errors to user-friendly messages; never expose internals
      const msg = error?.message || "";
      if (msg.includes("capacity") || msg.includes("unavailable") || msg.includes("no availability")) {
        res.status(409).json({ error: "This slot is no longer available. Please choose a different time." });
      } else {
        res.status(400).json({ error: "Could not reserve this slot. Please try again." });
      }
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
      const { productId, effectiveFrom, ruleMetadata, adultPriceCents, childPriceCents, infantPriceCents, petPriceCents, groupPriceCents, pricingType } = req.body;
      const isGroup = pricingType === 'group';
      if (!productId || !effectiveFrom) return res.status(400).json({ error: "Missing required pricing fields" });
      if (isGroup && !groupPriceCents) return res.status(400).json({ error: "Group price is required for group pricing type" });
      if (!isGroup && adultPriceCents === undefined) return res.status(400).json({ error: "Adult price is required for per-person pricing type" });
      const created = await storage.createPricingVersion({
        productId, effectiveFrom, ruleMetadata,
        adultPriceCents: adultPriceCents || 0,
        childPriceCents: childPriceCents || 0,
        infantPriceCents: infantPriceCents || 0,
        petPriceCents: petPriceCents || 0,
        groupPriceCents: groupPriceCents || 0,
        pricingType: pricingType || 'per_person',
        createdBy: req.session.userId,
      });
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

  // ── Fraud Detection Admin Routes ──────────────────────────────────────────

  /**
   * GET /api/admin/fraud
   * Returns all bookings flagged for fraud review, enriched with parsed signal data.
   */
  app.get("/api/admin/fraud", requireAdmin, async (_req, res) => {
    try {
      const flagged = await storage.getFlaggedBookings();
      const enriched = flagged.map(b => {
        const bAny = b as any;
        return {
          ...b,
          fraud: bAny.fraudLevel != null
            ? {
              score: bAny.fraudScore ?? 0,
              level: bAny.fraudLevel,
              signals: Array.isArray(bAny.fraudSignals) ? bAny.fraudSignals : [],
            }
            : null,
        };
      });
      res.json(enriched);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch flagged bookings" });
    }
  });

  /**
   * POST /api/admin/fraud/:id/approve
   * Clears the fraud flag from a booking, marking it as reviewed and safe.
   */
  app.post("/api/admin/fraud/:id/approve", requireAdmin, async (req, res) => {
    try {
      const booking = await storage.getBooking(req.params.id);
      if (!booking) return res.status(404).json({ error: "Booking not found" });
      // Record that an admin reviewed and approved this booking
      await storage.updateBooking(req.params.id, {
        fraudReviewedAt: new Date(),
        fraudReviewedBy: (req.session as any)?.userId || null,
      } as any);
      res.json({ success: true, message: "Fraud flag cleared. Booking approved." });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to approve booking" });
    }
  });

  /**
   * POST /api/admin/fraud/:id/dismiss
   * Cancels a fraud-flagged booking.
   */
  app.post("/api/admin/fraud/:id/dismiss", requireAdmin, async (req, res) => {
    try {
      const booking = await storage.getBooking(req.params.id);
      if (!booking) return res.status(404).json({ error: "Booking not found" });
      await storage.updateBooking(req.params.id, {
        status: "cancelled",
        fraudReviewedAt: new Date(),
        fraudReviewedBy: (req.session as any)?.userId || null,
      } as any);
      res.json({ success: true, message: "Booking cancelled due to fraud review." });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to dismiss booking" });
    }
  });

  // ── End Fraud Detection Admin Routes ──────────────────────────────────────

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
  app.post("/api/cart/price", cartPriceLimiter, async (req, res) => {
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
        infantPax: parseInt(item.infantPax) || 0, // NEW — stored, not priced
        petPax: parseInt(item.petPax) || 0, // NEW — stored, not priced
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
      res.status(400).json({ error: "Failed to calculate cart price. Please refresh and try again." });
    }
  });

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

  // Bookings API
  app.get("/api/bookings", requireAdmin, async (req, res) => {
    try {
      const includeArchived = req.query.includeArchived === 'true';
      const bookings = await storage.getBookings(includeArchived);

      // Fetch all payments and gateways to map payment methods to bookings
      const allPayments = await db.select().from(schema.payments);
      const allGateways = await storage.getPaymentGateways();
      const gatewayMap = new Map(allGateways.map(g => [g.id, g.slug]));

      const bookingPaymentMap = new Map<string, string | undefined>();
      for (const p of allPayments) {
        if (!bookingPaymentMap.has(p.bookingId) || p.status !== 'failed') {
          bookingPaymentMap.set(p.bookingId, gatewayMap.get(p.gatewayId));
        }
      }

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
        paymentMethod: bookingPaymentMap.get(b.id) || null,
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
      const csvHeader = "ID,Customer,Product,Date,Amount,Status,Guests\n";
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

  // Advanced Analytics (Admin only) - Consolidated in section below (lines 2200+)

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
        const tourInfo = await storage.getProduct(booking.tourId);
        await sendEmail({
          to: booking.customerEmail!,
          subject: `Booking Cancelled — ACT-${shortBookingRef(booking.id)}`,
          html: await getBookingStatusUpdateTemplate(booking, "cancelled", tourInfo || { title: booking.tourName || "Your Tour" }),
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

      const VERIFY_FAIL = { error: "Booking not found or verification failed." };

      // Support both full UUID (book_xxxx-...) and short 8-char ref (e.g. 04C85720)
      // shown in confirmation emails. Try full UUID first, then scan by prefix.
      let booking = await storage.getBooking(bookingId.trim());

      if (!booking) {
        // Normalise: strip ACT- prefix (shown in emails), book_ db prefix, and dashes
        const shortRef = bookingId.trim()
          .replace(/^ACT-/i, '')
          .replace(/^book_/i, '')
          .replace(/-/g, '')
          .slice(0, 8)
          .toLowerCase();
        if (shortRef.length >= 6) {
          const allRecent = await storage.getBookingsByEmail(email.trim());
          booking = allRecent.find(b =>
            b.id.replace(/^book_/i, '').replace(/-/g, '').toLowerCase().startsWith(shortRef)
          );
        }
      }

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

      const { date, adultPax, childPax, dryRun } = req.body as {
        date?: string;
        adultPax?: number;
        childPax?: number;
        dryRun?: boolean;
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

      // Dry run: return price preview without committing changes
      if (dryRun) {
        return res.json({
          dryRun: true,
          changed: newTotalCents !== booking.totalAmountCents || newDate !== booking.date || newAdultPax !== booking.adultPaxTotal || newChildPax !== booking.childPaxTotal,
          priceDifference: newTotalCents - booking.totalAmountCents,
          currentTotalCents: booking.totalAmountCents,
          newTotalCents,
          requiresAdditionalPayment: newTotalCents > booking.totalAmountCents,
          creditPending: newTotalCents < booking.totalAmountCents,
        });
      }

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
      // Allow access if this booking was recently created in this session (checkout flow)
      const isRecentBooking = (req.session as any).recentBookingIds?.includes(req.params.id);

      if (!isAdmin && !isOwner && !isRecentBooking) {
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
      const booking = await storage.getBooking(req.params.id);
      if (!booking) return res.status(404).json({ error: "Booking not found" });

      // Mirror the same ownership checks as GET /api/bookings/:id
      const isAdmin = req.session.userRole === 'admin';
      const isOwner = booking.userId === req.session.userId || booking.bookingSessionId === req.sessionID;
      const isRecentBooking = (req.session as any).recentBookingIds?.includes(req.params.id);

      if (!isAdmin && !isOwner && !isRecentBooking) {
        return res.status(401).json({ error: "Unauthorized access to booking items" });
      }

      const items = await storage.getBookingItems(req.params.id);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch booking items" });
    }
  });

  // ─── QR Code endpoint ─────────────────────────────────────────────────────
  // Generates a QR code PNG (base64) whose payload is the manage-booking deep-link.
  // Used by confirmation page, print itinerary, and embedded in email templates.
  app.get("/api/bookings/:id/qr", async (req, res) => {
    try {
      const booking = await storage.getBooking(req.params.id);
      if (!booking) return res.status(404).json({ error: "Booking not found" });

      const appUrlSetting = await storage.getSiteSetting("app_url");
      const appUrl = ((typeof appUrlSetting?.value === "string" ? appUrlSetting.value : "") ||
        process.env.APP_URL || "https://aceproducts.vu").replace(/\/$/, "");
      const shortRef = booking.id.replace(/^book_/i, "").replace(/-/g, "").slice(0, 8).toUpperCase();
      // QR payload: the manage-booking deep-link — scannable by the tour guide or guest
      const qrData = `${appUrl}/manage-booking?ref=${booking.id}`;

      const QRCode = await import("qrcode");
      // Return both the data URL (for img src) and the raw string
      const dataUrl = await QRCode.default.toDataURL(qrData, {
        width: 200,
        margin: 2,
        errorCorrectionLevel: "H",
        color: { dark: "#004165", light: "#ffffff" },
      });

      res.json({ qrData, dataUrl, shortRef });
    } catch (error) {
      console.error("[QR] Failed to generate QR code:", error);
      res.status(500).json({ error: "Failed to generate QR code" });
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
        pickupLocation: pickupLocation ?? undefined
      });

      // ── Fraud Detection ──────────────────────────────────────────────────
      // Run asynchronously after booking is created. Non-blocking: a fraud
      // assessment failure never prevents the booking from being returned.
      try {
        const { FraudDetectionService } = await import("./infrastructure/fraud/FraudDetectionService.js");
        const fraudService = new FraudDetectionService(storage);
        const firstItem = items[0];
        const assessment = await fraudService.assess({
          bookingId: booking.id,
          customerEmail: booking.customerEmail || customerEmail,
          customerName: booking.customerName || customerName,
          customerPhone: booking.customerPhone,
          ipAddress: req.ip || req.socket?.remoteAddress || "unknown",
          totalAmountCents: booking.totalAmountCents || 0,
          guests: booking.guests || 0,
          tourId: booking.tourId,
          date: firstItem?.date || booking.date,
          sessionId: req.sessionID,
        });

        if (assessment.requiresReview) {
          // Write fraud data to dedicated typed columns (no notes pollution)
          await fraudService.writeToBooking(booking.id, assessment);
          console.log(`[FRAUD] Flagged booking ${booking.id} for review (score: ${assessment.riskScore})`);
        }

        // Hard block: critical score + IP burst detected
        if (assessment.shouldBlock) {
          // Cancel the booking immediately
          await storage.updateBooking(booking.id, { status: "cancelled" });
          return res.status(403).json({
            error: "Your booking could not be processed. Please contact us directly if you believe this is an error.",
          });
        }
      } catch (fraudErr) {
        // Never let fraud detection crash the booking flow
        console.error("[FRAUD] Assessment error (non-fatal):", fraudErr);
      }
      // ── End Fraud Detection ──────────────────────────────────────────────

      // ✅ Email notifications are intentionally deferred until payment is confirmed.
      // The payment completion handler (payment.routes.ts) sends emails after final payment.
      // Sending emails here (at booking creation) would notify customers before they've paid.

      // Store booking ID in session for checkout access
      if (!((req.session as any).recentBookingIds)) {
        (req.session as any).recentBookingIds = [];
      }
      (req.session as any).recentBookingIds.push(booking.id);
      // Keep only last 5 to avoid session bloat
      if ((req.session as any).recentBookingIds.length > 5) {
        (req.session as any).recentBookingIds = (req.session as any).recentBookingIds.slice(-5);
      }

      // Save session immediately so recentBookingIds is available for the checkout request
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => { if (err) reject(err); else resolve(); });
      });

      // D: Broadcast new booking event to all connected admin SSE clients
      try {
        const sseClients: Array<{ res: any; userId: string; role: string }> = (app as any)._sseClients ?? [];
        const payload = JSON.stringify({
          id: booking.id,
          customerName: booking.customerName,
          tourName: booking.tourName,
          amount: booking.amount,
          status: booking.status,
          createdAt: new Date().toISOString(),
        });
        sseClients
          .filter(c => c.role === "admin")
          .forEach(c => {
            try { c.res.write(`event: new_booking\ndata: ${payload}\n\n`); } catch { /* closed */ }
          });
      } catch { /* never crash the booking */ }

      res.status(201).json(booking);
    } catch (error: any) {
      const msg: string = error?.message || "";
      console.error("[ROUTE] POST /api/bookings failed:", msg, error?.stack || "");
      // Surface known domain errors as user-friendly messages; hide internal details

      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Invalid booking data.", details: error.errors });
      }
      // Availability / capacity errors — from createHold capacity check, vehicle conflicts, blackouts
      if (
        msg.toLowerCase().includes("insufficient availability") ||
        msg.toLowerCase().includes("capacity") ||
        msg.toLowerCase().includes("unavailable") ||
        msg.toLowerCase().includes("blackout") ||
        msg.toLowerCase().includes("already reserved") ||
        msg.toLowerCase().includes("no available") ||
        msg.toLowerCase().includes("no single")
      ) {
        return res.status(409).json({ error: "One or more items in your cart are no longer available. Please update your cart and try again." });
      }
      if (msg.toLowerCase().includes("past date") || msg.toLowerCase().includes("past_date")) {
        return res.status(400).json({ error: "Bookings cannot be made for past dates." });
      }
      if (msg.toLowerCase().includes("idempotency") || msg.toLowerCase().includes("duplicate")) {
        return res.status(409).json({ error: "This booking was already submitted. Please check your bookings." });
      }
      if (msg.toLowerCase().includes("paused") || msg.toLowerCase().includes("maintenance")) {
        return res.status(503).json({ error: "Bookings are temporarily paused for maintenance. Please try again shortly." });
      }
      // Product or pricing data missing — stale cart item referencing a deleted/unconfigured product
      if (msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("rates for")) {
        return res.status(422).json({ error: "One or more items in your cart are no longer available. Please remove them and try again." });
      }
      // Genuine server error — log full details server-side, return sanitised message to client
      console.error("[ROUTE] POST /api/bookings unhandled error:", error);
      res.status(500).json({ error: "An unexpected error occurred. Please try again or contact us for assistance.", debug: process.env.NODE_ENV !== "production" ? msg : undefined });
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
        if (Object.prototype.hasOwnProperty.call(updates, field) && updates[field] !== undefined) {
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
        const allowed = (Object.prototype.hasOwnProperty.call(ALLOWED_TRANSITIONS, existing.status) ? ALLOWED_TRANSITIONS[existing.status] : null) ?? [];
        if (!allowed.includes(updates.status)) {
          return res.status(400).json({
            error: `Invalid status transition: '${existing.status}' → '${updates.status}'. Allowed: [${allowed.join(', ') || 'none'}]`,
          });
        }
      }

      // If cancelling, release holds and flag completed payments for refund
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

          // Flag completed payments for refund
          const payments = await storage.getPaymentsByBooking(existing.id);
          const completedPayments = payments.filter((p: any) => p.status === 'completed');
          for (const p of completedPayments) {
            await storage.updatePayment(p.id, {
              status: 'refund_pending',
              failureReason: `Refund required: booking cancelled by admin`
            });
            console.log(`[BOOKING][CANCEL] Flagged payment ${p.id} for refund (amount: ${p.amount})`);
          }
          if (completedPayments.length > 0) {
            try {
              await sendAdminEmail(
                `Refund Required — ACT-${shortBookingRef(existing.id)}`,
                `<p>Booking <strong>ACT-${escapeHtml(shortBookingRef(existing.id))}</strong> was cancelled after payment.</p>
                 <p><strong>${completedPayments.length}</strong> payment(s) totalling <strong>VT ${completedPayments.reduce((s: number, p: any) => s + (p.amount || 0), 0).toLocaleString()}</strong> require manual refund.</p>
                 <p>Customer: ${escapeHtml(existing.customerName || '')} (${escapeHtml(existing.customerEmail || '')})</p>`
              );
            } catch (emailErr) {
              console.error('[BOOKING][CANCEL] Refund notification email failed:', emailErr);
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
          const tourData = firstItem ? await storage.getProduct(firstItem.productId) : null;
          const tourInfo = tourData || { title: 'Product/Transfer Booking' };

          const emailBooking = {
            ...booking,
            date: booking.date || new Date().toISOString().split('T')[0],
            guests: `${firstItem?.adultPax || 1} Adult(s)${firstItem?.childPax ? ', ' + firstItem.childPax + ' Child(ren)' : ''}`,
            amount: `VT ${(booking.totalAmountCents || 0).toLocaleString()}`,
          };

          await sendEmail({
            to: booking.customerEmail,
            subject: `Booking ${updates.status.charAt(0).toUpperCase() + updates.status.slice(1)} — ACT-${shortBookingRef(booking.id)}`,
            html: await getBookingStatusUpdateTemplate(emailBooking, updates.status, tourInfo),
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
      const hardDelete = req.query.hard === 'true';
      await storage.deleteBooking(req.params.id, hardDelete);
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
    } catch (error: any) {
      const ref = Date.now().toString();
      console.error(`[SETTINGS ERROR][${ref}]`, error?.message, error?.code);
      // Return empty array so the UI degrades gracefully
      res.json([]);
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
      const before = await storage.getSiteSetting(req.params.key).catch(() => null);
      const setting = await storage.upsertSiteSetting({
        key: req.params.key,
        value: req.body.value,
      });
      await adminAudit.log({
        action: "settings.update",
        entityType: "site_settings",
        entityId: req.params.key,
        entityName: req.params.key,
        performedBy: req.session.userId,
        previousValue: before ? { value: (before as any).value } : null,
        newValue: { value: req.body.value },
        req,
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

  // Update subscriber (manually confirm, unsubscribe, re-subscribe, edit name)
  app.patch("/api/newsletter/subscribers/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { confirmed, unsubscribedAt, name } = req.body;
      // Build update using drizzle ORM
      const updateData: Record<string, any> = {};
      if (confirmed !== undefined) updateData.confirmed = confirmed;
      if (unsubscribedAt !== undefined) updateData.unsubscribedAt = unsubscribedAt === null ? null : new Date(unsubscribedAt);
      if (name !== undefined) updateData.name = name;
      if (Object.keys(updateData).length === 0) return res.json({ success: true });
      await db.update(newsletterSubscribers).set(updateData).where(eq(newsletterSubscribers.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error("[NEWSLETTER PATCH ERROR]:", error);
      res.status(500).json({ error: "Failed to update subscriber" });
    }
  });

  // Delete subscriber permanently
  // PUBLIC: One-click newsletter unsubscribe (CAN-SPAM compliance)
  app.get("/api/newsletter/unsubscribe", async (req, res) => {
    try {
      const { email, token } = req.query as { email?: string; token?: string };
      if (!email || !token) {
        return res.status(400).send("<html><body><h2>Invalid unsubscribe link.</h2></body></html>");
      }

      // Verify HMAC token to prevent abuse
      const expectedToken = crypto
        .createHmac("sha256", config.session.secret || "newsletter-unsub")
        .update(email.toLowerCase().trim())
        .digest("hex")
        .slice(0, 16);

      if (token !== expectedToken) {
        return res.status(403).send("<html><body><h2>Invalid or expired unsubscribe link.</h2></body></html>");
      }

      // Find and unsubscribe
      const existing = await db.execute(
        sql`UPDATE newsletter_subscribers SET unsubscribed_at = NOW() WHERE LOWER(email) = ${email.toLowerCase().trim()} AND unsubscribed_at IS NULL`
      );

      const safeUrl = escapeHtml(process.env.APP_URL || 'https://acetours.vu');
      res.send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:60px;">
          <h2>You've been unsubscribed</h2>
          <p>You will no longer receive newsletter emails from Ace Tours &amp; Transfers.</p>
          <p><a href="${safeUrl}">Return to website</a></p>
        </body></html>
      `);
    } catch (error) {
      console.error("[NEWSLETTER] Unsubscribe error:", error);
      res.status(500).send("<html><body><h2>Something went wrong. Please contact us.</h2></body></html>");
    }
  });

  app.delete("/api/newsletter/subscribers/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await db.execute(sql`DELETE FROM newsletter_subscribers WHERE id = ${id}`);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete subscriber" });
    }
  });

  app.post("/api/newsletter/subscribe", newsletterLimiter, async (req, res) => {
    try {
      // Check feature flag
      const newsletterFlag = await storage.getFeatureFlag("newsletter");
      if (newsletterFlag && !newsletterFlag.enabled) {
        return res.status(403).json({ error: "Newsletter subscriptions are currently disabled." });
      }

      const { email, name, locale, source } = req.body;
      if (!email) return res.status(400).json({ error: "Email is required" });

      // Basic email format validation to prevent junk
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) return res.status(400).json({ error: "Invalid email address" });
      if (email.length > 254) return res.status(400).json({ error: "Email address too long" });

      // Sanitize name
      const safeName = typeof name === "string" ? name.slice(0, 100).trim() : null;
      const safeLocale = typeof locale === "string" ? locale.slice(0, 10).trim() : "en";
      const safeSource = typeof source === "string" ? source.slice(0, 50).trim() : "website";

      const subscriber = await storage.subscribeNewsletter({
        email: email.toLowerCase().trim(),
        name: safeName,
        locale: safeLocale,
        source: safeSource
      });

      // Send branded confirmation email with List-Unsubscribe header (CAN-SPAM)
      try {
        const { sendNewsletterEmail } = await import("./lib/mail.js");
        await sendNewsletterEmail(
          email.toLowerCase().trim(),
          "You're subscribed to Ace Tours & Transfers!",
          await getNewsletterConfirmationTemplate(email.toLowerCase().trim(), safeName || undefined),
        );
      } catch (emailErr) {
        console.error("[NEWSLETTER] Confirmation email failed (non-fatal):", emailErr);
      }

      res.status(201).json({ message: "Subscribed!", subscriber });
    } catch (error) {
      res.status(400).json({ error: "Failed to subscribe" });
    }
  });

  // ── Contact Form ─────────────────────────────────────────────────────────
  /**
   * POST /api/contact
   * Accepts a guest contact form submission.
   * - Sends a branded notification email to admin
   * - Sends an auto-reply confirmation to the guest
   */
  app.post("/api/contact", contactLimiter, async (req, res) => {
    try {
      const { name, email, phone, subject, message } = req.body;

      // Validation
      if (!name || typeof name !== "string" || name.trim().length < 2) {
        return res.status(400).json({ error: "A valid name is required." });
      }
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "A valid email address is required." });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email) || email.length > 254) {
        return res.status(400).json({ error: "Invalid email address." });
      }
      if (!message || typeof message !== "string" || message.trim().length < 10) {
        return res.status(400).json({ error: "Message must be at least 10 characters." });
      }
      if (message.trim().length > 3000) {
        return res.status(400).json({ error: "Message is too long (max 3000 characters)." });
      }

      const contact = {
        name: name.trim().slice(0, 100),
        email: email.toLowerCase().trim(),
        phone: typeof phone === "string" ? phone.trim().slice(0, 30) || undefined : undefined,
        subject: typeof subject === "string" ? subject.trim().slice(0, 200) || undefined : undefined,
        message: message.trim(),
      };

      // 1. Notify admin
      try {
        await sendAdminEmail(
          `📬 Contact Form: ${contact.subject || "New Enquiry"} — ${contact.name}`,
          await getContactFormTemplate(contact)
        );
      } catch (adminEmailErr) {
        console.error("[CONTACT] Admin notification email failed:", adminEmailErr);
        // Still attempt guest auto-reply even if admin email fails
      }

      // 2. Auto-reply to guest
      try {
        const { getContactAutoReplyTemplate } = await import("./lib/mail.js");
        const locale = req.body.locale || 'en';
        const autoReplyHtml = await getContactAutoReplyTemplate(contact, locale);

        await sendEmail({
          to: contact.email,
          subject: locale === 'en' ? "We received your message — Ace Tours & Transfers" 
                 : locale === 'fr' ? "Nous avons reçu votre message — Ace Tours & Transfers"
                 : locale === 'es' ? "Recibimos su mensaje — Ace Tours & Transfers"
                 : locale === 'zh' ? "我们已收到您的留言 — Ace Tours & Transfers"
                 : "Mifola Kasem Mesej blong Yula — Ace Tours",
          html: autoReplyHtml,
        });
      } catch (guestEmailErr) {
        console.error("[CONTACT] Guest auto-reply email failed (non-fatal):", guestEmailErr);
      }

      return res.status(200).json({ message: "Message sent! We'll be in touch shortly." });
    } catch (error: any) {
      console.error("[CONTACT] Unexpected error:", error);
      return res.status(500).json({ error: "Failed to send message. Please try again." });
    }
  });

  // CMS/Content Blocks API
  app.get("/api/content-blocks", async (req, res) => {
    try {
      const locale = req.query.locale as string | undefined;
      const allContent = await storage.getAllCmsContentByLocale(locale || 'en');
      // Use null-prototype object to prevent prototype pollution via bracket notation
      const result: Record<string, any[]> = Object.create(null);

      allContent.forEach(item => {
        const slug = item.blockSlug;
        // Guard against prototype pollution: only allow simple string slugs
        if (typeof slug !== 'string' || slug === '__proto__' || slug === 'constructor' || slug === 'prototype') return;
        if (!result[slug]) {
          result[slug] = [];
        }
        result[slug].push(item);
      });

      res.json(result);
    } catch (error: any) {
      console.error("[ROUTE] GET /api/content-blocks failed:", error?.message, error?.code);
      res.json({});
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

  app.patch("/api/admin/cms-content/:id", requireAdmin, async (req, res) => {
    try {
      const content = await storage.updateCmsContent(req.params.id, req.body);
      if (!content) return res.status(404).json({ error: "Content not found" });
      res.json(content);
    } catch (error) {
      res.status(400).json({ error: "Failed to update content" });
    }
  });

  // Auto-translate a CMS content item to all supported languages
  app.post("/api/admin/cms-content/auto-translate", requireAdmin, async (req, res) => {
    try {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "Content ID is required" });

      const source = await storage.getCmsContentItem(id);
      if (!source) return res.status(404).json({ error: "Content not found" });
      if (!source.value?.trim()) return res.status(400).json({ error: "Content value is empty — nothing to translate" });

      const { translateToAll } = await import("./lib/translate.js");
      const translations = await translateToAll(source.value);

      const results: any[] = [];
      for (const [locale, translatedValue] of Object.entries(translations)) {
        const row = await storage.upsertCmsContentByLocale(
          source.blockSlug,
          source.contentKey,
          locale,
          translatedValue,
          source.contentType || 'text',
        );
        results.push(row);
      }

      res.json({ translated: results, sourceId: id, locales: Object.keys(translations) });
    } catch (error: any) {
      console.error("[ROUTE] POST /api/admin/cms-content/auto-translate failed:", error?.message);
      res.status(500).json({ error: "Auto-translation failed" });
    }
  });

  app.delete("/api/admin/cms-content/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteCmsContent(req.params.id);
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete content" });
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

  app.get("/api/admin/feature-flags/:slug", requireAdmin, async (req, res) => {
    try {
      const { slug } = req.params;
      const flag = await storage.getFeatureFlag(slug);
      if (!flag) {
        return res.status(404).json({ error: "Feature flag not found" });
      }
      res.json(flag);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch feature flag" });
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

      await adminAudit.log({
        action: "flag.toggle",
        entityType: "feature_flag",
        entityId: slug,
        entityName: (flag as any).displayName || (flag as any).name || slug,
        performedBy: req.session.userId,
        previousValue: { enabled: flag.enabled },
        newValue: { enabled: updated.enabled },
        req,
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
    // Broadcast to all SSE clients that a notification was read
    sseClients.forEach(client => {
      if (client.userId === req.session.userId || req.session.userRole === 'admin') {
        client.res.write(`event: notification_read\ndata: ${JSON.stringify({ id: req.params.id })}\n\n`);
      }
    });
    res.json({ success: true });
  });

  app.patch("/api/notifications/mark-all-read", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userRole === 'admin' ? undefined : req.session.userId;
      const unread = await storage.getUnreadNotifications(userId);
      for (const n of unread) await storage.markNotificationAsRead(n.id);
      res.json({ success: true, count: unread.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark all read" });
    }
  });

  // SSE endpoint for real-time notifications (no external package needed)
  const sseClients: Array<{ res: any; userId: string; role: string }> = [];

  app.get("/api/notifications/stream", requireAuth, (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
    res.flushHeaders();

    const client = { res, userId: req.session.userId!, role: req.session.userRole! };
    sseClients.push(client);

    // Send initial heartbeat
    res.write(`:heartbeat\n\n`);

    // Keepalive ping every 25s to prevent proxy timeouts
    const ping = setInterval(() => {
      try { res.write(`:ping\n\n`); } catch { clearInterval(ping); }
    }, 25000);

    req.on("close", () => {
      clearInterval(ping);
      const idx = sseClients.indexOf(client);
      if (idx !== -1) sseClients.splice(idx, 1);
    });
  });

  // Expose broadcaster for use in booking creation routes
  (app as any)._sseClients = sseClients;

  // GET all notifications (admin only — includes read ones, for message board history)
  app.get("/api/notifications/all", requireAdmin, async (_req, res) => {
    try {
      const all = await storage.getAllNotifications(200);
      res.json(all);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  // POST broadcast a message to all staff / specific user
  app.post("/api/notifications/broadcast", requireAdmin, async (req, res) => {
    try {
      const { title, message, type = "info", link, userId } = req.body;
      if (!title?.trim() || !message?.trim()) {
        return res.status(400).json({ error: "Title and message are required" });
      }

      const notification = await storage.createNotification({
        title: title.trim(),
        message: message.trim(),
        type,
        link: link?.trim() || null,
        userId: userId || null, // null = broadcast to all staff
        read: false,
      });

      // Push over SSE to connected clients
      const payload = JSON.stringify(notification);
      sseClients.forEach(client => {
        if (!userId || client.userId === userId || client.role === "admin" || client.role === "field_service") {
          try { client.res.write(`event: new_notification\ndata: ${payload}\n\n`); } catch { }
        }
      });

      res.status(201).json(notification);
    } catch (error) {
      console.error("Failed to broadcast notification:", error);
      res.status(500).json({ error: "Failed to broadcast notification" });
    }
  });

  // DELETE a notification (admin only)
  app.delete("/api/notifications/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteNotification(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete notification" });
    }
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

  app.get("/api/analytics/top-products", requireAdmin, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      // Fetch top 5 products by revenue
      const products = await storage.getTopPerformingProducts(5, days);
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch top products data" });
    }
  });

  // C: Revenue by product category for dashboard bar chart
  app.get("/api/analytics/revenue-by-category", requireAdmin, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const revenueData = await storage.getRevenueByCategory(days);
      res.json(revenueData);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch category revenue" });
    }
  });

  // C: BetterStack Uptime proxy — free tier, no credit card required.
  // Set env var BETTERSTACK_API_KEY and BETTERSTACK_MONITOR_ID from https://betterstack.com/uptime
  // Falls back gracefully to null if not configured so the UI shows "N/A".
  app.get("/api/admin/uptime", requireAdmin, async (_req, res) => {
    try {
      const apiKey = process.env.BETTERSTACK_API_KEY;
      const monitorId = process.env.BETTERSTACK_MONITOR_ID;
      if (!apiKey || !monitorId) {
        return res.json({ uptime: null, status: null, configured: false });
      }
      const response = await fetch(`https://uptime.betterstack.com/api/v2/monitors/${monitorId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!response.ok) return res.json({ uptime: null, status: null, configured: true });
      const data = await response.json() as any;
      const attrs = data?.data?.attributes;
      const availability = attrs?.availability != null ? Number(attrs.availability) : null;
      const uptimePct = availability != null ? `${availability.toFixed(2)}%` : "100.00%";
      res.json({ uptime: uptimePct, status: attrs?.status ?? "up", configured: true });
    } catch {
      res.json({ uptime: null, status: null, configured: false });
    }
  });

  // LOW-4: Stripe routes removed — not available to Vanuatu merchants.

  // Payment Reconciliation Routes
  app.get("/api/admin/reconciliation/stale", requireAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const payments = await storage.getStaleProcessingPayments(limit);
      res.json(payments);
    } catch (error) {
      console.error("[ROUTE] GET /api/admin/reconciliation/stale Error:", error);
      res.status(500).json({ error: "Failed to fetch stale payments" });
    }
  });

  app.post("/api/admin/reconciliation/sync/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { note, forceStatus } = req.body;
      const adminId = (req as any).user?.id; // Assuming user is attached by requireAdmin middleware

      const reconciliationService = new PaymentReconciliationService(storage);
      await reconciliationService.reconcileManually(id, adminId, note, forceStatus);

      const updatedPayment = await storage.getPayment(id);
      res.json(updatedPayment);
    } catch (error: any) {
      console.error(`[ROUTE] POST /api/admin/reconciliation/sync/${req.params.id} Error:`, error);
      res.status(500).json({ error: error.message || "Failed to sync payment" });
    }
  });

  app.post("/api/admin/reconciliation/batch", requireAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.body.limit as string) || 50;
      const reconciliationService = new PaymentReconciliationService(storage);
      await reconciliationService.reconcileStalePayments(limit);
      res.json({ success: true, message: `Batch reconciliation triggered for up to ${limit} payments.` });
    } catch (error) {
      console.error("[ROUTE] POST /api/admin/reconciliation/batch Error:", error);
      res.status(500).json({ error: "Failed to run batch reconciliation" });
    }
  });

  // Statement Reconciliation Upload
  app.post("/api/admin/reconciliation/statement", requireAdmin, upload.single('statement'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No statement file uploaded" });
      }

      const fileContent = req.file.buffer.toString('utf-8');
      const lines = fileContent.split(/\r?\n/);

      const OFFLINE_METHODS = [
        'manual_transfer', 'bank-transfer', 'bank_transfer', 'bank', 'cash',
        'cash-on-delivery', 'local-bank-transfer', 'local-bank', 'cash-at-office',
        'v-money', 'm-vatu', 'my-cash', 'digi-cash'
      ];

      // Fetch all pending bookings to check against
      const allBookings = await storage.getBookings();
      const pendingOfflineBookings = allBookings.filter((b: any) =>
        b.status === 'pending' && OFFLINE_METHODS.includes(b.paymentMethod || '')
      );

      const results = { matched: 0, flagged: 0, ignored: 0, details: [] as any[] };
      const matchedBookingIds = new Set<string>();

      for (const line of lines) {
        if (!line.trim()) continue;

        // Find if this line matches any pending offline booking
        let matchedBooking = null;
        let isAmountMatch = false;

        for (const booking of pendingOfflineBookings) {
          if (matchedBookingIds.has(booking.id)) continue;

          const shortRef = booking.id.replace(/^book_/i, "").replace(/-/g, "").slice(0, 8).toUpperCase();
          // Case insensitive search for the shortRef (e.g., ACT-1234ABCD or just 1234ABCD)
          if (line.toUpperCase().includes(shortRef)) {
            matchedBooking = booking;

            // Verify amount
            const expectedAmount = (booking.totalAmountCents || 0) / 100;
            // Check if the expected amount (as string) is cleanly in the line
            if (line.includes(expectedAmount.toString()) || line.includes(expectedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 }))) {
              isAmountMatch = true;
            }
            break;
          }
        }

        if (matchedBooking) {
          if (isAmountMatch) {
            await storage.updateBooking(matchedBooking.id, { status: "confirmed" });
            matchedBookingIds.add(matchedBooking.id);
            results.matched++;
            results.details.push({ bookingId: matchedBooking.id, ref: matchedBooking.id.slice(0, 8), status: 'fulfilled' });
          } else {
            results.flagged++;
            results.details.push({ bookingId: matchedBooking.id, ref: matchedBooking.id.slice(0, 8), status: 'flagged_amount_mismatch' });
          }
        } else {
          results.ignored++;
        }
      }

      res.json({ success: true, ...results });
    } catch (error) {
      console.error("[ROUTE] POST /api/admin/reconciliation/statement Error:", error);
      res.status(500).json({ error: "Failed to process statement" });
    }
  });

  // I: Public analytics config — returns GA4/GTM IDs for client-side injection
  app.get("/api/public/analytics-config", async (_req, res) => {
    try {
      const ga4 = await storage.getSiteSetting("ga4_measurement_id");
      const gtm = await storage.getSiteSetting("gtm_container_id");
      res.json({
        ga4MeasurementId: ga4?.value || null,
        gtmContainerId: gtm?.value || null,
      });
    } catch {
      res.json({ ga4MeasurementId: null, gtmContainerId: null });
    }
  });

  registerPaymentRoutes(app, storage);
  await registerRecoveryRoutes(app, storage);
  registerBookingEngineRoutes(app, storage, requireAdmin);

  // Safety 404 for /api routes to prevent hitting Vite middleware
  app.all("/api/*any", (req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
  });

  // ── Product Translation Admin Endpoints ─────────────────────────────────────

  // POST: trigger Google-Translate auto-fill for fr, es, zh
  app.post("/api/admin/products/:id/auto-translate", requireAdmin, async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) return res.status(404).json({ error: "Product not found" });
      await autoTranslateProduct(product);
      res.json({ ok: true, message: "Auto-translation complete for fr, es, zh. Bislama must be entered manually." });
    } catch (error: any) {
      console.error("[ROUTE] POST /api/admin/products/:id/auto-translate failed:", error?.message);
      res.status(500).json({ error: "Auto-translation failed" });
    }
  });

  // GET: fetch all saved translation rows for a product
  app.get("/api/admin/products/:id/translations", requireAdmin, async (req, res) => {
    try {
      const rows = await getProductTranslations(req.params.id);
      res.json(rows);
    } catch (error: any) {
      console.error("[ROUTE] GET /api/admin/products/:id/translations failed:", error?.message);
      res.status(500).json({ error: "Failed to fetch translations" });
    }
  });

  // PUT: save or overwrite a single locale translation
  app.put("/api/admin/products/:id/translations/:locale", requireAdmin, async (req, res) => {
    try {
      const { id, locale } = req.params;
      const product = await storage.getProduct(id);
      if (!product) return res.status(404).json({ error: "Product not found" });
      await upsertProductTranslation({ productId: id, locale, fields: req.body });
      res.json({ ok: true });
    } catch (error: any) {
      console.error("[ROUTE] PUT /api/admin/products/:id/translations/:locale failed:", error?.message);
      res.status(500).json({ error: "Failed to save translation" });
    }
  });

  // ── Articles (blog) ─────────────────────────────────────────────────────────
  // Public: published only
  app.get("/api/articles", async (_req, res) => {
    try {
      res.json(await storage.getPublishedArticles());
    } catch (e) {
      console.error("[ROUTE] GET /api/articles", e);
      res.status(500).json({ error: "Failed to load articles" });
    }
  });

  app.get("/api/articles/:slug", async (req, res) => {
    try {
      const a = await storage.getArticleBySlug(req.params.slug);
      if (!a || a.status !== "published") return res.status(404).json({ error: "Not found" });
      res.json(a);
    } catch (e) {
      console.error("[ROUTE] GET /api/articles/:slug", e);
      res.status(500).json({ error: "Failed to load article" });
    }
  });

  // Admin: full CRUD
  app.get("/api/admin/articles", requireAdmin, async (_req, res) => {
    try {
      res.json(await storage.getAllArticles());
    } catch (e) {
      console.error("[ROUTE] GET /api/admin/articles", e);
      res.status(500).json({ error: "Failed to load articles" });
    }
  });

  app.post("/api/admin/articles", requireAdmin, async (req, res) => {
    try {
      const body = { ...req.body };
      if (!body.slug || String(body.slug).trim() === "") {
        const taken = new Set((await storage.getAllArticles()).map((a) => a.slug));
        body.slug = uniqueSlug(slugify(body.title || "article"), taken);
      } else {
        body.slug = slugify(body.slug);
      }
      if (typeof body.bodyHtml === "string") body.bodyHtml = sanitizeServerHtml(body.bodyHtml);
      if (body.status === "published" && !body.publishedAt) body.publishedAt = new Date();
      const data = insertArticleSchema.parse(body);
      // normalize array columns drizzle-zod leaves optional
      const payload = { ...data, tags: (data as any).tags ?? [], relatedProductIds: (data as any).relatedProductIds ?? [] };
      const created = await storage.createArticle(payload);
      res.status(201).json(created);
    } catch (e: any) {
      if (e?.code === "23505") return res.status(409).json({ error: "Slug already exists" });
      console.error("[ROUTE] POST /api/admin/articles", e);
      res.status(400).json({ error: "Invalid article data" });
    }
  });

  app.patch("/api/admin/articles/:id", requireAdmin, async (req, res) => {
    try {
      const existing = await storage.getArticleById(req.params.id);
      if (!existing) return res.status(404).json({ error: "Not found" });
      const body = { ...req.body };
      delete body.id; delete body.createdAt; delete body.updatedAt;
      if (typeof body.slug === "string") body.slug = slugify(body.slug);
      if (typeof body.bodyHtml === "string") body.bodyHtml = sanitizeServerHtml(body.bodyHtml);
      if (body.status === "published" && !existing.publishedAt && !body.publishedAt) {
        body.publishedAt = new Date();
      }
      const updated = await storage.updateArticle(req.params.id, body as any);
      res.json(updated);
    } catch (e: any) {
      if (e?.code === "23505") return res.status(409).json({ error: "Slug already exists" });
      console.error("[ROUTE] PATCH /api/admin/articles/:id", e);
      res.status(400).json({ error: "Invalid article data" });
    }
  });

  app.delete("/api/admin/articles/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteArticle(req.params.id);
      res.status(204).end();
    } catch (e) {
      console.error("[ROUTE] DELETE /api/admin/articles/:id", e);
      res.status(500).json({ error: "Failed to delete article" });
    }
  });

  return httpServer;
}
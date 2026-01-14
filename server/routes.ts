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
import { BackupIntegrityGuard } from "./infrastructure/recovery/integrity-guard.js";
import { ExpressSessionAdapter } from "./infrastructure/session.adapter.js";
import { AvailabilityDomainService } from "./domain/services/availability.domain-service.js";
import { BookingApplicationService } from "./application/booking.application-service.js";
import { cloudinaryService } from "./infrastructure/storage/cloudinary-service.js";

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

  const availabilityDomainService = new AvailabilityDomainService();
  const bookingApplicationService = new BookingApplicationService(storage, availabilityDomainService);
  const availabilityAppService = new AvailabilityApplicationService(storage);

  // Availability API
  app.get("/api/availability", async (req, res) => {
    try {
      const tourId = req.query.tourId as string;
      const date = req.query.date as string;
      const slot = req.query.slot as string | undefined;
      if (!tourId || !date) return res.status(400).json({ error: "Missing tourId or date" });
      const result = await availabilityAppService.getAvailability(tourId, date, slot);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch availability" });
    }
  });

  app.post("/api/availability/check", async (req, res) => {
    try {
      const { serviceId, date, guests } = req.body;
      if (!serviceId || !date || !guests) return res.status(400).json({ error: "Missing required fields" });
      const result = await bookingApplicationService.checkServiceAvailability(serviceId, date, guests);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to check availability" });
    }
  });

  app.post("/api/holds", async (req, res) => {
    try {
      const { tourId, date, slot, quantity } = req.body;
      const sessionId = req.sessionID;
      if (!tourId || !date || !quantity) return res.status(400).json({ error: "Missing required fields" });
      const hold = await availabilityAppService.createHold({ tourId, date, slot, quantity: parseInt(quantity), sessionId });
      res.status(201).json(hold);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Admin Capacity Override
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

  app.post("/api/bookings", async (req, res) => {
    try {
      const { CreateBookingFromCartService } = await import("./application/booking/CreateBookingFromCartService.js");
      const bookingService = new CreateBookingFromCartService(storage);
      const { items, customerName, customerEmail } = req.body;
      if (!items || !items.length) return res.status(400).json({ error: "Cart is empty" });
      const booking = await bookingService.execute({ customerName, customerEmail, items });
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
      const booking = await storage.updateBooking(req.params.id, req.body);
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
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
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

  return httpServer;
}
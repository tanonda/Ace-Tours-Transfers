import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBookingSchema, insertTourSchema, insertContentBlockSchema, insertSiteSettingSchema, insertPaymentGatewaySchema, insertPaymentSchema, insertWishlistItemSchema, insertNewsletterSubscriberSchema, insertCmsContentSchema } from "@shared/schema";
import { getStripePublishableKey } from "./stripeClient";
import { registerAuthRoutes } from "./application/auth.routes";
import { registerUserRoutes } from "./application/user.routes";
import { registerPaymentRoutes } from "./application/payment.routes";
import { AvailabilityApplicationService } from "./application/availability/availability.application-service";
import { insertAvailabilityHoldSchema, insertTourInstanceSchema } from "@shared/schema";
import { registerRecoveryRoutes } from "./routes/recovery";
import { BackupIntegrityGuard } from "./infrastructure/recovery/integrity-guard";
import multer from "multer";
import { cloudinaryService } from "./infrastructure/storage/cloudinary-service";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Auth middleware
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    // Only log if it's NOT a standard auth check or a known guest-friendly path
    if (req.path !== "/api/auth/me") {
      console.log(`[AUTH] 401 Unauthorized: ${req.method} ${req.path}`);
    }
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    if (req.path !== "/api/auth/me") {
      console.log(`[ADMIN] 401 Unauthorized (No Session): ${req.method} ${req.path}`);
    }
    return res.status(401).json({ error: "Authentication required" });
  }
  if (req.session.userRole !== "admin") {
    console.log(`[ADMIN] 403 Forbidden (Not Admin): ${req.method} ${req.path}`);
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // 1. Enforce Integrity Guard (Global Read-Only Mode if needed)
  app.use(BackupIntegrityGuard.enforceReadOnly);

  // Application Routes
  registerAuthRoutes(app);
  registerUserRoutes(app);

  // Image Upload API (Admin Only)
  app.post("/api/admin/upload", requireAdmin, upload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }

      const folder = (req.query.folder as string) || "ace-tours";
      const imageUrl = await cloudinaryService.uploadImage(req.file.buffer, folder);
      
      res.json({ url: imageUrl });
    } catch (error: any) {
      console.error("[UPLOAD] Error:", error);
      res.status(500).json({ error: error.message || "Failed to upload image" });
    }
  });

  const availabilityAppService = new AvailabilityApplicationService(storage);

  // Availability API
  app.get("/api/availability", async (req, res) => {
    try {
      const tourId = req.query.tourId as string;
      const date = req.query.date as string;
      const slot = req.query.slot as string | undefined;

      if (!tourId || !date) {
        return res.status(400).json({ error: "Missing tourId or date" });
      }

      const result = await availabilityAppService.getAvailability(tourId, date, slot);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch availability" });
    }
  });

  app.post("/api/holds", async (req, res) => {
    try {
      const { tourId, date, slot, quantity } = req.body;
      const sessionId = req.sessionID; // Using express-session ID

      if (!tourId || !date || !quantity) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const hold = await availabilityAppService.createHold({
        tourId,
        date,
        slot,
        quantity: parseInt(quantity),
        sessionId
      });

      res.status(201).json(hold);
    } catch (error: any) {
      console.error("Hold creation failed:", error);
      res.status(400).json({ error: error.message });
    }
  });

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

  app.get("/api/config", (req, res) => {
    const { config } = require("./config");
    res.json({
      ddd: config.ddd
    });
  });

  app.get("/api/ping", (req, res) => {
    res.json({ pong: true });
  });

  // Tours API
  app.get("/api/tours", async (req, res) => {
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
      if (!tour) {
        return res.status(404).json({ error: "Tour not found" });
      }
      res.json(tour);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tour" });
    }
  });

  // Vehicles API (Vehicle Hire feature - extends tours with category="vehicle")
  app.get("/api/vehicles", async (req, res) => {
    try {
      const allTours = await storage.getTours();
      const vehicles = allTours.filter(t => t.category === "vehicle");
      res.json(vehicles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vehicles" });
    }
  });

  app.get("/api/vehicles/:id", async (req, res) => {
    try {
      const tour = await storage.getTour(req.params.id);
      if (!tour || tour.category !== "vehicle") {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      res.json(tour);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vehicle" });
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
      const existingTour = await storage.getTour(req.params.id);
      if (!existingTour) {
        return res.status(404).json({ error: "Tour not found" });
      }
      const tour = await storage.updateTour(req.params.id, req.body);
      res.json(tour);
    } catch (error) {
      console.error("Tour update error:", error);
      res.status(400).json({ error: "Failed to update tour" });
    }
  });

  app.delete("/api/tours/:id", requireAdmin, async (req, res) => {
    try {
      const existingTour = await storage.getTour(req.params.id);
      if (!existingTour) {
        return res.status(404).json({ error: "Tour not found" });
      }
      await storage.deleteTour(req.params.id);
      res.json({ message: "Tour deleted successfully" });
    } catch (error) {
      console.error("Tour delete error:", error);
      res.status(500).json({ error: "Failed to delete tour" });
    }
  });

  // Bookings API (admin can see all, users can see their own)
  app.get("/api/bookings", requireAdmin, async (req, res) => {
    try {
      const bookings = await storage.getBookings();
      res.json(bookings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bookings" });
    }
  });

  // Export bookings as CSV (admin only) - must be before :id route
  app.get("/api/bookings/export", requireAdmin, async (req, res) => {
    try {
      const bookings = await storage.getBookings();
      
      // Helper to escape CSV fields properly
      const escapeCSV = (value: string | number | null | undefined): string => {
        const str = String(value ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };
      
      const csvHeader = "ID,Customer,Tour,Date,Amount,Status,Guests\n";
      const csvRows = bookings.map(b => 
        [b.id, b.customerName, b.tourName, b.date, b.amount, b.status, b.guests]
          .map(escapeCSV)
          .join(',')
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
      // Users can only access their own bookings unless admin
      if (req.session.userRole !== 'admin' && req.session.userId !== req.params.userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const bookings = await storage.getUserBookings(req.params.userId);
      res.json(bookings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user bookings" });
    }
  });

  app.get("/api/bookings/:id", requireAuth, async (req, res) => {
    try {
      const booking = await storage.getBooking(req.params.id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      // Users can only see their own bookings unless admin
      if (req.session.userRole !== 'admin' && booking.userId !== req.session.userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(booking);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch booking" });
    }
  });

  // Helper for price validation
  const calculateBookingAmount = (tourPrice: string, guests: number): string => {
    const unitPrice = parseFloat(tourPrice.replace(/[^0-9.]/g, '')) || 0;
    return `$${(unitPrice * guests).toLocaleString()}`;
  };

  app.post("/api/bookings", async (req, res) => {
    try {
      const { CreateBookingFromCartService } = await import("./application/booking/CreateBookingFromCartService");
      const bookingService = new CreateBookingFromCartService(storage);
      
      const { items, customerName, customerEmail } = req.body;
      
      if (!items || !items.length) {
        return res.status(400).json({ error: "Cart must contain at least one item" });
      }

      const booking = await bookingService.execute({
        customerName,
        customerEmail,
        items
      });

      res.status(201).json(booking);
    } catch (error: any) {
      console.error("Booking creation failed:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // Admin Export
  app.get("/api/admin/export/bookings", requireAdmin, async (req, res) => {
    // ... logic moved or kept as is ...
  });

  app.patch("/api/bookings/:id", requireAuth, async (req, res) => {
    try {
      // Check if user has access to this booking
      const existingBooking = await storage.getBooking(req.params.id);
      if (!existingBooking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      if (req.session.userRole !== 'admin' && existingBooking.userId !== req.session.userId) {
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

  // Public booking lookup (for guests without accounts)
  app.post("/api/bookings/lookup", async (req, res) => {
    try {
      const { confirmationNumber, verificationType, verificationValue } = req.body;
      
      if (!confirmationNumber || !verificationType || !verificationValue) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      const booking = await storage.getBooking(confirmationNumber);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      
      // Verify the booking based on verification type
      let isVerified = false;
      const user = booking.userId ? await storage.getUser(booking.userId) : null;
      
      // Determine customer email and name from booking or user
      const customerEmail = user?.email || booking.customerEmail;
      const customerName = user?.name || booking.customerName;

      switch (verificationType) {
        case 'email':
          isVerified = customerEmail?.toLowerCase() === verificationValue.toLowerCase();
          break;
        case 'phone':
          isVerified = user?.phone === verificationValue; // Phone is only on user record
          break;
        case 'lastname':
          isVerified = customerName?.toLowerCase().includes(verificationValue.toLowerCase());
          break;
        default:
          return res.status(400).json({ error: "Invalid verification type" });
      }
      
      if (!isVerified) {
        return res.status(401).json({ error: "Verification failed" });
      }
      
      // Return limited booking info for security
      res.json({
        id: booking.id,
        tourName: booking.tourName,
        customerName: booking.customerName,
        date: booking.date,
        guests: booking.guests,
        amount: booking.amount,
        status: booking.status,
      });
    } catch (error) {
      console.error("Booking lookup error:", error);
      res.status(500).json({ error: "Failed to lookup booking" });
    }
  });

  // Analytics API (admin only)
  app.get("/api/analytics/stats", requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getBookingStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get("/api/analytics/revenue", requireAdmin, async (req, res) => {
    try {
      const revenue = await storage.getRevenueByMonth();
      res.json(revenue);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch revenue data" });
    }
  });

  // Content Blocks (CMS) API
  app.get("/api/content-blocks", async (req, res) => {
    try {
      const blocks = await storage.getContentBlocks();
      res.json(blocks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch content blocks" });
    }
  });

  app.get("/api/content-blocks/:slug", async (req, res) => {
    try {
      const block = await storage.getContentBlock(req.params.slug);
      if (!block) {
        return res.status(404).json({ error: "Content block not found" });
      }
      res.json(block);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch content block" });
    }
  });

  app.put("/api/admin/content-blocks/:slug", requireAdmin, async (req, res) => {
    try {
      const block = await storage.updateContentBlock(req.params.slug, req.body);
      res.json(block);
    } catch (error) {
      res.status(400).json({ error: "Failed to update content block" });
    }
  });

  app.post("/api/admin/content-blocks", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertContentBlockSchema.parse(req.body);
      const block = await storage.upsertContentBlock(validatedData);
      res.status(201).json(block);
    } catch (error) {
      res.status(400).json({ error: "Invalid content block data" });
    }
  });

  // Site Settings API
  app.get("/api/settings", async (req, res) => {
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
      if (!setting) {
        return res.status(404).json({ error: "Setting not found" });
      }
      res.json(setting);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch setting" });
    }
  });

  app.put("/api/admin/settings/:key", requireAdmin, async (req, res) => {
    try {
      const setting = await storage.upsertSiteSetting({
        key: req.params.key,
        value: req.body.value
      });
      res.json(setting);
    } catch (error) {
      res.status(400).json({ error: "Failed to update setting" });
    }
  });

  // ============================================
  // WISHLIST API
  // ============================================
  
  // Get user's wishlist
  app.get("/api/wishlist", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const items = await storage.getWishlistItems(userId);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch wishlist" });
    }
  });

  // Check if tour is in wishlist
  app.get("/api/wishlist/check/:tourId", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { tourId } = req.params;
      const inWishlist = await storage.isInWishlist(userId, tourId);
      res.json({ inWishlist });
    } catch (error) {
      res.status(500).json({ error: "Failed to check wishlist" });
    }
  });

  // Add to wishlist
  app.post("/api/wishlist", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { tourId } = req.body;
      
      if (!tourId) {
        return res.status(400).json({ error: "Tour ID is required" });
      }
      
      // Check if already in wishlist
      const existing = await storage.getWishlistItem(userId, tourId);
      if (existing) {
        return res.json(existing);
      }
      
      const item = await storage.addToWishlist({ userId, tourId });
      res.status(201).json(item);
    } catch (error) {
      res.status(400).json({ error: "Failed to add to wishlist" });
    }
  });

  // Remove from wishlist
  app.delete("/api/wishlist/:tourId", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { tourId } = req.params;
      await storage.removeFromWishlist(userId, tourId);
      res.json({ message: "Removed from wishlist" });
    } catch (error) {
      res.status(400).json({ error: "Failed to remove from wishlist" });
    }
  });

  // ============================================
  // NEWSLETTER API
  // ============================================
  
  // Get all subscribers (admin only)
  app.get("/api/newsletter/subscribers", requireAdmin, async (req, res) => {
    try {
      const subscribers = await storage.getNewsletterSubscribers();
      res.json(subscribers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch subscribers" });
    }
  });

  // Subscribe to newsletter (public)
  app.post("/api/newsletter/subscribe", async (req, res) => {
    try {
      const { email, name, locale, source } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }
      
      const subscriber = await storage.subscribeNewsletter({ 
        email, 
        name: name || null, 
        locale: locale || 'en',
        source: source || 'website'
      });
      
      res.status(201).json({ message: "Successfully subscribed!", subscriber });
    } catch (error) {
      console.error("Newsletter subscription error:", error);
      res.status(400).json({ error: "Failed to subscribe" });
    }
  });

  // Unsubscribe from newsletter (public with email in body)
  app.post("/api/newsletter/unsubscribe", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      
      await storage.unsubscribeNewsletter(email);
      res.json({ message: "Successfully unsubscribed" });
    } catch (error) {
      res.status(400).json({ error: "Failed to unsubscribe" });
    }
  });

  // ============================================
  // CMS CONTENT API
  // ============================================
  
  // Get all CMS content for a block (public)
  app.get("/api/cms-content/:blockSlug", async (req, res) => {
    try {
      const { blockSlug } = req.params;
      const locale = req.query.locale as string || undefined;
      const content = await storage.getCmsContent(blockSlug, locale);
      res.json(content);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch CMS content" });
    }
  });

  // Get all CMS content (admin)
  app.get("/api/cms-content", requireAdmin, async (req, res) => {
    try {
      // Get content for all blocks
      const blocks = await storage.getContentBlocks();
      const allContent: Record<string, any[]> = {};
      
      for (const block of blocks) {
        allContent[block.slug] = await storage.getCmsContent(block.slug);
      }
      
      res.json(allContent);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch CMS content" });
    }
  });

  // Create CMS content (admin)
  app.post("/api/cms-content", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertCmsContentSchema.parse(req.body);
      const content = await storage.createCmsContent(validatedData);
      res.status(201).json(content);
    } catch (error) {
      console.error("CMS content creation error:", error);
      res.status(400).json({ error: "Failed to create CMS content" });
    }
  });

  // Update CMS content (admin)
  app.patch("/api/cms-content/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getCmsContentItem(id);
      if (!existing) {
        return res.status(404).json({ error: "Content not found" });
      }
      
      const content = await storage.updateCmsContent(id, req.body);
      res.json(content);
    } catch (error) {
      res.status(400).json({ error: "Failed to update CMS content" });
    }
  });

  // Delete CMS content (admin)
  app.delete("/api/cms-content/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getCmsContentItem(id);
      if (!existing) {
        return res.status(404).json({ error: "Content not found" });
      }
      
      await storage.deleteCmsContent(id);
      res.json({ message: "Content deleted successfully" });
    } catch (error) {
      res.status(400).json({ error: "Failed to delete CMS content" });
    }
  });

  registerPaymentRoutes(app, storage);
  await registerRecoveryRoutes(app, storage);

  return httpServer;
}

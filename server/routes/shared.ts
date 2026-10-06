import type { Request, Response, NextFunction } from "express";
import { invalidPersonName, PERSON_NAME_ERROR } from "../../shared/person-name.js";
import { storage } from "../storage.js";
import { requireRole } from "../middleware/role-guard.js";

import multer from "multer";
import path from "path";
import fs from "fs";
import * as cloudinary from "cloudinary";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";

import type { AvailabilityApplicationService } from "../application/availability/availability.application-service.js";
import type { BookingApplicationService } from "../application/booking.application-service.js";

// Security: HTML/XML encoding helpers to prevent XSS in server-rendered templates

export function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
// Rate limiter for availability check
export const availabilityLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // limit each IP to 60 requests per windowMs
  message: { error: "Too many availability checks, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const bookingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many booking attempts, please try again later." },
});

export const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute window
  max: 5,                    // 5 attempts per IP — tight enough to block brute-force, fine for real guests
  message: { error: "Too many verification attempts, please try again in 15 minutes." },
});

export const newsletterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // max 5 subscribe attempts per IP per 15 minutes
  message: { error: "Too many subscription attempts, please try again later." },
});

export const reviewsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // max 3 guest reviews per IP per hour
  message: { error: "Too many review submissions. Please try again later." },
});

export const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // max 5 contact form submissions per IP per hour
  message: { error: "Too many messages sent. Please try again later." },
});

export const holdsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: "Too many hold requests, please try again later." },
});

export const cartPriceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "Too many pricing requests, please try again later." },
});

// C6 Fix: Zod schema for booking creation
export const createBookingItemSchema = z.object({
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

export const createBookingBodySchema = z.object({
  customerName: z.string().min(1, "Name is required").max(100).refine((name) => !invalidPersonName(name), PERSON_NAME_ERROR),
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
export const basePath = path.resolve(process.cwd(), 'attached_assets');
export const uploadDir = path.normalize(path.join(basePath, 'uploads'));
if (!uploadDir.startsWith(basePath)) {
  throw new Error('Invalid upload directory path detected');
}
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer configuration
// MED-4 FIX: Restrict uploads to image MIME types only
export const imageFileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Only images (JPEG, PNG, GIF, WebP, SVG) are allowed.`));
  }
};

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: imageFileFilter,
});

export const uploadMultiple = multer({
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

export const uploadToCloudinaryLegacy = (fileBuffer: Buffer, filename: string): Promise<string> => {
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

// Kept as hoisted function declarations: other route modules import these from
// this file in a circular import, so a `const` export could be read before init.
export const adminGuard = requireRole((id) => storage.getUser(id), ["admin"]);
export const staffGuard = requireRole((id) => storage.getUser(id), ["admin", "field_service"]);

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  return adminGuard(req, res, next);
}

export function requireStaff(req: Request, res: Response, next: NextFunction) {
  return staffGuard(req, res, next);
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

// Service instances and state shared across route modules (created once in routes.ts).
export interface RouteDeps {
  bookingApplicationService: BookingApplicationService;
  availabilityAppService: AvailabilityApplicationService;
  sseClients: Array<{ res: any; userId: string; role: string }>;
}

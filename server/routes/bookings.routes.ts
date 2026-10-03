import type { Express } from "express";
import { storage } from "../storage.js";
import { db } from "../db.js";
import * as schema from "../../shared/schema.js";
import { Booking } from "../../shared/schema.js";
import { AvailabilityApplicationService } from "../application/availability/availability.application-service.js";
import { screenBookingUpdate } from "../lib/booking-update-policy.js";
import { PriceCartService } from "../application/pricing/PriceCartService.js";

import { sendEmail, sendAdminEmail, getBookingStatusUpdateTemplate, shortBookingRef } from "../lib/mail.js";
import { isFeatureEnabled } from "../feature-flags.js";
import { AtomicBookingConfirmationService } from "../application/booking/AtomicBookingConfirmationService.js";
import QRCode from "qrcode";
import { CreateBookingFromCartService } from "../application/booking/CreateBookingFromCartService.js";
import { FraudDetectionService } from "../infrastructure/fraud/FraudDetectionService.js";
import { ZodError } from "zod";

import { bookingLimiter, cartPriceLimiter, createBookingBodySchema, escapeHtml, requireAdmin, requireAuth, requireBookingSession, requireStaff, verifyLimiter, type RouteDeps } from "./shared.js";

export function registerBookingsRoutes(app: Express, deps: RouteDeps) {
  const { bookingApplicationService, sseClients } = deps;

  // Cart Pricing API - Server-side price validation
  const priceCartService = new PriceCartService(storage);
  app.post("/api/cart/price", cartPriceLimiter, async (req, res) => {
    try {
      // Phase 2E: Feature flag controls which pricing system is used
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

      // Note: Both systems currently use PricingEngine internally
      const snapshot = await priceCartService.priceCart(cartId, parsedItems);

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

  // Bookings API
  // Staff (field service) need the list for their daily run sheet.
  app.get("/api/bookings", requireStaff, async (req, res) => {
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
      if (req.session.userRole === "admin") return res.json(enrichedBookings);

      // Drivers/guides don't need fraud review data.
      res.json(enrichedBookings.map(({ fraudScore, fraudLevel, fraudSignals, fraudReviewedAt, fraudReviewedBy, ...rest }) => rest));
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

      // Return both the data URL (for img src) and the raw string
      const dataUrl = await QRCode.toDataURL(qrData, {
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
      // Fresh role from the DB (not the session) so demotions apply immediately.
      const actingUser = await storage.getUser(req.session.userId!);
      if (!actingUser || actingUser.isActive === false) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const actor = actingUser.role === 'admin' ? 'admin'
        : actingUser.role === 'field_service' ? 'staff'
        : existing.userId === actingUser.id ? 'owner'
        : null;
      if (!actor) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Customers may only edit contact/pickup details, field service may only mark
      // trips done; everything else is admin-only (see booking-update-policy.ts).
      const screened = screenBookingUpdate(req.body, actor, existing.status);
      if (!screened.ok) {
        return res.status(400).json({ error: screened.error });
      }
      const updates = screened.updates as any;

      // FIX: Enforce booking status state machine.
      // Only admins reach this with a status (screenBookingUpdate rejects it for customers).
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
            const svc = new AvailabilityApplicationService(storage);
            await svc.releaseHold(existing.holdId).catch(console.error);
          }

          // Release session holds
          if (existing.bookingSessionId) {
            const holds = await storage.getHoldsBySession(existing.bookingSessionId);
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

}

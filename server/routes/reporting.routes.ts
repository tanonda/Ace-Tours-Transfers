import type { Express } from "express";
import { storage } from "../storage.js";
import { PaymentReconciliationService } from "../application/payment-reconciliation.service.js";
import { matchStatement, bookingRef } from "../lib/statement-match.js";
import { afterAdminStatusChange } from "../lib/booking-status-effects.js";
import { confirmWithSeats, SeatsUnavailableError, SEATS_UNAVAILABLE_MESSAGE } from "../lib/manual-confirmation.js";
import { adminAudit } from "../infrastructure/audit/admin-audit-log.service.js";

import { requireAdmin, statementUpload } from "./shared.js";

export function registerReportingRoutes(app: Express) {
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

  // Statement Reconciliation Upload. Never confirms: an amount-column match on a booking reference is
  // a suggestion for an admin to confirm (below); every other reference match needs review.
  app.post("/api/admin/reconciliation/statement", requireAdmin, (req, res, next) => {
    statementUpload.single('statement')(req, res, (err: unknown) => {
      if (err) return res.status(400).json({ error: err instanceof Error ? err.message : "Invalid statement file" });
      next();
    });
  }, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No statement file uploaded" });
      }

      // Pending bookings with an open payment on an offline gateway (bank transfer, cash, ...).
      const pendingOfflineBookings = await storage.getPendingOfflineBookings();

      const result = matchStatement(req.file.buffer.toString('utf-8'), pendingOfflineBookings);
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("[ROUTE] POST /api/admin/reconciliation/statement Error:", error);
      res.status(500).json({ error: "Failed to process statement" });
    }
  });

  // The bookings a statement can match: pending, with an open payment on an offline gateway.
  app.get("/api/admin/statement-matches/candidates", requireAdmin, async (_req, res) => {
    try {
      res.json(await storage.getPendingOfflineBookings());
    } catch (error) {
      console.error("[ROUTE] GET /api/admin/statement-matches/candidates Error:", error);
      res.status(500).json({ error: "Failed to load pending offline bookings" });
    }
  });

  // An admin confirms one suggested statement match. Compare-and-set on the booking's updatedAt as it
  // was when the statement was matched, with its seats reserved in the same transaction; audited,
  // then the admin confirm effects (offline payment completed, guest email).
  app.post("/api/admin/statement-matches/:bookingId/confirm", requireAdmin, async (req, res) => {
    try {
      const expected = typeof req.body?.expectedUpdatedAt === "string" ? new Date(req.body.expectedUpdatedAt) : null;
      if (!expected || Number.isNaN(expected.getTime())) {
        return res.status(400).json({ error: "expectedUpdatedAt is required" });
      }
      const existing = await storage.getBooking(req.params.bookingId);
      if (!existing) return res.status(404).json({ error: "Booking not found" });
      if (existing.status !== "pending") {
        return res.status(409).json({ error: `This booking is '${existing.status}', not pending.` });
      }
      let booking;
      try {
        booking = await confirmWithSeats(storage, existing, (tx) => storage.confirmPendingBookingIfUnchanged(existing.id, expected, tx));
      } catch (err) {
        if (err instanceof SeatsUnavailableError) return res.status(409).json({ error: SEATS_UNAVAILABLE_MESSAGE });
        throw err;
      }
      if (!booking) {
        return res.status(409).json({ error: "This booking changed after the statement was matched. Upload the statement again." });
      }
      const statementAmount = typeof req.body?.statementAmount === "number" ? req.body.statementAmount : null;
      await adminAudit.log({
        action: "booking.statement_confirm",
        entityType: "booking",
        entityId: booking.id,
        entityName: `ACT-${bookingRef(booking.id)}`,
        performedBy: req.session.userId,
        previousValue: { status: existing.status, updatedAt: existing.updatedAt },
        newValue: { status: booking.status },
        metadata: { statementAmount, expectedAmount: existing.totalAmountCents },
        req,
      });
      await afterAdminStatusChange(existing, booking, "confirmed");
      res.json(booking);
    } catch (error) {
      console.error(`[ROUTE] POST /api/admin/statement-matches/${req.params.bookingId}/confirm Error:`, error);
      res.status(500).json({ error: "Failed to confirm the booking" });
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

}

import type { Express } from "express";
import { storage } from "../storage.js";
import { metricsService } from "../infrastructure/metrics/metrics.service.js";

import { requireAdmin } from "./shared.js";

export function registerAdminOpsRoutes(app: Express) {
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

}

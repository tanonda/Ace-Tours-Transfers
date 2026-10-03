import type { Express } from "express";
import { storage } from "../storage.js";
import { PaymentReconciliationService } from "../application/payment-reconciliation.service.js";

import { requireAdmin, upload } from "./shared.js";

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

}

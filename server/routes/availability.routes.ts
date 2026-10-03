import type { Express } from "express";
import { storage } from "../storage.js";

import { CapacityOverviewService } from "../application/admin/capacity-overview.service.js";

import { availabilityLimiter, holdsLimiter, requireAdmin, type RouteDeps } from "./shared.js";

export function registerAvailabilityRoutes(app: Express, deps: RouteDeps) {
  const { bookingApplicationService, availabilityAppService } = deps;

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

  // ── End Fraud Detection Admin Routes ──────────────────────────────────────

  app.get("/api/admin/capacity-summary", requireAdmin, async (req, res) => {
    try {
      const startDate = (req.query.start as string) || new Date().toISOString().split("T")[0];
      const endDate = (req.query.end as string) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

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

}

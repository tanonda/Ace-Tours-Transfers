import type { Express } from "express";
import { IStorage } from "../storage.js";
import { AuditLogService } from "../infrastructure/audit/audit-log.service.js";
import { AdminAuditLogService } from "../infrastructure/audit/admin-audit-log.service.js";
import { metricsService } from "../infrastructure/metrics/metrics.service.js";

/**
 * Admin routes for resources, blackout dates, pricing versions, and audit log.
 * All endpoints are protected by requireAdmin middleware.
 */
export function registerBookingEngineRoutes(
    app: Express,
    storage: IStorage,
    requireAdmin: any
) {
    const auditLog = new AuditLogService(storage);
    const adminAuditLog = new AdminAuditLogService();

    // ─── RESOURCES (Phase 1) ──────────────────────────────────────────

    // List resources for a product
    app.get("/api/admin/resources/:productId", requireAdmin, async (req, res) => {
        try {
            const resources = await storage.getResourcesByProduct(req.params.productId);
            res.json(resources);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Get available resources for a product on a specific date
    app.get("/api/admin/resources/:productId/available", requireAdmin, async (req, res) => {
        try {
            const date = req.query.date as string;
            if (!date) return res.status(400).json({ error: "Missing date query parameter" });
            const available = await storage.getAvailableResources(req.params.productId, date);
            res.json(available);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Create a resource
    app.post("/api/admin/resources", requireAdmin, async (req, res) => {
        try {
            const { productId, name, seatCapacity, status, metadata } = req.body;
            if (!productId || !name || seatCapacity === undefined) {
                return res.status(400).json({ error: "Missing required fields: productId, name, seatCapacity" });
            }
            const resource = await storage.createResource({
                productId,
                name,
                seatCapacity: parseInt(seatCapacity),
                status: status || "active",
                metadata: metadata || null,
            });
            res.status(201).json(resource);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    });

    // Update a resource
    app.put("/api/admin/resources/:id", requireAdmin, async (req, res) => {
        try {
            const { name, seatCapacity, status, metadata } = req.body;
            const updated = await storage.updateResource(req.params.id, {
                ...(name !== undefined && { name }),
                ...(seatCapacity !== undefined && { seatCapacity: parseInt(seatCapacity) }),
                ...(status !== undefined && { status }),
                ...(metadata !== undefined && { metadata }),
            });
            res.json(updated);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    });

    // Delete a resource
    app.delete("/api/admin/resources/:id", requireAdmin, async (req, res) => {
        try {
            await storage.deleteResource(req.params.id);
            res.json({ success: true });
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    });

    // ─── BLACKOUT DATES (Phase 4) ─────────────────────────────────────

    // List blackout dates for a product
    app.get("/api/admin/blackout-dates/:productId", requireAdmin, async (req, res) => {
        try {
            const dates = await storage.getBlackoutDates(req.params.productId);
            res.json(dates);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Check if a specific date is blacked out
    app.get("/api/admin/blackout-dates/:productId/check", requireAdmin, async (req, res) => {
        try {
            const date = req.query.date as string;
            if (!date) return res.status(400).json({ error: "Missing date query parameter" });
            const isBlocked = await storage.isBlackedOut(req.params.productId, date);
            res.json({ isBlackedOut: isBlocked, date });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Create a blackout date
    app.post("/api/admin/blackout-dates", requireAdmin, async (req, res) => {
        try {
            const { productId, date, reason } = req.body;
            if (!productId || !date) {
                return res.status(400).json({ error: "Missing required fields: productId, date" });
            }
            const userId = (req as any).session?.userId;
            const blackout = await storage.createBlackoutDate({
                productId,
                date,
                reason: reason || null,
                createdBy: userId || null,
            });
            res.status(201).json(blackout);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    });

    // Delete a blackout date
    app.delete("/api/admin/blackout-dates/:id", requireAdmin, async (req, res) => {
        try {
            await storage.deleteBlackoutDate(req.params.id);
            res.json({ success: true });
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    });

    // ─── PRICING VERSIONS (Phase 5) ───────────────────────────────────

    // List pricing versions for a product
    app.get("/api/admin/pricing-versions/:productId", requireAdmin, async (req, res) => {
        try {
            const versions = await storage.getPricingVersions(req.params.productId);
            res.json(versions);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Get effective pricing version for a product and date
    app.get("/api/admin/pricing-versions/:productId/effective", requireAdmin, async (req, res) => {
        try {
            const date = req.query.date as string;
            if (!date) return res.status(400).json({ error: "Missing date query parameter" });
            const version = await storage.getEffectivePricingVersion(req.params.productId, date);
            if (!version) {
                return res.status(404).json({ error: "No pricing version found for this date" });
            }
            res.json(version);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Create a pricing version
    app.post("/api/admin/pricing-versions", requireAdmin, async (req, res) => {
        try {
            const { productId, effectiveFrom, adultPriceCents, childPriceCents, ruleMetadata } = req.body;
            if (!productId || !effectiveFrom || adultPriceCents === undefined) {
                return res.status(400).json({ error: "Missing required fields: productId, effectiveFrom, adultPriceCents" });
            }
            const userId = (req as any).session?.userId;
            const version = await storage.createPricingVersion({
                productId,
                effectiveFrom,
                adultPriceCents: parseInt(adultPriceCents),
                childPriceCents: parseInt(childPriceCents || 0),
                ruleMetadata: ruleMetadata || null,
                createdBy: userId || null,
            });
            res.status(201).json(version);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    });

    // ─── CAPACITY AUDIT LOG (Phase 7) ─────────────────────────────────

    // Query capacity audit log (inventory events)
    app.get("/api/admin/audit-log", requireAdmin, async (req, res) => {
        try {
            const { productId, action, limit, offset } = req.query;
            const entries = await auditLog.getLog({
                productId: productId as string,
                action: action as string,
                limit: limit ? parseInt(limit as string) : 100,
                offset: offset ? parseInt(offset as string) : 0,
            });
            res.json(entries);
        } catch (error: any) {
            console.error("[AUDIT LOG ROUTE ERROR]:", error);
            res.status(500).json({ error: error.message });
        }
    });

    // ─── ADMIN ACTION AUDIT LOG ────────────────────────────────────────

    // Query admin action audit log (admin mutations paper trail)
    app.get("/api/admin/admin-audit-log", requireAdmin, async (req, res) => {
        try {
            const { action, entityType, entityId, performedBy, from, to, limit, offset } = req.query;
            const entries = await adminAuditLog.getLog({
                action: action as string | undefined,
                entityType: entityType as string | undefined,
                entityId: entityId as string | undefined,
                performedBy: performedBy as string | undefined,
                from: from as string | undefined,
                to: to as string | undefined,
                limit: limit ? parseInt(limit as string) : 200,
                offset: offset ? parseInt(offset as string) : 0,
            });
            res.json(entries);
        } catch (error: any) {
            console.error("[ADMIN AUDIT LOG ROUTE ERROR]:", error);
            res.status(500).json({ error: error.message });
        }
    });

    // ─── OBSERVABILITY (Phase 8) ──────────────────────────────────────

    // Get system metrics
    app.get("/api/admin/metrics", requireAdmin, async (req, res) => {
        try {
            const metrics = await metricsService.getMetrics();
            res.json(metrics);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Get system alerts
    app.get("/api/admin/alerts", requireAdmin, async (req, res) => {
        try {
            const alerts = await metricsService.getAlerts();
            res.json(alerts);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });
}

// server/infrastructure/audit/admin-audit-log.service.ts

import { db } from "../../db.js";
import { adminAuditLog, type AdminAuditLog, type InsertAdminAuditLog } from "../../../shared/schema.js";
import { eq, desc, and, gte, lte, type SQL } from "drizzle-orm";
import type { Request } from "express";

// Credential-like keys to redact from before/after snapshots
const SENSITIVE_KEYS = new Set([
    "apiKey", "api_key", "secretKey", "secret_key", "merchantSecret",
    "merchant_secret", "password", "token", "accessToken", "access_token",
    "privateKey", "private_key", "webhookSecret", "webhook_secret",
    "clientSecret", "client_secret", "ussdCode",
]);

function redact(obj: unknown): unknown {
    if (!obj || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(redact);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        out[k] = SENSITIVE_KEYS.has(k) ? "[REDACTED]" : redact(v);
    }
    return out;
}

export interface AdminAuditContext {
    action: string;
    entityType: "payment_gateway" | "feature_flag" | "booking" | "site_settings" | "tour" | "system" | "user";
    entityId?: string;
    entityName?: string;
    performedBy?: string;  // userId
    previousValue?: unknown;
    newValue?: unknown;
    metadata?: Record<string, unknown>;
    req?: Request;  // used to capture IP + User-Agent
}

export class AdminAuditLogService {
    async log(ctx: AdminAuditContext): Promise<void> {
        try {
            const entry: InsertAdminAuditLog = {
                action: ctx.action,
                entityType: ctx.entityType,
                entityId: ctx.entityId ?? null,
                entityName: ctx.entityName ?? null,
                performedBy: ctx.performedBy ?? null,
                previousValue: ctx.previousValue != null ? redact(ctx.previousValue) as any : null,
                newValue: ctx.newValue != null ? redact(ctx.newValue) as any : null,
                ipAddress: ctx.req
                    ? (ctx.req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
                    ?? ctx.req.socket?.remoteAddress ?? null
                    : null,
                userAgent: ctx.req ? (ctx.req.headers["user-agent"] ?? null) : null,
                metadata: ctx.metadata ?? null,
            };
            await db.insert(adminAuditLog).values(entry);
        } catch (err) {
            // Audit logging must never break the critical path
            console.error("[ADMIN_AUDIT] Failed to write entry:", err);
        }
    }

    async getLog(filters?: {
        action?: string;
        entityType?: string;
        entityId?: string;
        performedBy?: string;
        from?: string;     // ISO date string
        to?: string;       // ISO date string
        limit?: number;
        offset?: number;
    }): Promise<AdminAuditLog[]> {
        const conditions: SQL[] = [];

        if (filters?.action) conditions.push(eq(adminAuditLog.action, filters.action));
        if (filters?.entityType) conditions.push(eq(adminAuditLog.entityType, filters.entityType));
        if (filters?.entityId) conditions.push(eq(adminAuditLog.entityId, filters.entityId));
        if (filters?.performedBy) conditions.push(eq(adminAuditLog.performedBy, filters.performedBy));
        if (filters?.from) conditions.push(gte(adminAuditLog.createdAt, new Date(filters.from)));
        if (filters?.to) conditions.push(lte(adminAuditLog.createdAt, new Date(filters.to)));

        return db
            .select()
            .from(adminAuditLog)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(adminAuditLog.createdAt))
            .limit(filters?.limit ?? 200)
            .offset(filters?.offset ?? 0);
    }
}

// Singleton — import this everywhere you want to log admin actions
export const adminAudit = new AdminAuditLogService();

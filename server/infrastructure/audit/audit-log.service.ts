import { IStorage } from "../../storage.js";
import type { CapacityAuditLog, InsertCapacityAuditLog } from "../../../shared/schema.js";

export type AuditAction =
    | "hold_created"
    | "hold_expired"
    | "hold_released"
    | "booking_confirmed"
    | "booking_cancelled"
    | "manual_adjustment";

export interface AuditContext {
    tourInstanceId?: string;
    productId: string;
    action: AuditAction;
    quantity?: number;
    previousState?: { confirmedCount: number; heldCount: number; blockedCount: number };
    newState?: { confirmedCount: number; heldCount: number; blockedCount: number };
    performedBy?: string; // userId or 'system'
    metadata?: Record<string, unknown>;
}

export class AuditLogService {
    constructor(private storage: IStorage) { }

    async log(ctx: AuditContext, tx?: any): Promise<CapacityAuditLog> {
        const entry: InsertCapacityAuditLog = {
            tourInstanceId: ctx.tourInstanceId ?? null,
            productId: ctx.productId,
            action: ctx.action,
            quantity: ctx.quantity ?? null,
            previousState: ctx.previousState ?? null,
            newState: ctx.newState ?? null,
            performedBy: ctx.performedBy ?? "system",
            metadata: ctx.metadata ?? null,
        };

        try {
            return await this.storage.createAuditLogEntry(entry, tx);
        } catch (error) {
            // Audit logging should never break the critical path
            console.error("[AUDIT] Failed to write audit log entry:", error);
            return entry as CapacityAuditLog;
        }
    }

    async getLog(filters?: {
        productId?: string;
        action?: string;
        limit?: number;
        offset?: number;
    }): Promise<CapacityAuditLog[]> {
        return await this.storage.getAuditLog(filters);
    }
}

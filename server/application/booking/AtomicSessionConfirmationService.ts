/**
 * AtomicSessionConfirmationService - PHASE 4: SESSION-LEVEL ATOMICITY
 * 
 * Ensures that multi-item bookings (from a single session) are confirmed
 * as a single atomic unit. If any item in the session fails to confirm
 * (e.g., due to expired hold or capacity mismatch), the ENTIRE session
 * confirmation rolls back.
 * 
 * Guarantees:
 * ✅ Transactional: All session bookings commit together or rollback together
 * ✅ Isolated: Serializable/Locking prevents race conditions across items
 * ✅ Consistency: Cross-checks all holds before committing any
 */

import { IStorage } from "../../storage.js";
import { db } from "../../db.js";
import { Booking, TourInstance, AvailabilityHold } from "../../../shared/schema.js";
import {
    bookings,
    availabilityHolds,
    tourInstances,
} from "../../../shared/schema.js";
import { eq, and, inArray } from "drizzle-orm";
import { AuditLogService } from "../../infrastructure/audit/audit-log.service.js";
import { metricsService } from "../../infrastructure/metrics/metrics.service.js";
import { ConfirmationErrorCode } from "./AtomicBookingConfirmationService.js";

export interface SessionConfirmationRequest {
    sessionId: string;
    paymentId: string;
    gatewayReference?: string;
}

export interface SessionConfirmationResult {
    success: boolean;
    message: string;
    sessionConfirmed: boolean;
    bookingIds: string[];
    error?: {
        code: string;
        reason: string;
        details?: string;
    };
}

export class AtomicSessionConfirmationService {
    private auditLog: AuditLogService;

    constructor(private storage: IStorage) {
        this.auditLog = new AuditLogService(storage);
    }

    /**
     * Confirms ALL bookings in a session atomically.
     */
    async confirmSessionAtomically(
        request: SessionConfirmationRequest
    ): Promise<SessionConfirmationResult> {
        const startTime = Date.now();
        const { sessionId, paymentId } = request;

        console.log(`[SESSION_CONFIRM] Starting atomic confirmation for session ${sessionId}`);

        try {
            return await db.transaction(async (tx: any) => {
                // 1. Load and lock all bookings in this session
                const sessionBookings = await tx
                    .select()
                    .from(bookings)
                    .where(eq(bookings.bookingSessionId, sessionId))
                    .for('update');

                if (sessionBookings.length === 0) {
                    metricsService.incrementSessionFailure("SESSION_EMPTY");
                    metricsService.recordErrorSnippet("SESSION_EMPTY", `No bookings found for session ${sessionId}`);
                    return {
                        success: false,
                        sessionConfirmed: false,
                        bookingIds: [],
                        message: "No bookings found for session",
                        error: { code: "SESSION_EMPTY", reason: "Found 0 bookings for session ID" }
                    };
                }

                const bookingIds = sessionBookings.map((b: any) => b.id);

                // Filter out already confirmed bookings (idempotency)
                const pendingBookings = sessionBookings.filter((b: any) => b.status === 'pending');
                if (pendingBookings.length === 0) {
                    return {
                        success: true,
                        sessionConfirmed: true,
                        bookingIds,
                        message: "All bookings in session already confirmed"
                    };
                }

                // 2. Load and lock all holds for these bookings
                const holdIds = sessionBookings
                    .map((b: any) => b.holdId)
                    .filter(Boolean) as string[];

                // Also get any other active holds for this session not directly linked to holdId field
                const sessionHoldRows = await tx
                    .select()
                    .from(availabilityHolds)
                    .where(eq(availabilityHolds.bookingSessionId, sessionId))
                    .for('update');

                const allHolds: AvailabilityHold[] = sessionHoldRows;

                // 3. Verify all holds are active
                const now = new Date();
                for (const hold of allHolds) {
                    if (hold.status !== 'ACTIVE' && hold.status !== 'CONFIRMED') {
                        throw new Error(`Inconsistent session: Hold ${hold.id} is in state ${hold.status}`);
                    }
                    if (hold.status === 'ACTIVE' && hold.expiresAt < now) {
                        throw new Error(`Inconsistent session: Hold ${hold.id} has expired`);
                    }
                }

                // 4. Group holds by TourInstance to lock instances
                const instanceIds = Array.from(new Set(allHolds.map(h => h.tourInstanceId)));
                if (instanceIds.length > 0) {
                    const instances = await tx
                        .select()
                        .from(tourInstances)
                        .where(inArray(tourInstances.id, instanceIds))
                        .for('update');

                    const typedInstances = instances as unknown as TourInstance[];

                    // Map for quick lookup
                    const instanceMap = new Map<string, TourInstance>(typedInstances.map(i => [i.id, i]));

                    // 5. Update each instance and each hold
                    for (const instanceId of instanceIds) {
                        const instance = instanceMap.get(instanceId);
                        if (!instance) throw new Error(`TourInstance ${instanceId} not found`);

                        const holdsForThisInstance = allHolds.filter(h => h.tourInstanceId === instanceId && h.status === 'ACTIVE');
                        const totalConfirming = holdsForThisInstance.reduce((sum, h) => sum + h.quantity, 0);

                        if (totalConfirming > 0) {
                            // Check capacity
                            if (instance.confirmedCount + totalConfirming + instance.blockedCount > instance.totalCapacity) {
                                throw new Error(`Capacity exceeded for instance ${instanceId}`);
                            }

                            // Update counts
                            await tx
                                .update(tourInstances)
                                .set({
                                    confirmedCount: instance.confirmedCount + totalConfirming,
                                    heldCount: Math.max(0, instance.heldCount - totalConfirming),
                                    updatedAt: new Date()
                                })
                                .where(eq(tourInstances.id, instanceId));
                        }
                    }
                }

                // 6. Finalize holds and bookings
                for (const hold of allHolds) {
                    if (hold.status === 'ACTIVE') {
                        await tx
                            .update(availabilityHolds)
                            .set({ status: 'CONFIRMED', confirmedAt: new Date() })
                            .where(eq(availabilityHolds.id, hold.id));
                    }
                }

                for (const booking of pendingBookings) {
                    await tx
                        .update(bookings)
                        .set({
                            status: 'confirmed',
                            paymentReference: paymentId,
                            confirmedAt: new Date(),
                            updatedAt: new Date()
                        })
                        .where(eq(bookings.id, booking.id));

                    // Audit Log per booking
                    await this.auditLog.log({
                        tourInstanceId: booking.tourInstanceId || (allHolds.find(h => h.tourInstanceId)?.tourInstanceId),
                        productId: booking.tourId,
                        action: 'booking_confirmed',
                        metadata: {
                            bookingId: booking.id,
                            sessionId,
                            paymentId,
                            atomicSession: true
                        }
                    }, tx);
                }

                const elapsedMs = Date.now() - startTime;
                metricsService.recordSessionLatency(elapsedMs);
                metricsService.incrementSessionSuccess();
                console.log(`[SESSION_CONFIRM] ✅ Session ${sessionId} confirmed successfully (${bookingIds.length} bookings) in ${elapsedMs}ms`);

                return {
                    success: true,
                    sessionConfirmed: true,
                    bookingIds,
                    message: "All bookings in session confirmed atomically"
                };
            });

        } catch (error) {
            const elapsedMs = Date.now() - startTime;
            console.error(`[SESSION_CONFIRM] ❌ Atomic session confirmation failed for ${sessionId} after ${elapsedMs}ms:`, error);

            const errorMessage = error instanceof Error ? error.message : "Internal error";
            const errorCode = (error as any).code || "SESSION_TRANSACTION_FAILED";

            metricsService.incrementSessionFailure(errorCode);
            metricsService.recordErrorSnippet(errorCode, errorMessage);
            metricsService.recordSessionLatency(elapsedMs);

            return {
                success: false,
                sessionConfirmed: false,
                bookingIds: [],
                message: "Failed to confirm session atomically",
                error: {
                    code: "SESSION_TRANSACTION_FAILED",
                    reason: error instanceof Error ? error.message : "Internal error",
                    details: String(error)
                }
            };
        }
    }
}

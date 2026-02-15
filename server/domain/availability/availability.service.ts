import { IStorage } from "../../storage.js";
import {
  TourInstance,
  AvailabilityHold,
  InsertTourInstance,
  InsertAvailabilityHold,
  tourInstances,
  tours,
  availabilityHolds,
  bookings,
  resources
} from "../../../shared/schema.js";
import { db } from "../../db.js";
import { eq, and, sql } from "drizzle-orm";
import { availabilityCache } from "../../infrastructure/cache/availability-cache.service.js";
import { AuditLogService } from "../../infrastructure/audit/audit-log.service.js";
import { TimeInterval, intervalsOverlap, getDefaultInterval } from "./time-interval.js";
import { metricsService } from "../../infrastructure/metrics/metrics.service.js";

export enum HoldStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CONFIRMED = 'CONFIRMED',
  RELEASED = 'RELEASED'
}

export class AvailabilityService {
  private storage: IStorage;
  private auditLog: AuditLogService;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.auditLog = new AuditLogService(storage);
  }

  /**
   * Checks availability for a given tour and date.
   * Phase 2: Refactored to handle multiple sessions per day via overlap detection.
   * Note: This is ADVISORY and not authoritative.
   */
  async checkAvailability(tourId: string, date: string, slot?: string, startTime?: string, endTime?: string): Promise<number> {
    const product = await this.storage.getTour(tourId);
    if (!product) return 0;

    const requestedInterval = getDefaultInterval(product.category, startTime, endTime);

    // Fetch all instances for this product on this date
    const allInstances = await this.storage.getTourInstances(tourId, date);

    // Find instances that overlap with the requested interval
    const overlappingInstances = allInstances.filter(instance => {
      if (slot && instance.timeSlot === slot) return true;
      const instanceInterval: TimeInterval = { startTime: instance.startTime, endTime: instance.endTime };
      return intervalsOverlap(requestedInterval, instanceInterval);
    });

    if (overlappingInstances.length === 0) {
      return product.defaultCapacity || 0;
    }

    // Minimum remaining capacity across all overlapping pools
    let minAvailable = Infinity;
    for (const instance of overlappingInstances) {
      const available = instance.totalCapacity - (instance.confirmedCount + instance.heldCount + instance.blockedCount);
      if (available < minAvailable) minAvailable = available;
    }

    return minAvailable === Infinity ? 0 : Math.max(0, minAvailable);
  }

  /**
   * Creates a mandatory hold for N seats.
   * Atomically locks the inventory record.
   */
  async createHold(
    tourId: string,
    date: string,
    quantity: number,
    sessionId: string,
    slot?: string,
    ttlMinutes: number = 15,
    startTime?: string,
    endTime?: string,
    pinnedResourceId?: string, // Phase 1: Support pinning a resource for multi-day consistency
    tx?: any // Phase 4: Allow passing transactional context
  ): Promise<AvailabilityHold> {
    // Phase 4: Check blackout dates (applies to all product types: tours, transfers, vehicles)
    const isBlacked = await this.storage.isBlackedOut(tourId, date);
    if (isBlacked) {
      throw new Error(`This date (${date}) is not available for bookings (blackout period).`);
    }

    // Phase 1: Determine if this is a vehicle (asset-allocated) product
    const product = await this.storage.getTour(tourId);
    if (!product) throw new Error(`Product ${tourId} not found`);
    const isVehicle = product.category === 'vehicle';

    const runInTransaction = async (transaction: any) => {
      // 1. Get or Create TourInstance with LOCK
      let instance = await this.getOrCreateInstanceLocked(transaction, tourId, date, slot, startTime, endTime);

      const previousState = {
        confirmedCount: instance.confirmedCount,
        heldCount: instance.heldCount,
        blockedCount: instance.blockedCount,
      };

      // 2. Validate Capacity
      const available = instance.totalCapacity - (instance.confirmedCount + instance.heldCount + instance.blockedCount);
      if (available < quantity) {
        throw new Error(`Insufficient availability. Requested ${quantity}, available ${available}`);
      }

      // Phase 1: Resource allocation for vehicles
      let resourceId: string | null = pinnedResourceId || null;
      if (isVehicle) {
        if (resourceId) {
          // Verify pinned resource is actually available on this date (locked within instance tx)
          const isHeld = await transaction
            .select()
            .from(availabilityHolds)
            .where(and(
              eq(availabilityHolds.tourInstanceId, instance.id),
              eq(availabilityHolds.resourceId, resourceId),
              sql`status IN ('ACTIVE', 'CONFIRMED')`
            ))
            .limit(1);

          if (isHeld.length > 0) {
            throw new Error(`Vehicle ${resourceId} is already reserved for ${date}`);
          }
        } else {
          const availableResources = await this.storage.getAvailableResources(tourId, date, startTime, endTime);
          if (availableResources.length === 0) {
            throw new Error(
              `No available ${product.title} units for ${date} during ${startTime || '00:00'}-${endTime || '23:59'}. All vehicles are currently reserved.`
            );
          }
          // Allocate first available resource
          resourceId = availableResources[0].id;
        }
      }

      // 3. Update held count using atomic increment
      await transaction
        .update(tourInstances)
        .set({
          heldCount: sql`${tourInstances.heldCount} + ${quantity}`,
          updatedAt: new Date()
        })
        .where(eq(tourInstances.id, instance.id));

      // 4. Create Hold record (with optional resourceId for vehicles)
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + ttlMinutes);

      const holdValues: any = {
        tourInstanceId: instance.id,
        quantity,
        status: HoldStatus.ACTIVE,
        expiresAt,
        bookingSessionId: sessionId,
      };
      if (resourceId) {
        holdValues.resourceId = resourceId;
      }

      const [hold] = await transaction
        .insert(availabilityHolds)
        .values(holdValues)
        .returning();

      // Phase 7: Audit log
      await this.auditLog.log({
        tourInstanceId: instance.id,
        productId: tourId,
        action: 'hold_created',
        quantity,
        previousState,
        newState: {
          confirmedCount: instance.confirmedCount,
          heldCount: instance.heldCount + quantity,
          blockedCount: instance.blockedCount,
        },
        metadata: {
          holdId: hold.id,
          sessionId,
          slot,
          resourceId,
          productCategory: product.category,
          expiresAt: expiresAt.toISOString(),
        },
      }, transaction);

      // Phase 8: Metrics
      metricsService.incrementHoldCreation();

      return hold;
    };

    if (tx) {
      return await runInTransaction(tx);
    } else {
      return await db.transaction(runInTransaction);
    }
  }

  /**
   * CRITICAL: Invalidate cache after creating a hold
   */
  async createHoldWithInvalidation(params: {
    tourId: string;
    date: string;
    slot?: string;
    quantity: number;
    sessionId: string;
    ttlMinutes?: number;
    startTime?: string;
    endTime?: string;
    pinnedResourceId?: string;
    tx?: any;
  }): Promise<AvailabilityHold> {
    const hold = await this.createHold(
      params.tourId,
      params.date,
      params.quantity,
      params.sessionId,
      params.slot,
      params.ttlMinutes,
      params.startTime,
      params.endTime,
      params.pinnedResourceId,
      params.tx
    );

    // Invalidate cache for this tour instance
    availabilityCache.invalidate(params.tourId, params.date, params.slot);

    return hold;
  }

  /**
   * Confirms a hold (converts to confirmed booking count).
   */
  async confirmBooking(holdId: string, tx?: any): Promise<void> {
    const runInTransaction = async (transaction: any) => {
      // 1. Lock Hold
      const [hold] = await transaction
        .select()
        .from(availabilityHolds)
        .where(eq(availabilityHolds.id, holdId))
        .for('update');

      if (!hold) throw new Error("Hold not found");

      // Phase 6: Idempotent confirmation — if already confirmed, return silently
      if (hold.status === HoldStatus.CONFIRMED) {
        return;
      }
      if (hold.status !== HoldStatus.ACTIVE) {
        throw new Error(`Cannot confirm hold in status: ${hold.status}`);
      }

      const [instanceCode] = await transaction
        .select()
        .from(tourInstances)
        .where(eq(tourInstances.id, hold.tourInstanceId))
        .for('update');

      const instance = instanceCode; // Renamed from instance to avoid confusion if needed, but keeping logic

      const previousState = {
        confirmedCount: instance.confirmedCount,
        heldCount: instance.heldCount,
        blockedCount: instance.blockedCount,
      };

      const newHeldCount = Math.max(0, instance.heldCount - hold.quantity);
      const newConfirmedCount = instance.confirmedCount + hold.quantity;

      // 3. Transition counts atomically
      await transaction
        .update(tourInstances)
        .set({
          heldCount: sql`GREATEST(0, ${tourInstances.heldCount} - ${hold.quantity})`,
          confirmedCount: sql`${tourInstances.confirmedCount} + ${hold.quantity}`,
          updatedAt: new Date()
        })
        .where(eq(tourInstances.id, instance.id));

      // 4. Update Hold status
      await transaction
        .update(availabilityHolds)
        .set({ status: HoldStatus.CONFIRMED })
        .where(eq(availabilityHolds.id, holdId));

      // Phase 7: Audit log
      await this.auditLog.log({
        tourInstanceId: instance.id,
        productId: instance.tourId,
        action: 'booking_confirmed',
        quantity: hold.quantity,
        previousState,
        newState: {
          confirmedCount: newConfirmedCount,
          heldCount: newHeldCount,
          blockedCount: instance.blockedCount,
        },
        metadata: { holdId, resourceId: hold.resourceId },
      }, transaction);

      // Phase 8: Metrics
      metricsService.incrementHoldConfirmation();
    };

    if (tx) {
      await runInTransaction(tx);
    } else {
      await db.transaction(runInTransaction);
    }

    // CRITICAL: Invalidate cache after confirming booking
    const [holdData] = await db
      .select({
        tourInstanceId: availabilityHolds.tourInstanceId,
      })
      .from(availabilityHolds)
      .where(eq(availabilityHolds.id, holdId));

    if (holdData) {
      const [instanceData] = await db
        .select({
          tourId: tourInstances.tourId,
          serviceDate: tourInstances.serviceDate,
          timeSlot: tourInstances.timeSlot,
        })
        .from(tourInstances)
        .where(eq(tourInstances.id, holdData.tourInstanceId));

      if (instanceData) {
        availabilityCache.invalidate(
          instanceData.tourId,
          instanceData.serviceDate,
          instanceData.timeSlot || undefined
        );
      }
    }
  }

  /**
   * Confirms all active holds for a given session.
   */
  async confirmHoldsBySession(sessionId: string): Promise<void> {
    await db.transaction(async (tx: any) => {
      // 1. Get all active holds for session with LOCK
      const sessionHolds = await tx
        .select()
        .from(availabilityHolds)
        .where(and(
          eq(availabilityHolds.bookingSessionId, sessionId),
          eq(availabilityHolds.status, HoldStatus.ACTIVE)
        ))
        .for('update');

      for (const hold of sessionHolds) {
        // 2. Lock Instance
        const [instance] = await tx
          .select()
          .from(tourInstances)
          .where(eq(tourInstances.id, hold.tourInstanceId))
          .for('update');

        if (instance) {
          // 3. Transition counts
          await tx
            .update(tourInstances)
            .set({
              heldCount: Math.max(0, instance.heldCount - hold.quantity),
              confirmedCount: instance.confirmedCount + hold.quantity
            })
            .where(eq(tourInstances.id, instance.id));
        }

        // 4. Update Hold status
        await tx
          .update(availabilityHolds)
          .set({ status: HoldStatus.CONFIRMED })
          .where(eq(availabilityHolds.id, hold.id));
      }
    });
  }

  /**
   * Releases a hold (manual cancellation or expiry).
   */
  async releaseHold(holdId: string, status: HoldStatus = HoldStatus.RELEASED): Promise<void> {
    await db.transaction(async (tx: any) => {
      const [hold] = await tx
        .select()
        .from(availabilityHolds)
        .where(eq(availabilityHolds.id, holdId))
        .for('update');

      if (!hold || hold.status !== HoldStatus.ACTIVE) return;

      const [instance] = await tx
        .select()
        .from(tourInstances)
        .where(eq(tourInstances.id, hold.tourInstanceId))
        .for('update');

      if (instance) {
        const previousState = {
          confirmedCount: instance.confirmedCount,
          heldCount: instance.heldCount,
          blockedCount: instance.blockedCount,
        };
        const newHeldCount = Math.max(0, instance.heldCount - hold.quantity);

        await tx
          .update(tourInstances)
          .set({ heldCount: newHeldCount })
          .where(eq(tourInstances.id, instance.id));

        // Phase 7: Audit log
        const action = status === HoldStatus.EXPIRED ? 'hold_expired' : 'hold_released';
        await this.auditLog.log({
          tourInstanceId: instance.id,
          productId: instance.tourId,
          action,
          quantity: hold.quantity,
          previousState,
          newState: {
            confirmedCount: instance.confirmedCount,
            heldCount: newHeldCount,
            blockedCount: instance.blockedCount,
          },
          metadata: { holdId, resourceId: hold.resourceId },
        }, tx);

        // Phase 8: Metrics
        if (status === HoldStatus.EXPIRED) {
          metricsService.incrementHoldExpiration();
        }
      }

      await tx
        .update(availabilityHolds)
        .set({ status })
        .where(eq(availabilityHolds.id, holdId));
    });
  }

  /**
   * Admin capacity override.
   */
  async adminOverride(instanceId: string, update: { totalCapacity?: number; blockedCount?: number }): Promise<TourInstance> {
    return await db.transaction(async (tx: any) => {
      const [instance] = await tx
        .select()
        .from(tourInstances)
        .where(eq(tourInstances.id, instanceId))
        .for('update');

      if (!instance) throw new Error("Instance not found");

      const previousState = {
        confirmedCount: instance.confirmedCount,
        heldCount: instance.heldCount,
        blockedCount: instance.blockedCount,
      };

      const newTotalCapacity = update.totalCapacity ?? instance.totalCapacity;
      const newBlockedCount = update.blockedCount ?? instance.blockedCount;

      const [updated] = await tx
        .update(tourInstances)
        .set({
          totalCapacity: newTotalCapacity,
          blockedCount: newBlockedCount,
          updatedAt: new Date()
        })
        .where(eq(tourInstances.id, instanceId))
        .returning();

      // Phase 7: Audit log
      await this.auditLog.log({
        tourInstanceId: instanceId,
        productId: instance.tourId,
        action: 'manual_adjustment',
        previousState,
        newState: {
          confirmedCount: instance.confirmedCount,
          heldCount: instance.heldCount,
          blockedCount: newBlockedCount,
        },
        metadata: {
          totalCapacityChange: update.totalCapacity !== undefined ? { from: instance.totalCapacity, to: newTotalCapacity } : undefined,
          blockedCountChange: update.blockedCount !== undefined ? { from: instance.blockedCount, to: newBlockedCount } : undefined,
        },
      }, tx);

      return updated;
    });
  }

  private async getOrCreateInstanceLocked(
    tx: any,
    tourId: string,
    date: string,
    slot?: string,
    startTime?: string,
    endTime?: string
  ): Promise<TourInstance> {
    // Build a selector that accounts for slot OR start/end times.
    let query = tx.select().from(tourInstances);
    if (slot) {
      query = query.where(and(eq(tourInstances.tourId, tourId), eq(tourInstances.serviceDate, date), eq(tourInstances.timeSlot, slot)));
    } else if (startTime !== undefined || endTime !== undefined) {
      // Match exact start/end pair (both nulls treated as null)
      query = query.where(and(
        eq(tourInstances.tourId, tourId),
        eq(tourInstances.serviceDate, date),
        (startTime ? eq(tourInstances.startTime, startTime) : sql`${tourInstances.startTime} IS NULL`),
        (endTime ? eq(tourInstances.endTime, endTime) : sql`${tourInstances.endTime} IS NULL`)
      ));
    } else {
      // Legacy behavior: timeSlot IS NULL and start/end null
      query = query.where(and(eq(tourInstances.tourId, tourId), eq(tourInstances.serviceDate, date), sql`time_slot IS NULL`));
    }

    const [existing] = await query.for('update');
    if (existing) return existing;

    // Create if not exists (Double checked lock pattern within transaction)
    // Note: Concurrency might cause insert conflict if not careful, 
    // but the unique index on (tour_id, date, slot) will guard us.
    try {
      // Fetch the tour template to get default capacity
      const [tour] = await tx.select().from(tours).where(eq(tours.id, tourId));

      // CRITICAL: Capacity must be explicitly configured - no silent defaults
      if (!tour) {
        throw new Error(`Tour ${tourId} not found - cannot create tour instance`);
      }

      if (tour.defaultCapacity === null || tour.defaultCapacity === undefined || tour.defaultCapacity <= 0) {
        throw new Error(
          `Tour "${tour.title}" (${tourId}) has no default capacity configured. ` +
          `Please set a valid capacity value in the admin panel before bookings can be made.`
        );
      }

      const capacity = tour.defaultCapacity;

      const [created] = await tx
        .insert(tourInstances)
        .values({
          tourId,
          serviceDate: date,
          timeSlot: slot || null,
          totalCapacity: capacity,
          startTime: startTime ?? null,
          endTime: endTime ?? null,
        })
        .returning();

      // Re-lock the newly created record to be consistent
      const [locked] = await tx.select().from(tourInstances).where(eq(tourInstances.id, created.id)).for('update');
      return locked;
    } catch (e) {
      // If someone else inserted it between our check and insert, query it again
      // Another transaction may have created the instance; re-query using same matching rules
      let retryQuery = tx.select().from(tourInstances);
      if (slot) {
        retryQuery = retryQuery.where(and(eq(tourInstances.tourId, tourId), eq(tourInstances.serviceDate, date), eq(tourInstances.timeSlot, slot)));
      } else if (startTime !== undefined || endTime !== undefined) {
        retryQuery = retryQuery.where(and(
          eq(tourInstances.tourId, tourId),
          eq(tourInstances.serviceDate, date),
          (startTime ? eq(tourInstances.startTime, startTime) : sql`${tourInstances.startTime} IS NULL`),
          (endTime ? eq(tourInstances.endTime, endTime) : sql`${tourInstances.endTime} IS NULL`)
        ));
      } else {
        retryQuery = retryQuery.where(and(eq(tourInstances.tourId, tourId), eq(tourInstances.serviceDate, date), sql`time_slot IS NULL`));
      }
      const [retry] = await retryQuery.for('update');
      if (retry) return retry;
      throw e;
    }
  }
}

import { IStorage } from "../../storage.js";
import { 
  TourInstance, 
  AvailabilityHold, 
  InsertTourInstance, 
  InsertAvailabilityHold,
  tourInstances,
  tours, // Added tours import
  availabilityHolds,
  bookings
} from "../../../shared/schema.js";
import { db } from "../../db.js";
import { eq, and, sql } from "drizzle-orm";

export enum HoldStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CONFIRMED = 'CONFIRMED',
  RELEASED = 'RELEASED'
}

export class AvailabilityService {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Checks availability for a given tour and date.
   * Note: This is ADVISORY and not authoritative.
   */
  async checkAvailability(tourId: string, date: string, slot?: string): Promise<number> {
    const instance = await this.storage.getTourInstance(tourId, date, slot);
    if (!instance) {
      // If no instance exists, we might return total capacity if we have a default for the tour,
      // but for now let's assume instances are pre-created or lazy-created with a default.
      // Re-evaluating: Admin should setup capacity. If not setup, default to 0 or a tour default.
      const tour = await this.storage.getTour(tourId);
      if (!tour) return 0;
      return 0; // Require admin to set capacity for production safety? 
                 // Or we could have a default_capacity on Tour.
    }

    return instance.totalCapacity - (instance.confirmedCount + instance.heldCount + instance.blockedCount);
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
    ttlMinutes: number = 15
  ): Promise<AvailabilityHold> {
    return await db.transaction(async (tx: any) => {
      // 1. Get or Create TourInstance with LOCK
      let instance = await this.getOrCreateInstanceLocked(tx, tourId, date, slot);

      // 2. Validate Capacity
      const available = instance.totalCapacity - (instance.confirmedCount + instance.heldCount + instance.blockedCount);
      if (available < quantity) {
        throw new Error(`Insufficient availability. Requested ${quantity}, available ${available}`);
      }

      // 3. Update held count
      await tx
        .update(tourInstances)
        .set({ heldCount: instance.heldCount + quantity })
        .where(eq(tourInstances.id, instance.id));

      // 4. Create Hold record
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + ttlMinutes);

      const [hold] = await tx
        .insert(availabilityHolds)
        .values({
          tourInstanceId: instance.id,
          quantity,
          status: HoldStatus.ACTIVE,
          expiresAt,
          bookingSessionId: sessionId
        })
        .returning();

      return hold;
    });
  }

  /**
   * Confirms a hold (converts to confirmed booking count).
   */
  async confirmBooking(holdId: string): Promise<void> {
    await db.transaction(async (tx: any) => {
      // 1. Lock Hold
      const [hold] = await tx
        .select()
        .from(availabilityHolds)
        .where(eq(availabilityHolds.id, holdId))
        .for('update');

      if (!hold) throw new Error("Hold not found");
      if (hold.status !== HoldStatus.ACTIVE) {
        throw new Error(`Cannot confirm hold in status: ${hold.status}`);
      }

      // 2. Lock Instance
      const [instance] = await tx
        .select()
        .from(tourInstances)
        .where(eq(tourInstances.id, hold.tourInstanceId))
        .for('update');

      // 3. Transition counts
      await tx
        .update(tourInstances)
        .set({ 
          heldCount: Math.max(0, instance.heldCount - hold.quantity),
          confirmedCount: instance.confirmedCount + hold.quantity
        })
        .where(eq(tourInstances.id, instance.id));

      // 4. Update Hold status
      await tx
        .update(availabilityHolds)
        .set({ status: HoldStatus.CONFIRMED })
        .where(eq(availabilityHolds.id, holdId));
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
        await tx
          .update(tourInstances)
          .set({ heldCount: Math.max(0, instance.heldCount - hold.quantity) })
          .where(eq(tourInstances.id, instance.id));
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

      const [updated] = await tx
        .update(tourInstances)
        .set({
          totalCapacity: update.totalCapacity ?? instance.totalCapacity,
          blockedCount: update.blockedCount ?? instance.blockedCount,
          updatedAt: new Date()
        })
        .where(eq(tourInstances.id, instanceId))
        .returning();

      return updated;
    });
  }

  private async getOrCreateInstanceLocked(tx: any, tourId: string, date: string, slot?: string): Promise<TourInstance> {
    let filters = [eq(tourInstances.tourId, tourId), eq(tourInstances.serviceDate, date)];
    if (slot) {
      filters.push(eq(tourInstances.timeSlot, slot));
    } else {
      // In Drizzle, we often use isNull for nullable fields if we want exact match
      // but for simplicity in this schema let's check null
      // sql`${tourInstances.timeSlot} IS NULL`
    }

    // Attempt to lock existing
    let query = tx.select().from(tourInstances);
    if (slot) {
      query = query.where(and(eq(tourInstances.tourId, tourId), eq(tourInstances.serviceDate, date), eq(tourInstances.timeSlot, slot)));
    } else {
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
      const capacity = tour?.defaultCapacity ?? 20;

      const [created] = await tx
        .insert(tourInstances)
        .values({
          tourId,
          serviceDate: date,
          timeSlot: slot || null,
          totalCapacity: capacity,
        })
        .returning();
      
      // Re-lock the newly created record to be consistent
      const [locked] = await tx.select().from(tourInstances).where(eq(tourInstances.id, created.id)).for('update');
      return locked;
    } catch (e) {
      // If someone else inserted it between our check and insert, query it again
      const [retry] = await tx.select().from(tourInstances).where(and(eq(tourInstances.tourId, tourId), eq(tourInstances.serviceDate, date))).for('update');
      if (retry) return retry;
      throw e;
    }
  }
}


import { db } from "../../db.js";
import { availabilityHolds, tourInstances } from "../../../shared/schema.js";
import { eq, and, sql } from "drizzle-orm";
import { IStorage } from "../../storage.js";

export interface RepairResult {
  instanceId: string;
  beforeCount: number;
  afterCount: number;
  delta: number;
  status: 'fixed' | 'no_change' | 'error';
  error?: string;
}

export interface BatchRepairSummary {
  totalProcessed: number;
  totalFixed: number;
  totalErrors: number;
  instances: RepairResult[];
  checksum: string;
}

export class InventoryRepairService {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Deterministically rebuilds confirmed_count for a single instance from its CONFIRMED holds.
   */
  async repairTourInstance(instanceId: string): Promise<RepairResult> {
    return await db.transaction(async (tx: any) => {
      // 1. Lock the instance for update
      const [instance] = await tx
        .select()
        .from(tourInstances)
        .where(eq(tourInstances.id, instanceId))
        .for('update');

      if (!instance) {
        return {
          instanceId,
          beforeCount: 0,
          afterCount: 0,
          delta: 0,
          status: 'error',
          error: 'Instance not found'
        };
      }

      // 2. Aggregate the seats held by CONFIRMED holds for this instance. A
      // booking row is not a seat: the old `sum(1)` counted bookings (and only
      // those whose display-only tourInstanceId was set), which reset every
      // instance to zero on a fresh database.
      const [result] = await tx
        .select({
          totalConfirmed: sql<number>`COALESCE(SUM(${availabilityHolds.quantity}), 0)`.mapWith(Number)
        })
        .from(availabilityHolds)
        .where(and(
          eq(availabilityHolds.tourInstanceId, instanceId),
          eq(availabilityHolds.status, 'CONFIRMED')
        ));

      const actualConfirmedCount = Number(result?.totalConfirmed) || 0;
      const beforeCount = instance.confirmedCount;

      if (actualConfirmedCount === beforeCount) {
        return {
          instanceId,
          beforeCount,
          afterCount: actualConfirmedCount,
          delta: 0,
          status: 'no_change'
        };
      }

      // 3. Apply correction
      await tx
        .update(tourInstances)
        .set({ 
          confirmedCount: actualConfirmedCount,
          updatedAt: new Date()
        })
        .where(eq(tourInstances.id, instanceId));

      console.log(`[REPAIR][INVENTORY] Instance ${instanceId}: ${beforeCount} -> ${actualConfirmedCount} (Delta: ${actualConfirmedCount - beforeCount})`);

      return {
        instanceId,
        beforeCount,
        afterCount: actualConfirmedCount,
        delta: actualConfirmedCount - beforeCount,
        status: 'fixed'
      };
    });
  }

  /**
   * Repairs all instances for a specific tour and date.
   */
  async repairTourDate(tourId: string, date: string): Promise<RepairResult[]> {
    const instances = await db
      .select({ id: tourInstances.id })
      .from(tourInstances)
      .where(and(
        eq(tourInstances.tourId, tourId),
        eq(tourInstances.serviceDate, date)
      ));

    const results: RepairResult[] = [];
    for (const inst of instances) {
      results.push(await this.repairTourInstance(inst.id));
    }
    return results;
  }

  /**
   * Repairs all inventory in the system.
   */
  async repairAll(options: { dryRun?: boolean } = {}): Promise<BatchRepairSummary> {
    const allInstances = await db.select({ id: tourInstances.id }).from(tourInstances);
    const results: RepairResult[] = [];

    console.log(`[REPAIR][INVENTORY] Starting global repair pass for ${allInstances.length} instances.`);

    for (const inst of allInstances) {
      if (options.dryRun) {
        const result = await this.getRepairDelta(inst.id);
        results.push(result);
      } else {
        results.push(await this.repairTourInstance(inst.id));
      }
    }

    const totalFixed = results.filter(r => r.status === 'fixed').length;
    const totalErrors = results.filter(r => r.status === 'error').length;
    
    // Generate a simple checksum of all confirmed counts for verification
    const checksumInput = results.map(r => `${r.instanceId}:${r.afterCount}`).join('|');
    const checksum = Buffer.from(checksumInput).toString('base64').slice(0, 16);

    return {
      totalProcessed: allInstances.length,
      totalFixed,
      totalErrors,
      instances: results,
      checksum
    };
  }

  private async getRepairDelta(instanceId: string): Promise<RepairResult> {
    const instance = await this.storage.getTourInstanceById(instanceId);
    if (!instance) return { instanceId, beforeCount: 0, afterCount: 0, delta: 0, status: 'error', error: 'Not found' };

    const [result] = await db
      .select({
        totalConfirmed: sql<number>`COALESCE(SUM(${availabilityHolds.quantity}), 0)`.mapWith(Number)
      })
      .from(availabilityHolds)
      .where(and(
        eq(availabilityHolds.tourInstanceId, instanceId),
        eq(availabilityHolds.status, 'CONFIRMED')
      ));

    const actualConfirmedCount = Number(result?.totalConfirmed) || 0;
    return {
      instanceId,
      beforeCount: instance.confirmedCount,
      afterCount: actualConfirmedCount,
      delta: actualConfirmedCount - instance.confirmedCount,
      status: actualConfirmedCount === instance.confirmedCount ? 'no_change' : 'fixed'
    };
  }
}

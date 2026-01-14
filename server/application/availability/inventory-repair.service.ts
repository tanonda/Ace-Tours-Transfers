
import { db } from "../../db.js";
import { bookings, tourInstances, type TourInstance } from "../../../shared/schema.js";
import { eq, and, sql, sum } from "drizzle-orm";
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
   * Deterministically rebuilds confirmed_count for a single instance from its confirmed bookings.
   */
  async repairTourInstance(instanceId: string): Promise<RepairResult> {
    return await db.transaction(async (tx) => {
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

      // 2. Aggregate confirmed bookings from truth source
      const [result] = await tx
        .select({
          totalConfirmed: sum(sql`1`).mapWith(Number)
        })
        .from(bookings)
        .where(and(
          eq(bookings.tourInstanceId, instanceId),
          eq(bookings.status, 'confirmed')
        ));

      const actualConfirmedCount = result?.totalConfirmed || 0;
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
        totalConfirmed: sum(sql`1`).mapWith(Number)
      })
      .from(bookings)
      .where(and(
        eq(bookings.tourInstanceId, instanceId),
        eq(bookings.status, 'confirmed')
      ));

    const actualConfirmedCount = result?.totalConfirmed || 0;
    return {
      instanceId,
      beforeCount: instance.confirmedCount,
      afterCount: actualConfirmedCount,
      delta: actualConfirmedCount - instance.confirmedCount,
      status: actualConfirmedCount === instance.confirmedCount ? 'no_change' : 'fixed'
    };
  }
}

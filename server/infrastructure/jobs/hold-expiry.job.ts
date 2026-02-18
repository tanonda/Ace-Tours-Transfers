import { IStorage } from "../../storage.js";
import { AvailabilityService, HoldStatus } from "../../domain/availability/availability.service.js";

export interface HoldExpiryMetrics {
  totalRuns: number;
  totalExpired: number;
  totalFailed: number;
  lastRunAt: Date | null;
  lastRunDurationMs: number;
  lastRunExpiredCount: number;
}

export class HoldExpiryJob {
  private availabilityService: AvailabilityService;
  private storage: IStorage;
  private intervalId: NodeJS.Timeout | null = null;
  private metrics: HoldExpiryMetrics = {
    totalRuns: 0,
    totalExpired: 0,
    totalFailed: 0,
    lastRunAt: null,
    lastRunDurationMs: 0,
    lastRunExpiredCount: 0,
  };
  private readonly BATCH_SIZE = 50;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.availabilityService = new AvailabilityService(storage);
  }

  /**
   * Process expired holds in batches.
   * Audit logging is handled internally by AvailabilityService.releaseHold.
   */
  async run(): Promise<{ expired: number; failed: number }> {
    const startTime = Date.now();
    const now = new Date();
    let totalExpired = 0;
    let totalFailed = 0;

    try {
      const expiredHolds = await this.storage.getExpiredHolds(now);

      if (expiredHolds.length === 0) {
        this.updateMetrics(startTime, 0, 0);
        return { expired: 0, failed: 0 };
      }

      console.log(`[HOLD-EXPIRY] Found ${expiredHolds.length} expired holds. Processing in batches of ${this.BATCH_SIZE}...`);

      // Process in batches to avoid overwhelming the DB
      for (let i = 0; i < expiredHolds.length; i += this.BATCH_SIZE) {
        const batch = expiredHolds.slice(i, i + this.BATCH_SIZE);
        const batchNum = Math.floor(i / this.BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(expiredHolds.length / this.BATCH_SIZE);

        console.log(`[HOLD-EXPIRY] Processing batch ${batchNum}/${totalBatches} (${batch.length} holds)`);

        // Process batch concurrently with Promise.allSettled for resilience
        const results = await Promise.allSettled(
          batch.map(async (hold) => {
            // M3 Fix: Cancel associated pending booking before releasing hold
            if (hold.bookingId) {
              const booking = await this.storage.getBooking(hold.bookingId);
              if (booking && booking.status === 'pending') {
                console.log(`[HOLD-EXPIRY] Cancelling orphaned pending booking ${booking.id} for expired hold ${hold.id}`);
                await this.storage.updateBooking(booking.id, {
                  status: 'expired',
                  updatedAt: new Date(),
                  notes: (booking.notes || "") + "\nCancelled by hold expiry job."
                });
              }
            }
            return this.availabilityService.releaseHold(hold.id, HoldStatus.EXPIRED);
          })
        );

        for (const result of results) {
          if (result.status === "fulfilled") {
            totalExpired++;
          } else {
            totalFailed++;
            console.error(`[HOLD-EXPIRY] Failed to release hold:`, result.reason);
          }
        }
      }

      const durationMs = Date.now() - startTime;
      console.log(
        `[HOLD-EXPIRY] Completed: ${totalExpired} expired, ${totalFailed} failed in ${durationMs}ms`
      );
    } catch (error) {
      console.error("[HOLD-EXPIRY] Critical error during hold expiry sweep:", error);
    }

    this.updateMetrics(startTime, totalExpired, totalFailed);
    return { expired: totalExpired, failed: totalFailed };
  }

  private updateMetrics(startTime: number, expired: number, failed: number): void {
    this.metrics.totalRuns++;
    this.metrics.totalExpired += expired;
    this.metrics.totalFailed += failed;
    this.metrics.lastRunAt = new Date();
    this.metrics.lastRunDurationMs = Date.now() - startTime;
    this.metrics.lastRunExpiredCount = expired;
  }

  getMetrics(): HoldExpiryMetrics {
    return { ...this.metrics };
  }

  start(intervalMs: number = 60000): void {
    if (this.intervalId) {
      console.warn("[HOLD-EXPIRY] Job already running, skipping duplicate start");
      return;
    }
    console.log(`[HOLD-EXPIRY] Starting with interval ${intervalMs}ms (batch size: ${this.BATCH_SIZE})`);
    // Run immediately on start, then at interval
    this.run();
    this.intervalId = setInterval(() => this.run(), intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("[HOLD-EXPIRY] Job stopped");
    }
  }
}

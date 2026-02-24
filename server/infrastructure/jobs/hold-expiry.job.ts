import { IStorage } from "../../storage.js";
import { AvailabilityService, HoldStatus } from "../../domain/availability/availability.service.js";
import { createLogger } from "../../lib/logger.js";
import { extractErrorDetails } from "../../lib/error-util.js";

const log = createLogger('hold-expiry');

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
        log.info('No expired holds to sweep');
        this.updateMetrics(startTime, 0, 0);
        return { expired: 0, failed: 0 };
      }

      log.info('Found expired holds', { count: expiredHolds.length, batchSize: this.BATCH_SIZE });

      // Process in batches to avoid overwhelming the DB
      for (let i = 0; i < expiredHolds.length; i += this.BATCH_SIZE) {
        const batch = expiredHolds.slice(i, i + this.BATCH_SIZE);
        const batchNum = Math.floor(i / this.BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(expiredHolds.length / this.BATCH_SIZE);

        log.info('Processing batch', { batch: batchNum, total: totalBatches, holds: batch.length });

        // Process batch concurrently with Promise.allSettled for resilience
        const results = await Promise.allSettled(
          batch.map(async (hold) => {
            // HIGH-3 FIX: Release hold first (transactional), then cancel booking.
            // releaseHold is already transactional internally (lock + decrement + status update).
            // The booking status update wraps together so if releaseHold succeeds,
            // the booking MUST be cancelled too — we retry the booking update if it fails.
            await this.availabilityService.releaseHold(hold.id, HoldStatus.EXPIRED);

            // Cancel associated pending booking AFTER hold is released
            const booking = await this.storage.getBookingByHoldId(hold.id);
            if (booking && booking.status === 'pending') {
              log.info('Cancelling orphaned pending booking', { bookingId: booking.id, holdId: hold.id });
              try {
                await this.storage.updateBooking(booking.id, {
                  status: 'expired',
                  updatedAt: new Date(),
                  notes: (booking.notes || "") + "\nCancelled by hold expiry job."
                });
              } catch (bookingErr) {
                // Hold has been released — booking update failing is critical.
                // Log prominently so reconciliation can pick it up.
                log.error('Hold released but booking update FAILED', { holdId: hold.id, bookingId: booking.id, error: (bookingErr as Error).message });
                throw bookingErr; // Surface the failure to Promise.allSettled
              }
            }
          })
        );

        for (const result of results) {
          if (result.status === "fulfilled") {
            totalExpired++;
          } else {
            totalFailed++;
            const holdErr = result.reason instanceof Error ? result.reason.message : String(result.reason ?? 'unknown');
            log.error('Failed to release hold', { error: holdErr });
          }
        }
      }

      const durationMs = Date.now() - startTime;
      log.info('Completed', { expired: totalExpired, failed: totalFailed, durationMs });
    } catch (error: any) {
      const isNetworkTimeout = error?.message?.includes('ETIMEDOUT') || error?.message?.includes('ENETUNREACH');
      if (isNetworkTimeout) {
        log.warn(`Database connection timeout during sweep (${error.message}). Database may be sleeping. Will retry next cycle.`);
      } else {
        const errorDetails = extractErrorDetails(error);
        log.error('Critical error during hold expiry sweep', {
          error: errorDetails.message,
          details: errorDetails
        });
      }
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
      log.warn('Job already running, skipping duplicate start');
      return;
    }
    log.info('Starting', { intervalMs, batchSize: this.BATCH_SIZE });
    // Run immediately on start, then at interval
    this.run();
    this.intervalId = setInterval(() => this.run(), intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      log.info('Job stopped');
    }
  }
}

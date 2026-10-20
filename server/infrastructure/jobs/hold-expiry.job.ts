import { IStorage } from "../../storage.js";
import { AvailabilityService, HoldStatus } from "../../domain/availability/availability.service.js";
import { createLogger } from "../../lib/logger.js";
import { extractErrorDetails } from "../../lib/error-util.js";
import { holdCountsForBooking } from "../../lib/manual-confirmation.js";
import type { AvailabilityHold, Booking } from "../../../shared/schema.js";

const log = createLogger('hold-expiry');

/** Holds already reported as skipped (a paid booking's), so each is logged once per process. */
const loggedSkippedHolds = new Set<string>();

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
          batch.map(async (hold): Promise<'expired' | 'skipped'> => {
            // Backstop: never free the seats of a confirmed or completed booking (one confirmed by
            // hand before its hold was confirmed would otherwise be overbooked). The hold stays as it is.
            const booking = await this.storage.getBookingByHoldId(hold.id);
            const paidBooking = await this.paidBookingOwning(hold, booking);
            if (paidBooking) {
              if (!loggedSkippedHolds.has(hold.id)) {
                loggedSkippedHolds.add(hold.id);
                log.warn('Skipping expired hold of a confirmed booking', { holdId: hold.id, bookingId: paidBooking.id, status: paidBooking.status });
              }
              return 'skipped';
            }

            // Release first (transactional: lock + decrement + status). Only a hold this call actually
            // released expires its booking; a hold confirmed or released meanwhile is left alone.
            const released = await this.availabilityService.releaseHold(hold.id, HoldStatus.EXPIRED);
            if (!released) return 'skipped';

            // Expire the booking only while it is still pending: the write is conditional, so a confirm
            // that landed after the read above is never overwritten.
            if (booking) {
              try {
                const expired = await this.storage.expireBookingIfPending(booking.id, "\nCancelled by hold expiry job.");
                if (expired) log.info('Expired orphaned pending booking', { bookingId: booking.id, holdId: hold.id });
              } catch (bookingErr) {
                // Hold has been released — booking update failing is critical.
                // Log prominently so reconciliation can pick it up.
                log.error('Hold released but booking update FAILED', { holdId: hold.id, bookingId: booking.id, error: (bookingErr as Error).message });
                throw bookingErr; // Surface the failure to Promise.allSettled
              }
            }
            return 'expired';
          })
        );

        for (const result of results) {
          if (result.status === "fulfilled") {
            if (result.value === 'expired') totalExpired++;
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
      const details = extractErrorDetails(error);
      const isNetworkTimeout = details.message?.includes('ETIMEDOUT') ||
        details.message?.includes('ENETUNREACH') ||
        JSON.stringify(details).includes('ETIMEDOUT');

      if (isNetworkTimeout) {
        log.warn(`Database connection timeout during sweep (${details.message}). Database may be sleeping. Will retry next cycle.`);
      } else {
        const errorDetails = details;
        log.error('Critical error during hold expiry sweep', {
          error: errorDetails.message,
          details: errorDetails
        });
      }
    }

    this.updateMetrics(startTime, totalExpired, totalFailed);
    return { expired: totalExpired, failed: totalFailed };
  }

  /**
   * The confirmed or completed booking this hold belongs to, if any: the booking whose holdId it is,
   * or else (the later items of a multi-item booking) the one booking of its session, by the same
   * rule a manual confirm uses (holdCountsForBooking).
   */
  private async paidBookingOwning(hold: AvailabilityHold, byHold: Booking | undefined): Promise<Booking | undefined> {
    const paid = (b: Booking) => b.status === 'confirmed' || b.status === 'completed';
    if (byHold) return paid(byHold) ? byHold : undefined;
    if (!hold.bookingSessionId) return undefined;
    const group = await this.storage.getBookingsBySession(hold.bookingSessionId);
    if (group.length !== 1) return undefined;
    const [only] = group; // alone in its session
    return paid(only) && holdCountsForBooking(hold, only, true) ? only : undefined;
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

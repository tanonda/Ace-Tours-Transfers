import { IStorage } from "../../storage.js";
import { createLogger } from "../../lib/logger.js";
import { db } from "../../db.js";
import { bookings } from "../../../shared/schema.js";
import { and, lt, inArray, isNull, isNotNull, sql } from "drizzle-orm";

const log = createLogger('archive-cleanup');

/**
 * ArchiveCleanupJob — soft-archives stale bookings then hard-deletes ancient archives.
 *
 * Retention policy:
 *   - pending bookings older than 30 days    → archived (soft-delete)
 *   - expired/cancelled bookings > 60 days   → archived (soft-delete)
 *   - archived bookings > 12 months          → permanently deleted
 *
 * Runs daily (every 24h). Safe to restart — all operations are idempotent.
 */
export class ArchiveCleanupJob {
  private storage: IStorage;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

  // Retention windows
  private readonly PENDING_DAYS = 30;
  private readonly CANCELLED_DAYS = 60;
  private readonly ARCHIVE_RETENTION_DAYS = 365;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  async run(): Promise<{ softArchived: number; hardDeleted: number }> {
    const startTime = Date.now();
    let softArchived = 0;
    let hardDeleted = 0;

    try {
      const now = new Date();

      // 1. Soft-archive old pending bookings
      const pendingCutoff = new Date(now);
      pendingCutoff.setDate(pendingCutoff.getDate() - this.PENDING_DAYS);

      const softArchivedPending = await db
        .update(bookings)
        .set({ archivedAt: now, updatedAt: now, notes: sql`COALESCE(${bookings.notes}, '') || ' [Auto-archived: stale pending]'` })
        .where(
          and(
            inArray(bookings.status, ['pending']),
            lt(bookings.createdAt, pendingCutoff),
            isNull(bookings.archivedAt)
          )
        )
        .returning({ id: bookings.id });

      softArchived += softArchivedPending.length;
      if (softArchivedPending.length > 0) {
        log.info('Soft-archived stale pending bookings', { count: softArchivedPending.length, olderThanDays: this.PENDING_DAYS });
      }

      // 2. Soft-archive old cancelled/expired bookings
      const cancelledCutoff = new Date(now);
      cancelledCutoff.setDate(cancelledCutoff.getDate() - this.CANCELLED_DAYS);

      const softArchivedCancelled = await db
        .update(bookings)
        .set({ archivedAt: now, updatedAt: now, notes: sql`COALESCE(${bookings.notes}, '') || ' [Auto-archived: old cancellation]'` })
        .where(
          and(
            inArray(bookings.status, ['cancelled', 'expired', 'failed']),
            lt(bookings.createdAt, cancelledCutoff),
            isNull(bookings.archivedAt)
          )
        )
        .returning({ id: bookings.id });

      softArchived += softArchivedCancelled.length;
      if (softArchivedCancelled.length > 0) {
        log.info('Soft-archived old cancelled/expired bookings', { count: softArchivedCancelled.length, olderThanDays: this.CANCELLED_DAYS });
      }

      // 3. Hard-delete bookings archived > 12 months ago
      const archiveCutoff = new Date(now);
      archiveCutoff.setDate(archiveCutoff.getDate() - this.ARCHIVE_RETENTION_DAYS);

      const hardDeletedRows = await db
        .delete(bookings)
        .where(
          and(
            isNotNull(bookings.archivedAt),
            lt(bookings.archivedAt, archiveCutoff)
          )
        )
        .returning({ id: bookings.id });

      hardDeleted = hardDeletedRows.length;
      if (hardDeleted > 0) {
        log.info('Hard-deleted ancient archived bookings', { count: hardDeleted, olderThanDays: this.ARCHIVE_RETENTION_DAYS });
      }

      const durationMs = Date.now() - startTime;
      log.info('Archive cleanup complete', { softArchived, hardDeleted, durationMs });
    } catch (error: any) {
      log.error('Archive cleanup error', { error: error?.message });
    }

    return { softArchived, hardDeleted };
  }

  start(): void {
    if (this.intervalId) return;
    log.info('Starting archive cleanup job', {
      intervalHours: this.INTERVAL_MS / 3600000,
      pendingRetentionDays: this.PENDING_DAYS,
      cancelledRetentionDays: this.CANCELLED_DAYS,
      archiveRetentionDays: this.ARCHIVE_RETENTION_DAYS,
    });
    // Run once on startup, then daily
    this.run();
    this.intervalId = setInterval(() => this.run(), this.INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      log.info('Archive cleanup job stopped');
    }
  }
}

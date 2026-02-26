
import { db, pool } from "../../db.js";
import { sql } from "drizzle-orm";
import { extractErrorDetails } from "../../lib/error-util.js";
import fs from 'fs';
import path from 'path';

export interface IntegrityStatus {
  isSafe: boolean;
  message: string;
  details?: {
    schemaVersion?: string;
    migrationCount?: number;
    driftDetected: boolean;
    error?: any;
  };
}

export class BackupIntegrityGuard {
  private static writeBlocked: boolean = false;

  /**
   * Performs an integrity check on the database against the local source of truth (migrations).
   */
  async checkIntegrity(): Promise<IntegrityStatus> {
    try {
      // 1. Check if we can even connect
      await db.execute(sql`SELECT 1`);

      // 2. Determine the expected migration count from the journal (source of truth),
      //    falling back to raw file count if the journal is unavailable.
      let expectedMigrationCount: number;
      try {
        const journalPath = path.join(process.cwd(), 'migrations', 'meta', '_journal.json');
        const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
        expectedMigrationCount = (journal.entries ?? []).length;
      } catch {
        const migrationFiles = fs.readdirSync(path.join(process.cwd(), 'migrations')).filter(f => f.endsWith('.sql'));
        expectedMigrationCount = migrationFiles.length;
      }

      // 3. Prefer our custom idempotent tracking table (drizzle_migrations_applied)
      //    which correctly handles migrations without Drizzle snapshot files.
      //    Fall back to __drizzle_migrations if the custom table doesn't exist yet.
      let dbMigrationCount = 0;
      let trackingTableUsed = 'drizzle_migrations_applied';

      const customTableResult = await db.execute(sql`
        SELECT count(*) as total FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'drizzle_migrations_applied'
      `);
      const customTableExists = parseInt((customTableResult.rows[0] as any).total) > 0;

      if (customTableExists) {
        const countResult = await db.execute(sql`SELECT count(*) FROM "drizzle_migrations_applied"`);
        dbMigrationCount = parseInt((countResult.rows[0] as any).count);
      } else {
        // Fallback: check if standard Drizzle migrations table exists
        const drizzleTableResult = await db.execute(sql`
          SELECT count(*) as total FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = '__drizzle_migrations'
        `);
        const drizzleTableExists = parseInt((drizzleTableResult.rows[0] as any).total) > 0;

        if (!drizzleTableExists) {
          console.warn("[INTEGRITY] No migration tracking table found. Database appears to be fresh or not initialized.");
          return {
            isSafe: true,
            message: "Database not yet migrated. Initial setup required.",
            details: { migrationCount: 0, driftDetected: false }
          };
        }

        trackingTableUsed = '__drizzle_migrations';
        const countResult = await db.execute(sql`SELECT count(*) FROM "__drizzle_migrations"`);
        dbMigrationCount = parseInt((countResult.rows[0] as any).count);
      }

      const countStatus = dbMigrationCount === expectedMigrationCount
        ? 'up to date'
        : dbMigrationCount > expectedMigrationCount
          ? `${dbMigrationCount} applied (${dbMigrationCount - expectedMigrationCount} ahead of journal — harmless)`
          : `${dbMigrationCount}/${expectedMigrationCount}`;
      console.log(`[INTEGRITY] Tracking via '${trackingTableUsed}': ${countStatus}.`);

      if (dbMigrationCount < expectedMigrationCount) {
        BackupIntegrityGuard.writeBlocked = true;
        return {
          isSafe: false,
          message: `SCHEMA DRIFT DETECTED: Database has ${dbMigrationCount} of ${expectedMigrationCount} migrations applied. Writes are blocked to prevent corruption.`,
          details: {
            migrationCount: dbMigrationCount,
            driftDetected: true
          }
        };
      }

      // 4. Verify core table presence (only if migrations were run)
      const tablesResult = await db.execute(sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name IN ('bookings', 'tour_instances', 'payments')
      `);

      if (tablesResult.rows.length < 3) {
        BackupIntegrityGuard.writeBlocked = true;
        return {
          isSafe: false,
          message: "CRITICAL DATA LOSS: Missing core tables after restore.",
          details: { driftDetected: true }
        };
      }

      return {
        isSafe: true,
        message: "Database integrity verified.",
        details: {
          migrationCount: dbMigrationCount,
          driftDetected: false
        }
      };

    } catch (error: any) {
      console.error("[INTEGRITY] Guard check failed:", error);
      const errorDetails = extractErrorDetails(error);
      // Don't block writes on check failure - this allows graceful degradation
      // Only block if we explicitly detect schema drift
      return {
        isSafe: true,
        message: `INTEGRITY CHECK INCONCLUSIVE: ${errorDetails.message}`,
        details: { driftDetected: false, error: errorDetails }
      };
    }
  }

  /**
   * Global flag to check if the system should allow mutations.
   */
  static isWriteBlocked(): boolean {
    return this.writeBlocked;
  }

  /**
   * Middleware to enforce read-only mode if integrity is compromised.
   */
  static enforceReadOnly(req: any, res: any, next: any) {
    if (BackupIntegrityGuard.writeBlocked) {
      // LOW-6 DOC: POST /api/availability/check is allowed because it's a pure read query
      // despite using POST method (POST is used to accept structured body params).
      if (req.method === 'GET' || req.path.startsWith('/api/admin/recovery') || req.path === '/api/availability/check') {
        return next();
      }

      console.warn(`[INTEGRITY] Mutation blocked: ${req.method} ${req.path}`);
      return res.status(503).json({
        error: "System in Read-Only Mode",
        message: "A database integrity issue was detected after restore. Mutations are blocked until recovery is completed by an admin.",
        recoveryUrl: "/admin/recovery"
      });
    }
    next();
  }
}

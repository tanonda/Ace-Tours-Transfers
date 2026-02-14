
import { db, pool } from "../../db.js";
import { sql } from "drizzle-orm";
import fs from 'fs';
import path from 'path';

export interface IntegrityStatus {
  isSafe: boolean;
  message: string;
  details?: {
    schemaVersion?: string;
    migrationCount?: number;
    driftDetected: boolean;
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

      // 2. Count migrations in the database vs local files
      const migrationFiles = fs.readdirSync(path.join(process.cwd(), 'migrations')).filter(f => f.endsWith('.sql'));
      const localMigrationCount = migrationFiles.length;

      // Drizzle Kit uses a __drizzle_migrations table (default)
      const migrationResult = await db.execute(sql`SELECT count(*) FROM "__drizzle_migrations"`);
      const dbMigrationCount = parseInt((migrationResult.rows[0] as any).count);

      if (dbMigrationCount < localMigrationCount) {
        BackupIntegrityGuard.writeBlocked = true;
        return {
          isSafe: false,
          message: "SCHEMA DRIFT DETECTED: Database is behind local migrations. Writes are blocked to prevent corruption.",
          details: {
            migrationCount: dbMigrationCount,
            driftDetected: true
          }
        };
      }

      // 3. Verify core table presence
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
      BackupIntegrityGuard.writeBlocked = true;
      return {
        isSafe: false,
        message: `INTEGRITY CHECK FAILED: ${error.message}`,
        details: { driftDetected: true }
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
      // Allow GET requests, Recovery routes, and read-only POST endpoints
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

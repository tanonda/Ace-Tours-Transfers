/**
 * fix_migration_state.ts  (v3 — final)
 *
 * Steps 1-3 already succeeded. This version:
 *   - Skips steps 1-3 if already done (idempotent)
 *   - Fixes step 4: uses Pool (websocket) instead of neon HTTP client,
 *     which supports raw query execution
 *   - Applies 0005 fraud columns and records them in __drizzle_migrations
 *
 * Usage: npx tsx fix_migration_state.ts
 */

import "dotenv/config";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import crypto from "crypto";
import fs from "fs";
import path from "path";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function hashFile(filePath: string): string {
  const content = fs.readFileSync(filePath, "utf8");
  return crypto.createHash("sha256").update(content).digest("hex");
}

const ALREADY_APPLIED = [
  "migrations/0000_tearful_phil_sheldon.sql",
  "migrations/0001_supreme_nebula.sql",
  "migrations/0002_redundant_tag.sql",
  "migrations/0003_reviews_guest_and_moderation.sql",
  "migrations/0004_outstanding_storm.sql",
];

const FRAUD_STATEMENTS = [
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "fraud_score" integer`,
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "fraud_level" varchar(10)`,
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "fraud_signals" jsonb`,
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "fraud_reviewed_at" timestamp`,
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "fraud_reviewed_by" varchar REFERENCES "users"("id")`,
  `CREATE INDEX IF NOT EXISTS "idx_bookings_fraud_level" ON "bookings" ("fraud_level") WHERE "fraud_level" IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS "idx_bookings_fraud_pending" ON "bookings" ("fraud_level", "fraud_reviewed_at") WHERE "fraud_level" IS NOT NULL AND "fraud_reviewed_at" IS NULL`,
];

async function main() {
  console.log("=== Migration State Repair & Apply (v3) ===\n");
  const client = await pool.connect();

  try {
    // Step 1: Ensure tracking table exists
    console.log("Step 1: Ensuring __drizzle_migrations exists...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id         SERIAL PRIMARY KEY,
        hash       TEXT NOT NULL,
        created_at BIGINT
      )
    `);
    console.log("  OK\n");

    // Step 2: Load already-tracked hashes
    const { rows: tracked } = await client.query(`SELECT hash FROM __drizzle_migrations`);
    const trackedHashes = new Set(tracked.map((r: any) => r.hash));
    console.log(`Step 2: ${trackedHashes.size} migration(s) already tracked.\n`);

    // Step 3: Mark 0000-0004 as applied (skip if already done from previous run)
    console.log("Step 3: Recording already-applied migrations (0000-0004)...");
    for (const filePath of ALREADY_APPLIED) {
      if (!fs.existsSync(filePath)) {
        console.log(`  SKIP (not found): ${filePath}`);
        continue;
      }
      const hash = hashFile(filePath);
      if (trackedHashes.has(hash)) {
        console.log(`  SKIP (already tracked): ${path.basename(filePath)}`);
      } else {
        await client.query(
          `INSERT INTO __drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
          [hash, Date.now()]
        );
        console.log(`  MARKED: ${path.basename(filePath)}`);
      }
    }
    console.log();

    // Step 4: Apply 0005 fraud statements one by one
    console.log("Step 4: Applying 0005 fraud detection columns...");
    for (const stmt of FRAUD_STATEMENTS) {
      try {
        await client.query(stmt);
        console.log(`  OK: ${stmt.slice(0, 80)}`);
      } catch (e: any) {
        if (e.code === "42701" || e.message?.includes("already exists")) {
          console.log(`  SKIP (already exists): ${stmt.slice(0, 60)}`);
        } else {
          throw e;
        }
      }
    }
    console.log();

    // Step 5: Record 0005 in tracking table
    console.log("Step 5: Recording 0005_fraud_detection...");
    const fraud005Path = "migrations/0005_fraud_detection.sql";
    if (fs.existsSync(fraud005Path)) {
      const hash005 = hashFile(fraud005Path);
      // Re-read tracked hashes since they may have changed in this run
      const { rows: trackedNow } = await client.query(`SELECT hash FROM __drizzle_migrations`);
      const trackedNowSet = new Set(trackedNow.map((r: any) => r.hash));
      if (!trackedNowSet.has(hash005)) {
        await client.query(
          `INSERT INTO __drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
          [hash005, Date.now()]
        );
        console.log("  RECORDED: 0005_fraud_detection.sql");
      } else {
        console.log("  SKIP: already tracked");
      }
    } else {
      console.log("  NOTE: migrations/0005_fraud_detection.sql not found — skipping record.");
      console.log("        This is fine; the columns were applied above.");
    }
    console.log();

    // Final verification
    console.log("=== Final Verification ===");
    const { rows: finalCols } = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'bookings' AND column_name LIKE 'fraud%'
      ORDER BY ordinal_position
    `);
    if (finalCols.length === 0) {
      console.log("WARNING: No fraud columns found — check for errors above.");
    } else {
      console.log("Fraud columns on bookings:");
      finalCols.forEach((r: any) => console.log(`  ${r.column_name} (${r.data_type})`));
    }

    const { rows: countRows } = await client.query(`SELECT count(*) AS n FROM __drizzle_migrations`);
    console.log(`\n__drizzle_migrations: ${countRows[0].n} record(s) total`);
    console.log("\nAll done. npx tsx server/migrate.ts will now work normally.");

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("\nFailed:", err.message);
  process.exit(1);
});

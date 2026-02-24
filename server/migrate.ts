/**
 * server/migrate.ts  — idempotent replacement
 *
 * Replaces the original Drizzle migrate() call which fails on already-applied
 * migrations. This version:
 *
 *  - Manages its own tracking table (drizzle_migrations_applied) to avoid
 *    conflicts with any prior __drizzle_migrations state
 *  - Reads each .sql file from the migrations/ folder, splits on
 *    --> statement-breakpoint, and executes each statement individually
 *  - Catches and ignores "already exists" / "does not exist" errors so it
 *    is safe to run multiple times
 *  - Marks each migration file as applied by its filename so it is skipped
 *    on subsequent runs
 *
 * Usage: npx tsx server/migrate.ts
 */

import "dotenv/config";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import fs from "fs";
import path from "path";
import crypto from "crypto";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set.");
}

// Ordered list of migration files to apply
const MIGRATIONS_DIR = path.resolve("migrations");
const TRACKING_TABLE = "drizzle_migrations_applied";

// Postgres error codes that mean "this change is already done — skip it"
const IGNORABLE_CODES = new Set([
  "42701", // duplicate_column
  "42P07", // duplicate_table
  "42710", // duplicate_object (constraint/index)
  "42704", // undefined_object (dropping something that doesn't exist)
  "23505", // unique_violation (on constraint creation)
]);

function splitStatements(sql: string): string[] {
  return sql
    .split("--> statement-breakpoint")
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.replace(/--[^\n]*/g, "").trim().startsWith("/*") === false || s.trim().length > 0)
    .filter(s => s.replace(/--[^\n]*/g, "").trim().length > 0); // skip comment-only blocks
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  console.log("Running migrations...");
  console.log("DATABASE_URL used for migration: Configured");

  try {
    // 1. Create tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TRACKING_TABLE} (
        id          SERIAL PRIMARY KEY,
        filename    TEXT NOT NULL UNIQUE,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // 2. Load already-applied migrations
    const { rows } = await client.query(`SELECT filename FROM ${TRACKING_TABLE}`);
    const applied = new Set(rows.map((r: any) => r.filename));

    // 3. Read migration files in order
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith(".sql") && !f.startsWith("meta"))
      .sort();

    let ran = 0;
    for (const filename of files) {
      if (applied.has(filename)) {
        console.log(`  SKIP (already applied): ${filename}`);
        continue;
      }

      const filePath = path.join(MIGRATIONS_DIR, filename);
      const sql = fs.readFileSync(filePath, "utf8");
      const statements = splitStatements(sql);

      console.log(`  Applying: ${filename} (${statements.length} statement(s))`);

      for (const stmt of statements) {
        try {
          await client.query(stmt);
        } catch (e: any) {
          if (IGNORABLE_CODES.has(e.code)) {
            console.log(`    SKIP (${e.code}): ${stmt.slice(0, 70).replace(/\s+/g, " ")}...`);
          } else {
            console.error(`    FAILED on statement: ${stmt.slice(0, 120)}`);
            throw e;
          }
        }
      }

      await client.query(
        `INSERT INTO ${TRACKING_TABLE} (filename) VALUES ($1)`,
        [filename]
      );
      console.log(`    DONE: ${filename}`);
      ran++;
    }

    if (ran === 0) {
      console.log("  Nothing to apply — all migrations already up to date.");
    }

    console.log("Migrations complete!");
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

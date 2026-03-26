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
import pkg from "pg";
const { Pool } = pkg;
import fs from "fs";
import path from "path";
import { resolve4 } from "node:dns/promises";
import { URL } from "node:url";
import dns from "node:dns";

if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

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
  "42P01", // ← ADD THIS: undefined_table (relation does not exist)
]);

function splitStatements(sql: string): string[] {
  return sql
    .split("--> statement-breakpoint")
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.replace(/--[^\n]*/g, "").trim().startsWith("/*") === false || s.trim().length > 0)
    .filter(s => s.replace(/--[^\n]*/g, "").trim().length > 0); // skip comment-only blocks
}

/**
 * Core migration logic. Accepts an optional external pool (e.g. the app's
 * shared Neon pool) so callers can reuse an existing connection. When run
 * from the CLI it falls back to a new Pool using DATABASE_URL.
 */
export async function runIdempotentMigrations(externalPool?: any): Promise<void> {
  const ownsPool = !externalPool;
  let pool = externalPool;

  if (ownsPool) {
    const connectionString = process.env.DATABASE_URL!;
    const url = new URL(connectionString);
    const host = url.hostname;
    const port = parseInt(url.port || "5432");
    const user = decodeURIComponent(url.username);
    const password = decodeURIComponent(url.password);
    const database = decodeURIComponent(url.pathname.substring(1));

    console.log(`[MIGRATE] Resolving host: ${host}...`);
    let targetHost = host;

    try {
      const ips = await resolve4(host);
      if (ips && ips.length > 0) {
        targetHost = ips[0];
        console.log(`[MIGRATE] Host resolved to IP: ${targetHost}`);
      }
    } catch (dnsError: any) {
      console.warn(`[MIGRATE] DNS fallback: ${dnsError.message}`);
    }

    pool = new Pool({
      host: targetHost,
      port: port,
      user: user,
      password: password,
      database: database,
      connectionTimeoutMillis: 60000,
      ssl: {
        servername: host,
        rejectUnauthorized: false
      }
    });
  }

  const client = await pool.connect();

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
    if (ownsPool) {
      // Force-end the pool with a timeout so the CLI process always exits
      // promptly even if Neon's WebSocket connection doesn't close cleanly.
      await Promise.race([
        pool.end(),
        new Promise<void>(resolve => setTimeout(resolve, 5000)),
      ]);
    }
  }
}

// CLI entry point — only runs when invoked directly: npx tsx server/migrate.ts
async function main() {
  console.log("Running migrations...");
  console.log("DATABASE_URL used for migration: Configured");
  await runIdempotentMigrations();
  process.exit(0);
}

// Guard: only auto-run when this file is the entry point (not when imported)
const isMain = process.argv[1] && (
  process.argv[1].endsWith('migrate.ts') ||
  process.argv[1].endsWith('migrate.js')
);

if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

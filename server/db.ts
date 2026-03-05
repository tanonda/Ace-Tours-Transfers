import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import dns from "node:dns";
import * as schema from "../shared/schema.js";

// Force IPv4 ordering to prevent timeouts in environments where IPv6 is unavailable/flaky
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

console.log(`[DATABASE] Connecting to: ${process.env.DATABASE_URL.split('@')[1]?.split('/')[0] || "unknown"}`);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 60000, // Increased to 60s for high-latency environments
  idleTimeoutMillis: 30000,      // Close idle connections after 30s
  max: 20,                       // Increased max connections for concurrent peaks
  allowExitOnIdle: false,
});

console.log(`[DATABASE] Pool initialized (Timeout: 60s, Max: 20)`);

// Add pool error listener to prevent uncaught exceptions from broken connections
pool.on('error', (err) => {
  console.error('[DATABASE POOL ERROR]', err.message);
  // Do not exit process, let the pool handle reconnection
});
export const db = drizzle(pool, { schema });

// Keepalive: Neon serverless suspends after ~5 min of inactivity, causing ETIMEDOUT
// storms on the next request. A lightweight ping every 4 min prevents suspension.
// Fire-and-forget — errors are expected if the DB is momentarily unreachable and
// the pool's own retry logic handles reconnection.
const KEEPALIVE_INTERVAL_MS = 4 * 60 * 1000; // 4 minutes
setInterval(() => {
  pool.query('SELECT 1').catch(() => {
    // Silently swallow — the retry logic in storage.ts handles reconnection
  });
}, KEEPALIVE_INTERVAL_MS).unref(); // .unref() so it doesn't prevent process exit

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import dns from "node:dns";
import * as schema from "../shared/schema.js";

// Force IPv4 ordering to prevent timeouts in environments where IPv6 is unavailable/flaky
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

neonConfig.webSocketConstructor = ws;

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

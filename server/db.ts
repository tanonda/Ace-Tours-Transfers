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

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 30000, // Increased to 30s to handle slow network/startup
  max: 10, // Limit pool size for serverless compatibility
});

// Add pool error listener to prevent uncaught exceptions from broken connections
pool.on('error', (err) => {
  console.error('[DATABASE POOL ERROR]', err.message);
  // Do not exit process, let the pool handle reconnection
});
export const db = drizzle(pool, { schema });

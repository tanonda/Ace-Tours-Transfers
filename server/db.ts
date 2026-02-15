import "dotenv/config";
import dns from "node:dns";

// Force IPv4 ordering to prevent timeouts in environments where IPv6 is unavailable/flaky
// This fixes AggregateError [ETIMEDOUT] when connecting to Neon
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "../shared/schema.js";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

console.log("Initializing database connection...");

// Connection configuration
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 30000, // 30 seconds
  max: 20,
  idleTimeoutMillis: 60000,
});

// Add error handling for the pool
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

pool.on('connect', () => {
  if (process.env.NODE_ENV === 'production') {
    console.log('Database connected successfully');
  }
});

export const db = drizzle({ client: pool, schema });

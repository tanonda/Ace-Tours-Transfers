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
  connectionTimeoutMillis: 10000,
});
export const db = drizzle(pool, { schema });

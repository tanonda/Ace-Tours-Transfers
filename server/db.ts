import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import dns from "node:dns/promises";
import * as schema from "../shared/schema.js";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

/**
 * Resilient Pool Factory
 * In some environments, Node.js struggles with DNS resolution for Neon hosts,
 * leading to ETIMEDOUT. This factory resolves the host to an IP at startup
 * and uses it directly with the SNI 'servername' header.
 */
async function createResilientPool() {
  const connectionString = process.env.DATABASE_URL!;
  
  // Extract host/port from connection string
  // Format: postgresql://user:pass@host:port/db
  const hostPart = connectionString.split('@')[1].split('/')[0];
  const host = hostPart.split(':')[0];
  const port = parseInt(hostPart.split(':')[1] || '5432');

  console.log(`[DATABASE] Resolving host: ${host}...`);
  
  let targetHost = host;

  try {
    // Attempt to resolve to an IPv4 address to bypass environment-specific DNS/IPv6 issues
    const ips = await dns.resolve4(host);
    if (ips && ips.length > 0) {
      targetHost = ips[0];
      console.log(`[DATABASE] Host resolved to IP: ${targetHost}`);
    }
  } catch (dnsError: any) {
    console.warn(`[DATABASE] DNS resolution failed, falling back to hostname. Error: ${dnsError.message}`);
  }

  // Safely parse credentials from the original connection string
  const url = new URL(connectionString);
  const user = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  const database = decodeURIComponent(url.pathname.substring(1));

  const pool = new Pool({
    host: targetHost,
    port: port,
    user: user,
    password: password,
    database: database,
    connectionTimeoutMillis: 60000, 
    idleTimeoutMillis: 30000,      
    max: 20,                       
    allowExitOnIdle: false,
    ssl: {
      servername: host, // Crucial: Maintain original host for SNI
      rejectUnauthorized: false
    }
  });

  pool.on('error', (err) => {
    console.error('[DATABASE POOL ERROR]', err.message);
  });

  return pool;
}

// Initialize the pool asynchronously
export const pool = await createResilientPool();
console.log(`[DATABASE] Pool initialized (Resilient IP + SNI Mode)`);

export const db = drizzle(pool, { schema });

// Keepalive: Neon serverless suspends after ~5 min of inactivity
const KEEPALIVE_INTERVAL_MS = 4 * 60 * 1000; // 4 minutes
setInterval(() => {
  pool.query('SELECT 1').catch(() => {
    // Silently swallow
  });
}, KEEPALIVE_INTERVAL_MS).unref(); 

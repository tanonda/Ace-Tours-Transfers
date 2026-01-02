import "dotenv/config";
import { Pool, type PoolConfig } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

console.log("Initializing database connection...");

// Connection configuration
const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 30000, // 30 seconds
  max: 20, // Increased for stability
  idleTimeoutMillis: 60000, // 60 seconds
};

export const pool = new Pool(poolConfig);

// Add error handling for the pool
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

pool.on('connect', () => {
  // Silent in development to reduce noise if needed, but keeping for now with reduced frequency
  if (process.env.NODE_ENV === 'production') {
    console.log('Database connected successfully');
  }
});

export const db = drizzle(pool, { schema });

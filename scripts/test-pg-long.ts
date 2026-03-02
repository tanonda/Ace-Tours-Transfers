import "dotenv/config";
import pkg from 'pg';
import dns from "node:dns";

const { Pool } = pkg;

if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

async function testConnection() {
  const connectionString = process.env.DATABASE_URL;

  console.log("Connecting with pg (TCP) + ipv4first + 30s timeout...");
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 30000,
  });

  try {
    const start = Date.now();
    const res = await pool.query('SELECT NOW() as now');
    const end = Date.now();
    
    console.log("✅ Connection successful!");
    console.log("Latency:", end - start, "ms");
    console.log("Time:", res.rows[0].now);
    
    await pool.end();
  } catch (err: any) {
    console.error("❌ Connection failed!");
    console.error(err);
  }
}

testConnection();

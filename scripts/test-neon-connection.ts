import "dotenv/config";
import pkg from 'pg';
const { Pool } = pkg;

async function testConnection() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("❌ DATABASE_URL is not set in .env");
    process.exit(1);
  }

  console.log("Connecting to Neon...");
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 5000,
  });

  try {
    const start = Date.now();
    const res = await pool.query('SELECT NOW(), VERSION()');
    const end = Date.now();
    
    console.log("✅ Connection successful!");
    console.log(`⏱️ Latency: ${end - start}ms`);
    console.log(`📅 Server Time: ${res.rows[0].now}`);
    console.log(`📦 Postgres Version: ${res.rows[0].version}`);
    
    await pool.end();
    process.exit(0);
  } catch (err: any) {
    console.error("❌ Connection failed!");
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

testConnection();

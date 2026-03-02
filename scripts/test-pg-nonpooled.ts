import "dotenv/config";
import pkg from 'pg';
import dns from "node:dns";

const { Pool } = pkg;

// Apply the fix
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder("ipv4first");
    console.log("Forced IPv4 first");
}

async function testConnection() {
    const connectionString = process.env.DATABASE_URL?.replace("-pooler", "");

    if (!connectionString) {
        console.error("❌ DATABASE_URL is not set in .env");
        process.exit(1);
    }

    console.log("Connecting (non-pooled) to:", connectionString.split('@')[1] || connectionString);
    const pool = new Pool({
        connectionString,
        connectionTimeoutMillis: 10000,
    });

    try {
        const start = Date.now();
        console.log("Sending query...");
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
        console.error("Error Name:", err.name);
        console.error("Error Message:", err.message);
        console.error("Error Code:", err.code);
        process.exit(1);
    }
}

testConnection();

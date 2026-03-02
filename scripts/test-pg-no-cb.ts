import "dotenv/config";
import pkg from 'pg';
import dns from "node:dns";

const { Pool } = pkg;

// Apply the DNS fix
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder("ipv4first");
    console.log("Forced IPv4 first");
}

async function testConnection() {
    let connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
        console.error("❌ DATABASE_URL is not set in .env");
        process.exit(1);
    }

    // Remove channel_binding
    connectionString = connectionString.replace(/&channel_binding=[^&]+/, '').replace(/\?channel_binding=[^&]+&/, '?').replace(/\?channel_binding=[^&]+$/, '');

    console.log("Connecting (no channel_binding) to:", connectionString.split('@')[1] || connectionString);
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

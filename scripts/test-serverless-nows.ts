import "dotenv/config";
import { Pool, neonConfig } from '@neondatabase/serverless';
import dns from "node:dns";

// Apply the DNS fix
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder("ipv4first");
    console.log("Forced IPv4 first");
}

// Disable WebSockets (default behavior but being explicit)
neonConfig.webSocketConstructor = undefined;

async function testConnection() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
        console.error("❌ DATABASE_URL is not set in .env");
        process.exit(1);
    }

    console.log("Connecting (serverless, NO WS) to:", connectionString.split('@')[1] || connectionString);
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
        process.exit(1);
    }
}

testConnection();

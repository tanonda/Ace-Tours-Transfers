import "dotenv/config";
import pkg from 'pg';
const { Pool } = pkg;
import dns from "node:dns";

if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder("ipv4first");
}

async function checkTable() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
        console.error("❌ DATABASE_URL is not set");
        process.exit(1);
    }

    console.log("Connecting to check table structure...");
    const pool = new Pool({
        connectionString,
        connectionTimeoutMillis: 10000,
    });

    try {
        const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'bookings'
    `);

        console.log("✅ Columns in 'bookings' table:");
        res.rows.forEach(row => {
            console.log(`- ${row.column_name} (${row.data_type})`);
        });

        const hasUpdatedAt = res.rows.some(row => row.column_name === 'updated_at');
        if (hasUpdatedAt) {
            console.log("✨ 'updated_at' column EXISTS.");
        } else {
            console.log("❌ 'updated_at' column is MISSING.");
        }

        await pool.end();
        process.exit(0);
    } catch (err: any) {
        console.error("❌ Failed to query database!");
        console.error(err);
        process.exit(1);
    }
}

checkTable();

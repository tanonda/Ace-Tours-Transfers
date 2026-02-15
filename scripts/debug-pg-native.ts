
import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
});

async function run() {
    console.log("Testing native pg driver...");
    try {
        const client = await pool.connect();
        console.log("Connected successfully!");
        const res = await client.query("SELECT 1 as val");
        console.log("Query Result:", res.rows[0]);
        client.release();
        pool.end();
    } catch (error) {
        console.error("PG Connection Error:", error);
    }
}

run();

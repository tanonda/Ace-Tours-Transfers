
import "dotenv/config";
import { pool } from "../server/db";

async function run() {
    console.log("Connecting to database...");
    try {
        const client = await pool.connect();
        console.log("Connected! Running query...");
        const res = await client.query('SELECT 1 as val');
        console.log("Query result:", res.rows[0]);
        client.release();
        console.log("Done.");
        process.exit(0);
    } catch (err: any) {
        console.error("Database Error:", err);
        console.error("Stack:", err.stack);
        process.exit(1);
    }
}

run();

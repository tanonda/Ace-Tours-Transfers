
import pg from 'pg';
import "dotenv/config";

async function main() {
    console.log("DATABASE_URL present:", !!process.env.DATABASE_URL);
    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 10000
    });

    console.log("Attempting raw pool.connect()...");
    try {
        const client = await pool.connect();
        console.log("✅ Client connected!");
        const res = await client.query("SELECT now() as time");
        console.log("✅ Query successful:", res.rows[0]);
        client.release();
    } catch (e: any) {
        console.error("❌ Connection failed!");
        console.error(e);
    } finally {
        await pool.end();
        console.log("Pool ended.");
    }
}
main();

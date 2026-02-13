
import pg from 'pg';
import "dotenv/config";

async function main() {
    console.log("🛠️ Manually applying unique index to tour_instances...");

    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 30000
    });

    try {
        const client = await pool.connect();

        console.log("Creating unique index idx_tour_instances_unique...");
        // First drop if it exists (as a non-unique one)
        await client.query("DROP INDEX IF EXISTS idx_tour_instances_unique");

        // Create unique index
        await client.query(`
            CREATE UNIQUE INDEX idx_tour_instances_unique 
            ON tour_instances (tour_id, service_date, time_slot)
        `);

        console.log("✅ Unique index created successfully.");

        client.release();
        await pool.end();
        process.exit(0);
    } catch (e: any) {
        console.error("❌ Failed to create unique index:", e);
        process.exit(1);
    }
}
main();

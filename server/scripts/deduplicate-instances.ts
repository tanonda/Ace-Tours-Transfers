
import pg from 'pg';
import "dotenv/config";

async function main() {
    console.log("🛠️ Starting robust deduplication of tour_instances using raw pg...");

    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 30000
    });

    try {
        const client = await pool.connect();

        // 1. Clean up test data first
        console.log("🧹 Purging test data...");
        await client.query("DELETE FROM capacity_audit_log WHERE product_id LIKE 'load-test-%' OR product_id LIKE 'diag-%'");
        await client.query("DELETE FROM availability_holds WHERE booking_session_id LIKE 'load-session-%' OR booking_session_id LIKE 'diag-session-%'");
        await client.query("DELETE FROM tour_instances WHERE tour_id LIKE 'load-test-%' OR tour_id LIKE 'diag-%'");

        // 2. Find remaining duplicates
        const duplicates = await client.query(`
            SELECT tour_id, service_date, time_slot, COUNT(*) as count
            FROM tour_instances
            GROUP BY tour_id, service_date, time_slot
            HAVING COUNT(*) > 1
        `);

        if (duplicates.rows.length === 0) {
            console.log("✅ No duplicates remaining.");
            client.release();
            await pool.end();
            process.exit(0);
        }

        console.log(`Found ${duplicates.rows.length} sets of production duplicates to merge.`);

        for (const row of duplicates.rows) {
            console.log(`\nMerging set: tour_id=${row.tour_id}, date=${row.service_date}, slot=${row.time_slot}`);

            let queryText;
            let params;
            if (row.time_slot === null) {
                queryText = `SELECT id, confirmed_count, held_count, blocked_count FROM tour_instances WHERE tour_id = $1 AND service_date = $2 AND time_slot IS NULL ORDER BY updated_at ASC`;
                params = [row.tour_id, row.service_date];
            } else {
                queryText = `SELECT id, confirmed_count, held_count, blocked_count FROM tour_instances WHERE tour_id = $1 AND service_date = $2 AND time_slot = $3 ORDER BY updated_at ASC`;
                params = [row.tour_id, row.service_date, row.time_slot];
            }

            const instances = (await client.query(queryText, params)).rows;
            const primaryId = instances[0].id;
            const redundantIds = instances.slice(1).map(i => i.id);

            const totalConfirmed = instances.reduce((sum, i) => sum + i.confirmed_count, 0);
            const totalHeld = instances.reduce((sum, i) => sum + i.held_count, 0);
            const totalBlocked = instances.reduce((sum, i) => sum + i.blocked_count, 0);

            console.log(`- Primary ID: ${primaryId}`);
            console.log(`- Redundant IDs: ${redundantIds.join(', ')}`);
            console.log(`- Merged Counts: Confirmed=${totalConfirmed}, Held=${totalHeld}, Blocked=${totalBlocked}`);

            try {
                await client.query('BEGIN');

                // Update primary record
                await client.query(
                    `UPDATE tour_instances SET confirmed_count = $1, held_count = $2, blocked_count = $3, updated_at = NOW() WHERE id = $4`,
                    [totalConfirmed, totalHeld, totalBlocked, primaryId]
                );

                // Re-link related tables
                for (const oldId of redundantIds) {
                    await client.query(`UPDATE bookings SET tour_instance_id = $1 WHERE tour_instance_id = $2`, [primaryId, oldId]);
                    await client.query(`UPDATE availability_holds SET tour_instance_id = $1 WHERE tour_instance_id = $2`, [primaryId, oldId]);
                    await client.query(`UPDATE capacity_audit_log SET tour_instance_id = $1 WHERE tour_instance_id = $2`, [primaryId, oldId]);
                    await client.query(`DELETE FROM tour_instances WHERE id = $1`, [oldId]);
                }

                await client.query('COMMIT');
                console.log(`✅ Set merged successfully.`);
            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`❌ Failed to merge set:`, err);
            }
        }

        client.release();
        await pool.end();
        console.log("\n🚀 All duplicates resolved. You can now run 'npx drizzle-kit push'.");
        process.exit(0);
    } catch (e: any) {
        console.error("❌ Deduplication failed:", e);
        process.exit(1);
    }
}
main();

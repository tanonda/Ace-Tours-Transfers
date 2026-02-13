
import { db } from "../db.js";
import { sql } from "drizzle-orm";

async function main() {
    console.log("🔍 Checking for duplicates in tour_instances...");
    try {
        const duplicates = await db.execute(sql`
            SELECT tour_id, service_date, time_slot, COUNT(*) as count
            FROM tour_instances
            GROUP BY tour_id, service_date, time_slot
            HAVING COUNT(*) > 1
        `);

        if (duplicates.rows.length === 0) {
            console.log("✅ No duplicates found.");
            process.exit(0);
        }

        console.log(`Found ${duplicates.rows.length} sets of duplicates.`);

        for (const row of duplicates.rows) {
            console.log(`\n--- Set: tour_id=${row.tour_id}, date=${row.service_date}, slot=${row.time_slot} ---`);

            let query;
            if (row.time_slot === null) {
                query = sql`
                    SELECT id, confirmed_count, held_count, blocked_count
                    FROM tour_instances
                    WHERE tour_id = ${row.tour_id} 
                      AND service_date = ${row.service_date}
                      AND time_slot IS NULL
                `;
            } else {
                query = sql`
                    SELECT id, confirmed_count, held_count, blocked_count
                    FROM tour_instances
                    WHERE tour_id = ${row.tour_id} 
                      AND service_date = ${row.service_date}
                      AND time_slot = ${row.time_slot}
                `;
            }

            const details = await db.execute(query);
            console.table(details.rows);
        }
        process.exit(0);
    } catch (e: any) {
        console.error("❌ Failed to query duplicates:", e);
        process.exit(1);
    }
}
main();

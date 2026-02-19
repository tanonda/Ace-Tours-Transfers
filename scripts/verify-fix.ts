import "dotenv/config";
import { db } from "../server/db.js";
import { sql } from "drizzle-orm";

async function verify() {
    try {
        const columns = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bookings'
    `);
        const columnNames = columns.rows.map((row: any) => row.column_name);
        console.log("Columns in 'bookings' table:", columnNames);

        const hasUpdatedAt = columnNames.includes('updated_at');
        console.log("\nHas 'updated_at' column:", hasUpdatedAt);

        if (!hasUpdatedAt) {
            console.error("CRITICAL: 'updated_at' column is still missing!");
        } else {
            console.log("SUCCESS: 'updated_at' column is present.");
        }

    } catch (err) {
        console.error("Error during verification:", err);
    } finally {
        process.exit(0);
    }
}

verify();

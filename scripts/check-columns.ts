import "dotenv/config";
import { db } from "../server/db.js";
import { sql } from "drizzle-orm";

async function checkColumns() {
    try {
        const result = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'bookings'
    `);
        console.log("Columns in 'bookings' table:");
        console.log(result.rows.map((row: any) => `${row.column_name} (${row.data_type})`));

        const migrations = await db.execute(sql`
      SELECT * FROM "__drizzle_migrations"
    `);
        console.log("\nApplied migrations:");
        console.log(migrations.rows);
    } catch (err) {
        console.error("Error checking columns/migrations:", err);
    } finally {
        process.exit(0);
    }
}

checkColumns();

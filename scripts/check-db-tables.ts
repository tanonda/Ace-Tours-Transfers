import "dotenv/config";
import { db } from "../server/db.js";
import { sql } from "drizzle-orm";

async function check() {
    try {
        console.log("Checking database connection...");
        await db.execute(sql`SELECT 1`);
        console.log("Connection successful");

        console.log("Listing ALL tables across ALL schemas...");
        const allTables = await db.execute(sql`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
    `);
        console.log(JSON.stringify(allTables.rows, null, 2));

        const tableList = (allTables as any).rows?.map((r: any) => r.table_name) || [];

        console.log("\n--- Specific Table Checks ---");
        const checkTables = ['__drizzle_migrations', 'drizzle_migrations', 'bookings', 'content_blocks'];
        for (const table of checkTables) {
            console.log(`Table '${table}' exists: ${tableList.includes(table)}`);
        }

    } catch (error) {
        console.error("Database check failed:", error);
    } finally {
        process.exit(0);
    }
}

check();

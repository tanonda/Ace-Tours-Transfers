
import "dotenv/config";
import { db } from "../server/db.js";
import { sql } from "drizzle-orm";

async function main() {
  try {
    console.log("Checking columns of tours...");
    const columns = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tours'
    `);
    console.log("Columns:", columns.rows);
  } catch (error: any) {
    console.error("Tours table diagnostic failed:", error);
  } finally {
    process.exit(0);
  }
}

main();

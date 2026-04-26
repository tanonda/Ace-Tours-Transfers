
import "dotenv/config";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Checking tables...");
  const result = await db.execute(sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `);
  console.log("Tables found:", result.rows.map((r: any) => r.table_name));
  process.exit(0);
}

main().catch(console.error);

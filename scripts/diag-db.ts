
import "dotenv/config";
import { db } from "../server/db.js";
import { siteSettings } from "../shared/schema.js";
import { sql } from "drizzle-orm";

async function main() {
  try {
    console.log("Checking database connection...");
    await db.execute(sql`SELECT 1`);
    console.log("Connection OK.");

    console.log("Checking for site_settings table...");
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'site_settings'
    `);
    
    if (tables.rows.length === 0) {
      console.log("site_settings table does NOT exist!");
    } else {
      console.log("site_settings table exists.");
      
      console.log("Checking columns of site_settings...");
      const columns = await db.execute(sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'site_settings'
      `);
      console.log("Columns:", columns.rows);

      console.log("Checking for data in site_settings...");
      const settings = await db.select().from(siteSettings);
      console.log("Settings count:", settings.length);
      console.log("Settings:", settings);
    }

    console.log("Checking __drizzle_migrations...");
    try {
      const migrations = await db.execute(sql`SELECT * FROM "__drizzle_migrations"`);
      console.log("Migrations count:", migrations.rows.length);
      if (migrations.rows.length > 0) {
        console.log("Last migration:", migrations.rows[migrations.rows.length - 1]);
      }
    } catch (e: any) {
      console.log("__drizzle_migrations table not found or error:", e.message);
    }

  } catch (error: any) {
    console.error("Database diagnostic failed:", error);
  } finally {
    process.exit(0);
  }
}

main();

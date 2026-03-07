import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

async function main() {
  console.log("Adding geo_targeting to products table using Neon serverless...");
  const sql = neon(process.env.DATABASE_URL!);
  try {
    await sql`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "geo_targeting" text;`;
    console.log("Success: geo_targeting column added.");
    await sql`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "listing_order" integer DEFAULT 0;`;
    console.log("Success: listing_order column added.");
  } catch (err: any) {
    if (err.message.includes("already exists")) {
      console.log("Column already exists.");
    } else {
      console.error("Migration error:", err);
    }
  }
  process.exit(0);
}
main().catch(console.error);

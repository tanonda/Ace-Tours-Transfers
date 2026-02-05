
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

async function test(name, url) {
  console.log(`\nTesting ${name}...`);
  const sql = neon(url);
  try {
    const result = await sql`SELECT count(*) FROM tours`;
    console.log(`✅ ${name} Success! Count:`, result[0].count);
  } catch (err) {
    console.error(`❌ ${name} Failed:`, err.message);
  }
}

async function run() {
  const url = process.env.DATABASE_URL;
  
  if (!url) {
    console.error("❌ Error: DATABASE_URL environment variable is not set.");
    console.log("Please check your .env file.");
    process.exit(1);
  }

  // Use the same URL for both tests if only one is provided via env
  // This script was originally for comparing pooler vs direct, 
  // but for safety in production/CI we use the configured env var.
  await test("Database Connection", url);
  
  process.exit(0);
}

run();

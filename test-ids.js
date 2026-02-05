
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

async function run() {
  const url = process.env.DATABASE_URL.split('?')[0];
  const sql = neon(url);
  try {
    console.log("Fetching tour IDs...");
    const result = await sql`SELECT id FROM tours`;
    console.log("✅ Success! IDs:", result);
    process.exit(0);
  } catch (err) {
    console.error("❌ Failed:", err.message);
    process.exit(1);
  }
}

run();

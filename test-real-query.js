
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

async function run() {
  const url = process.env.DATABASE_URL.split('?')[0];
  console.log(`Connecting to: ${url}`);
  const sql = neon(url);
  try {
    console.log("Fetching tours...");
    const result = await sql`SELECT id, price, child_price FROM tours`;
    console.log("✅ Success! Fetched", result.length, "tours.");
    console.log("Sample tour:", result[0]);
    process.exit(0);
  } catch (err) {
    console.error("❌ Failed:", err.message);
    process.exit(1);
  }
}

run();

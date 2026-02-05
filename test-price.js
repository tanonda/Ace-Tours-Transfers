
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

async function run() {
  const url = process.env.DATABASE_URL.split('?')[0];
  const sql = neon(url);
  try {
    console.log("Fetching price...");
    const result = await sql`SELECT price FROM tours LIMIT 1`;
    console.log("✅ Success! Price:", result[0].price);
    process.exit(0);
  } catch (err) {
    console.error("❌ Failed:", err.message);
    process.exit(1);
  }
}

run();

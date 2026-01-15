
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

async function test() {
  const sql = neon(process.env.DATABASE_URL);
  try {
    console.log("Testing count(*)...");
    const count = await sql`SELECT count(*) FROM tours`;
    console.log("Count:", count);
    
    console.log("Testing limited select...");
    const tours = await sql`SELECT id FROM tours LIMIT 1`;
    console.log("Tour ID:", tours);
    
    process.exit(0);
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  }
}
test();

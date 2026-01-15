
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

async function test() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL missing");
    process.exit(1);
  }
  
  console.log("Connecting with neon()...");
  const sql = neon(process.env.DATABASE_URL);
  
  try {
    const result = await sql`SELECT 1 as result`;
    console.log("Success! Result:", result);
    process.exit(0);
  } catch (err) {
    console.error("Neon query failed:", err);
    process.exit(1);
  }
}

test();


import { neon } from "@neondatabase/serverless";
import "dotenv/config";

async function test(size) {
  const url = process.env.DATABASE_URL.split('?')[0];
  const sql = neon(url);
  console.log(`Testing with padding size: ${size}...`);
  try {
    const result = await sql`SELECT 1 as result, repeat('x', ${size}) as padding`;
    console.log(`✅ Success for size ${size}`);
  } catch (err) {
    console.error(`❌ Failed for size ${size}:`, err.message);
  }
}

async function run() {
  await test(100);
  await test(1000);
  await test(10000);
  process.exit(0);
}

run();

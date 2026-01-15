
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
  const poolerUrl = "postgresql://neondb_owner:npg_tQGrj0ezm6vq@ep-bitter-frog-a7zxak3x-pooler.ap-southeast-2.aws.neon.tech/neondb";
  const directUrl = "postgresql://neondb_owner:npg_tQGrj0ezm6vq@ep-bitter-frog-a7zxak3x.ap-southeast-2.aws.neon.tech/neondb";
  
  await test("Pooler", poolerUrl);
  await test("Direct", directUrl);
  
  process.exit(0);
}

run();

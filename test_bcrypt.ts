import "dotenv/config";
import bcrypt from "bcryptjs";

async function test() {
  const p = "Salexis2026";
  const h = await bcrypt.hash(p, 12);
  const match = await bcrypt.compare(p, h);
  console.log(`Original: ${p}`);
  console.log(`Hash: ${h}`);
  console.log(`Match: ${match}`);
  process.exit(0);
}

test();

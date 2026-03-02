import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import dns from "node:dns";

if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

async function test() {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  
  console.log("Connecting with neon (HTTP) + ipv4first...");
  const sql = neon(url);

  try {
    const res = await sql("SELECT NOW() as now");
    console.log("✅ Success!", res[0].now);
  } catch (err: any) {
    console.error("❌ Failed!");
    console.error(err);
  }
}

test();

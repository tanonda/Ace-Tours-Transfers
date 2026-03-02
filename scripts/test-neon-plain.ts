import "dotenv/config";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import dns from "node:dns";

if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

neonConfig.webSocketConstructor = ws;
neonConfig.pipelineTLS = false; // Try disabling TLS pipelining

async function test() {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  
  console.log("Connecting with pipelineTLS = false...");
  const pool = new Pool({ connectionString: url });

  try {
    const res = await pool.query("SELECT NOW() as now");
    console.log("✅ Success!", res.rows[0].now);
  } catch (err: any) {
    console.error("❌ Failed!");
    console.error(err);
  } finally {
    await pool.end();
  }
}

test();

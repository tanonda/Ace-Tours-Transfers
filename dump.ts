import "dotenv/config";
import { db } from "./server/db.js";
import { cmsContent } from "./shared/schema.js";

async function run() {
  const all = await db.select().from(cmsContent);
  console.log(JSON.stringify(all, null, 2));
  process.exit(0);
}

run();

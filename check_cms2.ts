import { db } from "./server/db";
import { contentBlocks } from "./shared/schema";
async function main() {
  const blocks = await db.select().from(contentBlocks);
  console.log("All Blocks:", blocks);
  process.exit(0);
}
main().catch(console.error);

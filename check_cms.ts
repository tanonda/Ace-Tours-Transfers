import { db } from "./server/db";
import { contentBlocks, cmsContent } from "./shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const blocks = await db.select().from(contentBlocks).where(eq(contentBlocks.slug, "home"));
  console.log("Blocks:", blocks);
  
  if (blocks.length > 0) {
    const content = await db.select().from(cmsContent).where(eq(cmsContent.blockSlug, "home"));
    console.log("Content:");
    content.forEach(c => console.log(`- ${c.contentKey}: ${c.value}`));
  }
  
  process.exit(0);
}

main().catch(console.error);

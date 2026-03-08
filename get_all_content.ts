import { db } from "./server/db";
import { products, contentBlocks } from "./shared/schema";

async function main() {
  const allProducts = await db.select().from(products);
  console.log("--- PRODUCTS TO OPTIMIZE ---");
  for (const p of allProducts) {
    if (!['Vehicle Rental', 'Hospitality Package', 'Half Day Tour'].includes(p.title)) {
      console.log(`[${p.category.toUpperCase()}] ${p.title} (ID: ${p.id})`);
    }
  }

  const allBlocks = await db.select().from(contentBlocks);
  console.log("\n--- CMS BLOCKS TO OPTIMIZE ---");
  for (const b of allBlocks) {
    console.log(`[CMS] ${b.slug}: ${b.label}`);
  }

  process.exit(0);
}
main().catch(console.error);

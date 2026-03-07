import { db } from "./server/db";
import { products } from "./shared/schema";

async function main() {
  const allProducts = await db.select().from(products);
  for (const p of allProducts) {
    console.log(`\n--- ${p.category.toUpperCase()}: ${p.title} (ID: ${p.id}) ---`);
    console.log(`Description: ${p.description}`);
    console.log(`SEO Title: ${p.seoTitle}`);
    console.log(`SEO Desc: ${p.seoDescription}`);
    console.log(`Keywords: ${p.seoKeywords}`);
    console.log(`Geo Target: ${p.geoTargeting}`);
  }
  process.exit(0);
}
main().catch(console.error);

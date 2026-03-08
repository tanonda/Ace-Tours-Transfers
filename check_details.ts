import { db } from "./server/db";
import { products } from "./shared/schema";

async function main() {
  const allProducts = await db.select({
    id: products.id,
    title: products.title,
    category: products.category,
    image: products.image,
  }).from(products);

  console.log("\nAll Products with Images:");
  allProducts.sort((a,b) => a.title.localeCompare(b.title)).forEach(p => {
    console.log(`- [${p.id.substring(0,8)}] ${p.title} (${p.category})`);
    console.log(`  Img: ${p.image}`);
  });

  process.exit(0);
}

main().catch(console.error);

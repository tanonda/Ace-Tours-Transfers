import { db } from "./server/db";
import { products } from "./shared/schema";

async function main() {
  const allProducts = await db.select({
    id: products.id,
    title: products.title,
    category: products.category,
    image: products.image,
  }).from(products);

  const missingImageProducts = allProducts.filter(p => !p.image || p.image.includes("stock_images") || p.image.includes("placehold.co") || p.image.trim() === "");

  console.log(`\nFound ${missingImageProducts.length} products needing new pictures:`);
  missingImageProducts.forEach(p => console.log(`- [${p.id.substring(0,8)}] ${p.title} (${p.category})`));

  process.exit(0);
}

main().catch(console.error);

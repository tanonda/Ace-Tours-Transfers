import { db } from "./server/db";
import { products } from "./shared/schema";

async function main() {
  const allProducts = await db.select({
    id: products.id,
    title: products.title,
    category: products.category,
    image: products.image,
    description: products.description,
  }).from(products);

  console.log("Total products:", allProducts.length);
  
  const titleCounts = new Map<string, number>();
  for (const p of allProducts) {
    titleCounts.set(p.title, (titleCounts.get(p.title) || 0) + 1);
  }

  const duplicates = Array.from(titleCounts.entries()).filter(([_, count]) => count > 1);
  console.log("\nPossible Duplicates (exact title match):");
  console.log(duplicates);

  const missingImages = allProducts.filter(p => !p.image || p.image.trim() === "" || p.image.includes("placeholder") || p.image === "https://placehold.co/600x400/png");
  console.log("\nProducts with missing/placeholder images:");
  missingImages.forEach(p => console.log(`- ${p.title} (${p.category}): ${p.image}`));

  // Also print all titles to spot "similar" but not exact match duplicates
  console.log("\nAll Product Titles:");
  allProducts.sort((a,b) => a.title.localeCompare(b.title)).forEach(p => console.log(`- ${p.title} (${p.category}) [ID: ${p.id.substring(0,6)}]`));

  process.exit(0);
}

main().catch(console.error);

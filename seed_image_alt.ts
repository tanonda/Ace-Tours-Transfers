import { db } from "./server/db";
import { products } from "./shared/schema";
import { isNull, eq, or } from "drizzle-orm";

async function main() {
  console.log("Seeding missing imageAlt texts...");
  
  const allProducts = await db.select().from(products).where(
    or(isNull(products.imageAlt), eq(products.imageAlt, ""))
  );
  
  console.log(`Found ${allProducts.length} products needing imageAlt text.`);
  
  for (const p of allProducts) {
    // Generate a rich alt text combining title + geo
    const baseTitle = p.seoTitle || p.title;
    const geo = p.geoTargeting || "Port Vila, Vanuatu";
    const newAlt = `${baseTitle} - ${geo} Tours and Transfers`;
    
    await db.update(products).set({ imageAlt: newAlt }).where(eq(products.id, p.id));
    console.log(`Updated ${p.title} -> "${newAlt}"`);
  }
  
  console.log("Image alt text seeding complete.");
  process.exit(0);
}

main().catch(console.error);

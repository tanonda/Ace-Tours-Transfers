import { db } from "./server/db";
import { products } from "./shared/schema";
import { eq, like } from "drizzle-orm";

async function main() {
  console.log("Fixing Event Transfer Image Mapping...");

  const url = "https://res.cloudinary.com/dwro1dh5q/image/upload/v1772983008/ace-tours-products/events-transfer-package-group-logistics-port-vila.webp";
  
  await db.update(products).set({ image: url }).where(like(products.title, "%Event%Transfer%"));
  console.log("Update Complete");
  
  process.exit(0);
}

main().catch(console.error);

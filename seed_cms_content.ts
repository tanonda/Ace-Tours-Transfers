import "dotenv/config";
import { db, initializeDatabase } from "./server/db";
import { cmsContent } from "./shared/schema";

async function main() {
  await initializeDatabase();
  console.log("Seeding cms_content table...");

  const heroContent = [
    { blockSlug: "home-page", contentKey: "hero_title_part1", value: "Experience Vanuatu's", contentType: "text" },
    { blockSlug: "home-page", contentKey: "hero_title_part2", value: "Natural Beauty", contentType: "text" },
    { blockSlug: "home-page", contentKey: "hero_subtitle", value: "Your trusted partner for premium airport transfers, reliable vehicle hire, and unforgettable guided island tours in Port Vila.", contentType: "text" }
  ];

  for (const item of heroContent) {
     await db.insert(cmsContent).values(item).onConflictDoUpdate({
         target: [cmsContent.blockSlug, cmsContent.contentKey],
         set: { value: item.value }
     }).catch(async (e) => {
         // Fallback if no unique constraint on blockSlug + contentKey
         console.warn("No unique constraint, doing delete-insert instead.");
         const { eq, and } = await import("drizzle-orm");
         await db.delete(cmsContent).where(
             and(eq(cmsContent.blockSlug, item.blockSlug), eq(cmsContent.contentKey, item.contentKey))
         );
         await db.insert(cmsContent).values(item);
     });
  }

  const aboutContent = [
    { blockSlug: "about", contentKey: "title", value: "Vanuatu’s Premier Transport & Tour Operator", contentType: "text" },
    { blockSlug: "about", contentKey: "content", value: "<p>Welcome to <strong>Ace Tours & Transfers Vanuatu</strong>. Based in the heart of Port Vila on Efate Island, we are a passionate, 100% locally-owned and operated business dedicated to showcasing the incredible beauty, culture, and hospitality of our island home.</p><p>Whether you need a swift, reliable airport transfer to your resort, a comfortable rental vehicle to explore at your own pace, or an unforgettable guided tour to our stunning waterfalls and hidden beaches, the Ace Tours family is here to make your Vanuatu vacation absolutely perfect.</p><p>With a modern fleet of air-conditioned vehicles and a team of knowledgeable, friendly local guides, we guarantee a safe, comfortable, and deeply authentic Vanuatu experience.</p>", contentType: "richtext" }
  ];

  for (const item of aboutContent) {
     const { eq, and } = await import("drizzle-orm");
     await db.delete(cmsContent).where(
         and(eq(cmsContent.blockSlug, item.blockSlug), eq(cmsContent.contentKey, item.contentKey))
     );
     await db.insert(cmsContent).values(item);
  }

  console.log("CMS Content seeded!");
  process.exit(0);
}

main().catch(console.error);

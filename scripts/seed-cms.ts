import "dotenv/config";
import { db } from "../server/db.js";
import { contentBlocks, siteSettings } from "../shared/schema.js";
import { eq } from "drizzle-orm";

async function seed() {
    try {
        console.log("Seeding CMS content and settings...");

        // 1. Seed Content Blocks
        const blocks = [
            {
                slug: "hero",
                label: "Hero Section",
                description: "Main landing page hero section",
                enabled: true,
                config: {
                    titlePart1: "Experience the real",
                    titlePart2: "vanuatu",
                    backgroundImage: "https://res.cloudinary.com/dwro1dh5q/image/upload/v1765063929/ace-tours-assets/ace_tours_hero_beach.jpg"
                }
            },
            {
                slug: "featured-tours",
                label: "Featured Tours",
                description: "Selected tours displayed on home page",
                enabled: true,
                config: {}
            }
        ];

        for (const block of blocks) {
            const existing = await db.select().from(contentBlocks).where(eq(contentBlocks.slug, block.slug)).limit(1);
            if (existing.length === 0) {
                await db.insert(contentBlocks).values(block);
                console.log(`Created content block: ${block.slug}`);
            } else {
                console.log(`Content block already exists: ${block.slug}`);
            }
        }

        // 2. Seed Site Settings
        const settings = [
            {
                key: "whatsapp_number",
                value: { number: "+678 7744444", label: "WhatsApp" }
            },
            {
                key: "whatsapp_greeting",
                value: "Hi! I'm interested in booking a tour with Ace Tours."
            },
            {
                key: "site_email",
                value: "info@acetours.vu"
            },
            {
                key: "site_phone",
                value: "+678 7744444"
            }
        ];

        for (const setting of settings) {
            const existing = await db.select().from(siteSettings).where(eq(siteSettings.key, setting.key)).limit(1);
            if (existing.length === 0) {
                await db.insert(siteSettings).values(setting);
                console.log(`Created site setting: ${setting.key}`);
            } else {
                console.log(`Site setting already exists: ${setting.key}`);
            }
        }

        console.log("Seeding complete!");
    } catch (error) {
        console.error("Seeding failed:", error);
    } finally {
        process.exit(0);
    }
}

seed();

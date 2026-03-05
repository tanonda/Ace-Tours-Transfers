import "dotenv/config";
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import { db } from "../server/db.js";
import { siteSettings } from "../shared/schema.js";

async function verify() {
    try {
        console.log("Verifying site settings...");
        const settings = await db.select().from(siteSettings);

        const keysToVerify = [
            "seo_site_name",
            "seo_title_template",
            "seo_default_description",
            "seo_default_keywords",
            "seo_canonical_url",
            "footer_backlinks",
            "schema_business_name"
        ];

        for (const key of keysToVerify) {
            const setting = settings.find(s => s.key === key);
            if (setting) {
                console.log(`✅ ${key}: Found`);
            } else {
                console.log(`❌ ${key}: NOT FOUND`);
            }
        }
    } catch (error) {
        console.error("Verification failed:", error);
    } finally {
        process.exit(0);
    }
}

verify();

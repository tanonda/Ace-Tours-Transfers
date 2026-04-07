import { initializeDatabase } from "./server/db.js";
import { siteSettings } from "./shared/schema.js";
import { eq } from "drizzle-orm";

async function updateLiveSettings() {
    const { db } = await initializeDatabase();
    
    console.log("Updating live site settings...");

    const whatsappResult = await db.update(siteSettings)
        .set({ value: { number: "+678 7114045", label: "WhatsApp" } })
        .where(eq(siteSettings.key, "whatsapp_number"))
        .returning();
    
    const phoneResult = await db.update(siteSettings)
        .set({ value: "+678 7114045" })
        .where(eq(siteSettings.key, "site_phone"))
        .returning();
    
    console.log("WhatsApp updated:", whatsappResult.length > 0);
    console.log("Phone updated:", phoneResult.length > 0);

    process.exit(0);
}

updateLiveSettings().catch((err) => {
    console.error("Update failed:", err);
    process.exit(1);
});

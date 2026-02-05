
import "dotenv/config";
import { db } from "../server/db.js";
import { siteSettings } from "../shared/schema.js";

async function main() {
  try {
    console.log("Seeding site settings...");
    
    const settings = [
      {
        key: "whatsapp",
        value: {
          enabled: true,
          greeting: "Hello! How can we help you with your Vanuatu adventure?",
          position: "bottom-right",
          phoneNumber: "+678 5551234"
        }
      },
      {
        key: "business_info",
        value: {
          name: "Ace Tours & Transfers Vanuatu",
          email: "info@acetours.vu",
          phone: "+678 5551234",
          address: "Port Vila, Vanuatu"
        }
      }
    ];

    for (const s of settings) {
      await db.insert(siteSettings).values({
        key: s.key,
        value: s.value
      }).onConflictDoUpdate({
        target: siteSettings.key,
        set: { value: s.value, updatedAt: new Date() }
      });
      console.log(`Seeded setting: ${s.key}`);
    }

    console.log("Seeding complete!");
  } catch (error: any) {
    console.error("Seeding failed:", error);
  } finally {
    process.exit(0);
  }
}

main();

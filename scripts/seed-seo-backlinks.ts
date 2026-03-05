
import "dotenv/config";
import { db } from "../server/db.js";
import { siteSettings } from "../shared/schema.js";

async function main() {
    try {
        console.log("Seeding SEO, Geo and Backlink settings...");

        const settings = [
            {
                key: "seo_site_name",
                value: "Ace Tours & Transfers Vanuatu"
            },
            {
                key: "seo_title_template",
                value: "{page} | Ace Tours Vanuatu"
            },
            {
                key: "seo_default_description",
                value: "Experience the best of Vanuatu with Ace Tours & Transfers. Reliable airport transfers, scenic Efate island tours, and premium vehicle hire in Port Vila."
            },
            {
                key: "seo_default_keywords",
                value: "Vanuatu tours, Port Vila transfers, Efate island, airport shuttle Vanuatu, luxury travel Port Vila"
            },
            {
                key: "seo_canonical_url",
                value: "https://acetours.vu"
            },
            {
                key: "footer_backlinks",
                value: "Vanuatu Tourism Office (VTO)|https://www.vanuatu.travel/\nTripAdvisor|https://www.tripadvisor.com/Attraction_Review-g294130-d13824040-Reviews-Ace_Tours_Transfers-Port_Vila_Efate.html\nViator|https://www.viator.com/Vanuatu-tours/Airport-and-Hotel-Transfers/d4474-g15"
            },
            {
                key: "schema_business_name",
                value: "Ace Tours & Transfers"
            },
            {
                key: "schema_business_type",
                value: "TravelAgency"
            },
            {
                key: "schema_phone",
                value: "+678 711 4045"
            },
            {
                key: "schema_address",
                value: "Port Vila, Efate, Vanuatu"
            },
            {
                key: "schema_price_range",
                value: "$$"
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

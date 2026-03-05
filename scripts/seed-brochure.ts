import "dotenv/config";
import { db } from "../server/db.js";
import { products as toursTable } from "../shared/schema.js";
import { eq } from "drizzle-orm";

async function main() {
    console.log("Seeding brochure products...");

    const brochureProducts = [
        {
            title: "Efate Scenic Tour",
            adultPriceCents: 9600,
            childPriceCents: 4800,
            price: "$120 per adult",
            childPrice: "$60 per child under 12",
            duration: "8am to 3pm",
            minPax: "min. 10 - 14 pax",
            defaultCapacity: 20,
            category: "tour",
            pricingType: "per_person",
            image: "/attached_assets/stock_images/vanuatu_rarru_waterf_a12f619f.jpg",
            description: [
                "Round island trip (8am to 3pm)",
                "Local chocolate factory visit",
                "Raru Waterfall for a cool dip",
                "Blue Lagoon for rope swinging",
                "Lunch at Banana Bay Beach Club",
                "Duty Free Shopping",
                "Price includes entrance fee to all stops and refreshments."
            ]
        },
        {
            title: "Roots & Routes Tour",
            adultPriceCents: 8000,
            childPriceCents: 4800,
            price: "$100 per head",
            childPrice: "$60 per child under 12",
            duration: "Typically 4-5 hours",
            minPax: "min. 10 - 14 pax",
            defaultCapacity: 20,
            category: "tour",
            pricingType: "per_person",
            image: "/attached_assets/stock_images/vanuatu_cultural_v_49e2db39.jpg",
            description: [
                "A taste for custom & tradition (Typically 4-5 hours)",
                "Cultural Village Tour & Experience",
                "Kava Tasting & Endemic Plant Tour (El Manaro Nakamal)",
                "Cultural Centre Visit",
                "Light refreshments provided"
            ]
        },
        {
            title: "VIP Transfer",
            adultPriceCents: 1200,
            childPriceCents: 650,
            price: "$15 per adult/VT1200",
            childPrice: "$80 per child/VT650 (Babies FOC)",
            duration: "Flexible",
            minPax: "Minimum pax: 5",
            defaultCapacity: 10,
            category: "transfer",
            pricingType: "per_person",
            image: "/attached_assets/stock_images/vanuatu_4wd_vehicle.jpg",
            description: [
                "VIP transfers also available upon request. Just you and your group.",
                "Ideal for personalized service.",
                "Babies FOC (Free of Charge)"
            ]
        },
        {
            title: "Event Transfer Package",
            groupPriceCents: 25000,
            adultPriceCents: 0,
            childPriceCents: 0,
            price: "VT 25,000",
            duration: "5-8 hours",
            minPax: null,
            defaultCapacity: 30,
            category: "transfer",
            pricingType: "group",
            image: "/attached_assets/stock_images/vanuatu_4wd_vehicle.jpg",
            description: [
                "Group transportation, coordination with event planners, and on-site support.",
                "Bus driver for the whole day",
                "Ideal for: Corporate events, conferences, and team-building activities.",
                "VT 25,000 - includes bus hire & driver (5-8 hours)",
                "VT 1,000/hr for 8hrs+"
            ]
        },
        {
            title: "Hospitality Package",
            groupPriceCents: 25000,
            adultPriceCents: 0,
            childPriceCents: 0,
            price: "VT 25,000",
            duration: "5-8 hours",
            minPax: null,
            defaultCapacity: 30,
            category: "transfer",
            pricingType: "group",
            image: "/attached_assets/stock_images/vanuatu_4wd_vehicle.jpg",
            description: [
                "Customized itineraries, let us pick you up and drop you for all your meetings.",
                "Ideal for: Hosting out-of-town clients and business partners.",
                "VT 25,000 - includes bus hire & driver (5-8 hours)",
                "VT 5000 pick up and drop off (two destination)",
                "Special: VT 18,000 bus hire for NGO's for the whole day."
            ]
        },
        {
            title: "Bus Hire for the day",
            groupPriceCents: 32000,
            adultPriceCents: 0,
            childPriceCents: 0,
            price: "A$400",
            duration: "Typically 5-8 hours",
            minPax: null,
            defaultCapacity: 30,
            category: "vehicle",
            pricingType: "group",
            image: "/attached_assets/stock_images/vanuatu_4wd_vehicle.jpg",
            description: [
                "Hire the bus for the day (Typically 5-8 hours)",
                "Choose your own stops",
                "Light refreshments provided",
                "You take care of your entrance fees"
            ]
        },
        {
            title: "Vehicle Rental",
            adultPriceCents: 0,
            childPriceCents: 0,
            groupPriceCents: 0,
            price: "Contact for prices",
            childPrice: null,
            duration: "24 hour +",
            minPax: null,
            defaultCapacity: 5,
            category: "vehicle",
            pricingType: "per_person",
            image: "/attached_assets/stock_images/vanuatu_4wd_vehicle.jpg",
            description: [
                "24 hour + vehicle hire",
                "Affordable price",
                "0 deposit",
                "Adequate Insurance cover",
                "Let us help you enjoy your stay in Port Vila. Travel safe.",
                "Inbox us for prices or call numbers listed (7737787 or 5907813)."
            ]
        }
    ];

    for (const product of brochureProducts) {
        const existing = await db.select().from(toursTable).where(eq(toursTable.title, product.title)).limit(1);
        if (existing.length === 0) {
            await db.insert(toursTable).values(product as any);
            console.log(`Created product: ${product.title}`);
        } else {
            // Update existing if properties differ (simplistic check, we will just update them to be safe)
            await db.update(toursTable).set(product as any).where(eq(toursTable.id, existing[0].id));
            console.log(`Updated existing product: ${product.title}`);
        }
    }

    console.log("Brochure seeding complete!");
    process.exit(0);
}

main().catch((err) => {
    console.error("Failed to seed brochure data:", err);
    process.exit(1);
});

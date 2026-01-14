import "dotenv/config";
import { storage } from "./storage.js";
import { Tour } from "../shared/schema.js";

async function updateToursAndTransfers() {
    console.log("Updating Tours and Transfers data...");

    const updates = [
        // TOURS
        {
            title: "Efate Scenic Tour",
            image: "https://res.cloudinary.com/dwro1dh5q/image/upload/v1765064618/ace-tours-assets/tour_scenic_efate.jpg",
            duration: "8am to 3pm",
            minPax: "Min 10-14 pax",
            description: [
                "Round island trip (8am to 3pm)",
                "Local chocolate factory visit",
                "Raru Waterfall for a cool dip",
                "Blue Lagoon for rope swinging",
                "Lunch at Banana Bay Beach Club",
                "Duty Free Shopping",
                "Includes entrance fees & refreshments"
            ]
        },
        {
            title: "Roots & Routes Tour",
            image: "https://res.cloudinary.com/dwro1dh5q/image/upload/v1765064621/ace-tours-assets/tour_cultural_roots.jpg",
            duration: "4-5 Hours",
            minPax: "10-14 pax",
            description: [
                "A taste for custom & tradition",
                "Cultural Village Tour & Experience",
                "Kava Tasting & Endemic Plant Tour (El Manaro Nakamal)",
                "Cultural Centre Visit",
                "Light refreshments provided",
                "Price includes entrance fees"
            ]
        },
        {
            title: "Bus Hire for the Day",
            image: "https://res.cloudinary.com/dwro1dh5q/image/upload/v1765064623/ace-tours-assets/tour_bus_hire.jpg",
            duration: "5-8 Hours",
            minPax: "Ideal for large groups",
            description: [
                "Hire the bus for the day",
                "Choose your own stops",
                "Light refreshments provided",
                "You take care of your entrance fees",
                "Ideal for large groups"
            ]
        },
        // TRANSFERS (Note: Titles in DB might differ slightly, checking seed.ts)
        // seed.ts: "Airport Transfer" vs data.ts: "Airport Transfer Package"
        // I will try to match "Airport Transfer" first, or create if missing.
        // Actually, I should check what's in the DB.
        // I'll assume seed.ts titles: "Airport Transfer", "Event Transfer", "Hotel Transfer" (data.ts had "Hospitality Package")

        // I will update based on seed.ts titles to be safe, OR I will update the titles to match data.ts
        // Let's update titles to match data.ts if we find the old ones.

        {
            oldTitle: "Airport Transfer",
            newTitle: "Airport Transfer Package",
            image: "https://res.cloudinary.com/dwro1dh5q/image/upload/v1765064625/ace-tours-assets/transfer_airport_van.jpg",
            duration: "24/7 Availability",
            minPax: "Min 5 pax",
            childPrice: "Babies FOC",
            description: [
                "Airport pickups and drop-offs",
                "Flight tracking included",
                "Meet-and-greet services",
                "VIP transfers available",
                "Babies travel free of charge"
            ],
            category: "transfer"
        },
        {
            oldTitle: "Event Transfer",
            newTitle: "Event Transfer Package",
            image: "https://res.cloudinary.com/dwro1dh5q/image/upload/v1765064625/ace-tours-assets/transfer_airport_van.jpg",
            duration: "5 Hours",
            minPax: "+ VT1000/hr extra",
            description: [
                "Group transportation for events",
                "Coordination with event planners",
                "On-site support included",
                "Ideal for corporate events",
                "Weddings and special occasions"
            ],
            category: "transfer"
        },
        {
            oldTitle: "Hotel Transfer", // Likely matches "Hospitality Package" intent or is replaced by it
            newTitle: "Hospitality Package",
            image: "https://res.cloudinary.com/dwro1dh5q/image/upload/v1765064623/ace-tours-assets/tour_bus_hire.jpg",
            duration: "Up to 10 hours",
            minPax: "Max 10 hours",
            description: [
                "Customized itineraries",
                "Pick up and drop off for all meetings",
                "Ideal for hosting out-of-town clients",
                "Professional dedicated driver",
                "Comfortable air-conditioned transport"
            ],
            category: "transfer"
        }
    ];

    const existingTours = await storage.getTours();

    for (const update of updates) {
        // Find by title (or oldTitle)
        const targetTitle = 'oldTitle' in update ? update.oldTitle : update.title;
        const tour = existingTours.find((t: Tour) => t.title === targetTitle || t.title === (update as any).newTitle);

        if (tour) {
            console.log(`Updating ${tour.title}...`);
            const updateData: any = {
                image: update.image,
                duration: update.duration,
                minPax: update.minPax,
                description: update.description
            };

            if ('newTitle' in update) {
                updateData.title = update.newTitle;
            }
            if ('childPrice' in update) {
                updateData.childPrice = update.childPrice;
            }

            await storage.updateTour(tour.id, updateData);
            console.log(`✓ Updated ${updateData.title || tour.title}`);
        } else {
            console.log(`Tour/Transfer not found: ${targetTitle}. Creating new...`);
            // If not found, create (using newTitle if available)
            const createData: any = {
                title: ('newTitle' in update) ? update.newTitle : update.title,
                image: update.image,
                duration: update.duration,
                minPax: update.minPax,
                description: update.description,
                price: "TBD", // Default if missing
                category: ('category' in update) ? update.category : "tour"
            };
            // Add defaults if missing in update object
            if (!createData.price) createData.price = "Contact for price";

            await storage.createTour(createData);
            console.log(`✓ Created ${createData.title}`);
        }
    }

    console.log("Update complete!");
    process.exit(0);
}

updateToursAndTransfers().catch(console.error);

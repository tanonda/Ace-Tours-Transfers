import { storage } from "./server/storage";
import { insertTourSchema } from "./shared/schema";

async function test() {
    try {
        const payload = {
            title: "Test Tour from Script",
            isActive: true,
            price: "$100",
            childPrice: "$50",
            duration: "2 hours",
            minPax: "2",
            category: "tour",
            defaultCapacity: 20,
            description: ["Test description"],
            image: "http://example.com/image.jpg",
            vehicleDetails: null,
        };

        console.log("Parsing payload...");
        const validated = insertTourSchema.parse(payload);
        console.log("Creating tour in DB...");
        const result = await storage.createTour(validated);
        console.log("Created successfully:", result);

        // Cleanup
        console.log("Deleting tour...");
        await storage.deleteTour(result.id);
        console.log("Deleted");

        process.exit(0);
    } catch (e: any) {
        console.error("Error creating tour:", e);
        process.exit(1);
    }
}

test();


import { storage } from "../server/storage.js";

async function check() {
    try {
        const tours = await storage.getProducts();
        console.log(`Checking ${tours.length} tours...`);

        for (const tour of tours) {
            if (!tour.defaultCapacity || tour.defaultCapacity <= 0) {
                console.warn(`[WARNING] Tour "${tour.title}" (${tour.id}) has invalid/missing defaultCapacity: ${tour.defaultCapacity}`);
            }
            if (!tour.adultPriceCents || tour.adultPriceCents <= 0) {
                console.warn(`[WARNING] Tour "${tour.title}" (${tour.id}) has invalid/missing adultPriceCents: ${tour.adultPriceCents}`);
            }
        }
        console.log("Check complete.");
        process.exit(0);
    } catch (e) {
        console.error("Error checking tours:", e);
        process.exit(1);
    }
}

check();

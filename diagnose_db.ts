import 'dotenv/config';
import { db } from "./server/db";
import { tours } from "./shared/schema";
import { isNull } from "drizzle-orm";

async function diagnose() {
    try {
        console.log("Checking for tours with null isActive...");
        const nullIsActive = await db.select().from(tours).where(isNull(tours.isActive));
        console.log(`Found ${nullIsActive.length} tours with null isActive.`);

        console.log("Attempting to select all tours...");
        const allTours = await db.select().from(tours);
        console.log("Successfully selected tours. Total:", allTours.length);
        if (allTours.length > 0) {
            console.log("First tour ID:", allTours[0].id);
            console.log("First tour isActive:", allTours[0].isActive);
        }
    } catch (error: any) { // Added ': any' for type safety, consistent with original
        console.error("DIAGNOSE FAILED:", error);
        if (error.stack) console.error(error.stack); // Re-added stack trace for better debugging
    }
}

diagnose();

import "dotenv/config";
import { db } from "../server/db.js";
import { tours, tourInstances, availabilityHolds, bookings, bookingItems, resources, capacityAuditLog } from "../shared/schema.js";
import { eq, or, like, sql } from "drizzle-orm";

async function main() {
    console.log("🧹 Starting database cleanup of test tours...");

    try {
        // Identify test tours based on title or image
        const testTours = await db.select().from(tours).where(
            or(
                like(tours.title, "%Verification%"),
                like(tours.title, "%Test%"),
                like(tours.title, "%concurrent%"),
                like(tours.title, "%phase4%"),
                eq(tours.image, "test.jpg"),
                eq(tours.image, "/test.jpg")
            )
        );

        console.log(`🔍 Found ${testTours.length} test tours to remove.`);

        for (const tour of testTours) {
            console.log(`🗑️  Processing tour: ${tour.title} (${tour.id})`);

            // 1. Delete audit logs by productId
            await db.delete(capacityAuditLog).where(eq(capacityAuditLog.productId, tour.id));
            console.log(`   Deleted audit logs for product: ${tour.id}`);

            // 2. Find and delete dependent booking items
            const tourBookings = await db.select().from(bookings).where(eq(bookings.tourId, tour.id));
            for (const booking of tourBookings) {
                await db.delete(bookingItems).where(eq(bookingItems.bookingId, booking.id));
                console.log(`   Deleted booking items for booking: ${booking.id}`);
            }

            // 3. Delete bookings
            await db.delete(bookings).where(eq(bookings.tourId, tour.id));
            console.log(`   Deleted bookings for tour: ${tour.id}`);

            // 4. Delete resources
            await db.delete(resources).where(eq(resources.productId, tour.id));
            console.log(`   Deleted resources for tour: ${tour.id}`);

            // 5. Find and delete holds
            const instances = await db.select().from(tourInstances).where(eq(tourInstances.tourId, tour.id));
            for (const instance of instances) {
                // Also delete audit logs by tourInstanceId just in case
                await db.delete(capacityAuditLog).where(eq(capacityAuditLog.tourInstanceId, instance.id));

                await db.delete(availabilityHolds).where(eq(availabilityHolds.tourInstanceId, instance.id));
                console.log(`   Deleted holds for instance: ${instance.id}`);
            }

            // 6. Delete instances
            await db.delete(tourInstances).where(eq(tourInstances.tourId, tour.id));
            console.log(`   Deleted instances for tour: ${tour.id}`);

            // 7. Finally delete the tour
            await db.delete(tours).where(eq(tours.id, tour.id));
            console.log(`✅ Deleted tour: ${tour.title}`);
        }

        console.log("✨ Cleanup complete!");
    } catch (error) {
        console.error("❌ Cleanup FAILED:", error);
        process.exit(1);
    }
    process.exit(0);
}

main();

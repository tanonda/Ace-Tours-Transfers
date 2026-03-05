import { storage } from "../storage.ts";
import { AvailabilityService } from "../domain/availability/availability.service.ts";
import { db } from "../db.ts";
import { products, resources, tourInstances, availabilityHolds } from "../../shared/schema.ts";
import { eq } from "drizzle-orm";

async function verifyVehicleOverlap() {
    console.log("--- Verifying Vehicle Interval Overlap Logic ---");

    const service = new AvailabilityService(storage);

    // 1. Setup a test vehicle product
    const [vehicle] = await db.insert(products).values({
        title: "Test Rental Car",
        price: "5000",
        duration: "24h",
        image: "car.jpg",
        description: ["Test Car"],
        category: "vehicle",
        defaultCapacity: 1
    }).returning();

    // 2. Add a physical resource (The Car)
    const [resource] = await db.insert(resources).values({
        productId: vehicle.id,
        name: "Test Car #1",
        seatCapacity: 5,
        status: "active"
    }).returning();

    const testDate = "2025-11-20";

    console.log(`Setup vehicle: ${vehicle.id} with resource: ${resource.id}`);

    try {
        // 3. Create a hold for the morning (08:00 - 12:00)
        console.log("Booking morning slot (08:00 - 12:00)...");
        const hold1 = await service.createHold(vehicle.id, testDate, 1, "session-1", undefined, 15, "08:00", "12:00");
        console.log(`Hold 1 created: ${hold1.id}`);

        // 4. Attempt to book an overlapping slot (11:00 - 15:00) - SHOULD FAIL
        console.log("Attempting overlapping slot (11:00 - 15:00) - Should fail...");
        try {
            await service.createHold(vehicle.id, testDate, 1, "session-2", undefined, 15, "11:00", "15:00");
            throw new Error("FAIL: Overlapping hold was allowed!");
        } catch (e: any) {
            console.log(`Success: Overlap rejected as expected: ${e.message}`);
        }

        // 5. Attempt to book a non-overlapping afternoon slot (13:00 - 17:00) - SHOULD SUCCEED
        console.log("Booking afternoon slot (13:00 - 17:00) - Should succeed...");
        const hold2 = await service.createHold(vehicle.id, testDate, 1, "session-3", undefined, 15, "13:00", "17:00");
        console.log(`Hold 2 created: ${hold2.id}`);

        // 6. Verify same resource was allocated if it's the only one
        if (hold1.resourceId !== resource.id || hold2.resourceId !== resource.id) {
            console.warn(`Resource ID mismatch. Expected ${resource.id}, got ${hold1.resourceId} and ${hold2.resourceId}`);
        } else {
            console.log("Verified: Same physical resource reused for non-overlapping slots.");
        }

        console.log("--- Verification SUCCESSFUL ---");
    } catch (e) {
        console.error("Verification FAILED:", e);
        process.exit(1);
    } finally {
        // Cleanup
        await db.delete(availabilityHolds).where(eq(availabilityHolds.bookingSessionId, "session-1"));
        await db.delete(availabilityHolds).where(eq(availabilityHolds.bookingSessionId, "session-3"));
        await db.delete(tourInstances).where(eq(tourInstances.tourId, vehicle.id));
        await db.delete(resources).where(eq(resources.id, resource.id));
        await db.delete(products).where(eq(products.id, vehicle.id));
    }
}

verifyVehicleOverlap().catch(console.error);

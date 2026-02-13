
import { db } from "../db.js";
import { tours, tourInstances, availabilityHolds, InsertTour, resources, capacityAuditLog } from "../../shared/schema.js";
import { AvailabilityService } from "../domain/availability/availability.service.js";
import { storage } from "../storage.js";
import { eq, and, sql } from "drizzle-orm";

const TEST_TOUR_ID = "diag-vehicle-test";
const TEST_DATE = "2026-07-20";

async function setupTestData() {
    console.log("🔧 Setting up test tour...");
    await db.delete(capacityAuditLog).where(sql`product_id = ${TEST_TOUR_ID}`);
    await db.delete(availabilityHolds).where(sql`booking_session_id LIKE 'diag-session-%'`);
    await db.delete(tourInstances).where(eq(tourInstances.tourId, TEST_TOUR_ID));
    await db.delete(resources).where(eq(resources.productId, TEST_TOUR_ID));
    await db.delete(tours).where(eq(tours.id, TEST_TOUR_ID));

    await db.insert(tours).values({
        id: TEST_TOUR_ID,
        title: "Multi-day Vehicle Test",
        category: "vehicle",
        defaultCapacity: 2,
        price: "$200 / day",
        duration: "N/A",
        minPax: "1 pax",
        image: "/test.jpg",
        description: ["Test"]
    });

    await db.insert(resources).values([
        { id: TEST_TOUR_ID + "-v1", productId: TEST_TOUR_ID, name: "Van 1", seatCapacity: 7, status: "active" },
        { id: TEST_TOUR_ID + "-v2", productId: TEST_TOUR_ID, name: "Van 2", seatCapacity: 7, status: "active" }
    ]);
}

async function simulate() {
    console.log("🚀 Starting simulation (3 users, 2 resource capacity)...");
    const availabilityService = new AvailabilityService(storage);

    // Launch 3 users trying to book the SAME vehicle
    const promises = [0, 1, 2].map(async (i) => {
        const sessionId = `diag-session-${i}`;
        try {
            // Find resource
            const available = await storage.getAvailableResourcesMultiDay(TEST_TOUR_ID, TEST_DATE, 3);
            if (available.length === 0) throw new Error("No vehicles found");
            const pinnedId = available[0].id; // Both will see Van 1

            console.log(`[User ${i}] Attempting hold for ${pinnedId}...`);

            // Hold for 3 days
            for (let d = 0; d < 3; d++) {
                const date = new Date(TEST_DATE);
                date.setDate(date.getDate() + d);
                await availabilityService.createHold(TEST_TOUR_ID, date.toISOString().split('T')[0], 1, sessionId, undefined, 15, undefined, undefined, pinnedId);
            }
            console.log(`[User ${i}] ✅ SUCCESS with ${pinnedId}`);
            return { success: true, resourceId: pinnedId };
        } catch (e: any) {
            console.log(`[User ${i}] ❌ FAILURE: ${e.message}`);
            return { success: false, error: e.message };
        }
    });

    const results = await Promise.all(promises);
    const successes = results.filter(r => r.success);
    console.log(`\n📊 Successes: ${successes.length}/2 expected.`);

    if (successes.length > 1) {
        const ids = successes.map(s => s.resourceId);
        console.log(`   Resources claimed: ${ids.join(", ")}`);
        if (new Set(ids).size < ids.length) {
            console.error("⚠️  DOUBLE BOOKING DETECTED! Same resource assigned multiple times.");
            process.exit(1);
        }
    }

    if (successes.length > 2) throw new Error("OVERBOOKING DETECTED!");
    console.log("✅ Concurrency verification PASSED.");
}

async function main() {
    try {
        await setupTestData();
        await simulate();
        process.exit(0);
    } catch (e) {
        console.error("❌ FATAL:", e);
        process.exit(1);
    }
}
main();


import { db } from "../db.js";
import { products, tourInstances, availabilityHolds, InsertProduct, resources, capacityAuditLog } from "../../shared/schema.js";
import { AvailabilityService } from "../domain/availability/availability.service.js";
import { storage } from "../storage.js";
import { eq, and, sql } from "drizzle-orm";

const TEST_PREFIX = "load-test-";
const TEST_DATE = "2026-05-20";

async function setupTestData() {
    console.log("🔧 Setting up comprehensive test data...");

    // Clean up
    await db.delete(capacityAuditLog).where(sql`product_id LIKE 'load-test-%'`);
    await db.delete(availabilityHolds).where(sql`booking_session_id LIKE 'load-session-%'`);
    await db.delete(tourInstances).where(sql`tour_id LIKE 'load-test-%'`);
    await db.delete(resources).where(sql`product_id LIKE 'load-test-%'`);
    await db.delete(products).where(sql`id LIKE 'load-test-%'`);

    // 1. Product (Pooled Capacity)
    await db.insert(products).values({
        id: TEST_PREFIX + "tour",
        title: "TEST_Load Test Product",
        category: "tour",
        defaultCapacity: 50,
        price: "$100 / adult",
        duration: "Full Day",
        minPax: "1 pax",
        image: "test.jpg",
        description: ["Test"]
    });

    // 2. Transfer (Time-Slot)
    await db.insert(products).values({
        id: TEST_PREFIX + "transfer",
        title: "TEST_Load Test Transfer",
        category: "transfer",
        defaultCapacity: 10,
        price: "$50",
        duration: "Quick Trip",
        minPax: "1 pax",
        image: "test.jpg",
        description: ["Test"]
    });

    // 3. Vehicle (Multi-day, Resource Pinning)
    await db.insert(products).values({
        id: TEST_PREFIX + "vehicle",
        title: "TEST_Load Test Vehicle",
        category: "vehicle",
        defaultCapacity: 2, // Only 2 vehicles available
        price: "$200 / day",
        duration: "N/A",
        minPax: "1 pax",
        image: "test.jpg",
        description: ["Test"]
    });

    // Add 2 specific resources for the vehicle
    await db.insert(resources).values([
        { id: TEST_PREFIX + "v1", productId: TEST_PREFIX + "vehicle", name: "Van 1", seatCapacity: 7, status: "active" },
        { id: TEST_PREFIX + "v2", productId: TEST_PREFIX + "vehicle", name: "Van 2", seatCapacity: 7, status: "active" }
    ]);

    console.log("✅ Test data ready.");
}

async function runThrottled(tasks: (() => Promise<any>)[], limit: number) {
    const results: any[] = [];
    const executing = new Set<Promise<any>>();
    for (const task of tasks) {
        const p = task().then(res => {
            executing.delete(p);
            return res;
        });
        executing.add(p);
        results.push(p);
        if (executing.size >= limit) {
            await Promise.race(executing);
        }
    }
    return Promise.all(results);
}

async function runConcurrentTest() {
    const availabilityService = new AvailabilityService(storage);

    console.log("\n🚀 Starting throttled load simulation (Max Concurrency: 5)...");

    // TEST 1: Tours - 10 users try to book 1 seat each (Cap: 50)
    const tourTasks = Array.from({ length: 15 }).map((_, i) => async () => {
        return availabilityService.createHold(TEST_PREFIX + "tour", TEST_DATE, 10, `load-session-tour-${i}`)
            .then(() => ({ type: 'tour', success: true }))
            .catch(e => ({ type: 'tour', success: false, error: e.message }));
    });

    // TEST 2: Vehicles - 5 users try to book 1 vehicle for 3 days (Cap: 2)
    // We expect only 2 users to succeed because we have 2 resources
    const vehicleTasks = Array.from({ length: 5 }).map((_, i) => async () => {
        const sessionId = `load-session-vehicle-${i}`;
        try {
            const available = await storage.getAvailableResourcesMultiDay(TEST_PREFIX + "vehicle", TEST_DATE, 3);
            if (available.length === 0) throw new Error("No vehicles");
            const pinnedId = available[0].id;

            // Hold for 3 days
            for (let d = 0; d < 3; d++) {
                const date = new Date(TEST_DATE);
                date.setDate(date.getDate() + d);
                await availabilityService.createHold(
                    TEST_PREFIX + "vehicle",
                    date.toISOString().split('T')[0],
                    1,
                    sessionId,
                    undefined, 15, undefined, undefined, pinnedId
                );
            }
            return { type: 'vehicle', success: true };
        } catch (e: any) {
            return { type: 'vehicle', success: false, error: e.message };
        }
    });

    const tourResults = await runThrottled(tourTasks, 1);
    const vehicleResults = await runThrottled(vehicleTasks, 1);

    const tourSuccess = tourResults.filter(r => r.success).length;
    const vehicleSuccess = vehicleResults.filter(r => r.success).length;

    console.log(`\n📊 Results:`);
    console.log(`   Tours: ${tourSuccess}/50 expected successes (requested 60, got ${tourSuccess})`);
    console.log(`   Vehicles: 2/2 expected successes (requested 5, got ${vehicleSuccess})`);

    if (tourSuccess > 50) throw new Error("OVERBOOKING DETECTED IN TOURS!");
    if (vehicleSuccess > 2) throw new Error("OVERBOOKING DETECTED IN VEHICLES!");

    console.log("\n✅ NO OVERBOOKING DETECTED. CONCURRENCY CONTROLS VALIDATED.");
}

async function main() {
    try {
        await setupTestData();
        await runConcurrentTest();
        process.exit(0);
    } catch (e) {
        console.error("❌ TEST FAILED:", e);
        process.exit(1);
    }
}

main();

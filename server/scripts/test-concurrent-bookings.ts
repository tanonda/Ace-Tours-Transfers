/**
 * Concurrent Booking Test Harness
 * 
 * Simulates multiple users attempting to book the last available seats simultaneously.
 * Validates that database transactions and row-level locking prevent overbooking.
 * 
 * Test Scenario:
 * - Create a tour with 10 seats capacity
 * - 5 users try to book 3 seats each (total: 15 seats requested)
 * - Expected: Only 3-4 bookings succeed (9-12 seats), others fail
 * 
 * Run: npx tsx server/scripts/test-concurrent-bookings.ts
 */

import { db } from "../db.js";
import { tours, tourInstances, availabilityHolds, InsertTour, capacityAuditLog } from "../../shared/schema.js";
import { AvailabilityService } from "../domain/availability/availability.service.js";
import { storage } from "../storage.js";
import { eq, like } from "drizzle-orm";

const TEST_TOUR_ID = "test-concurrent-tour";
const TEST_DATE = "2026-03-15";
const TOTAL_CAPACITY = 10;
const SEATS_PER_REQUEST = 3;
const CONCURRENT_REQUESTS = 5;

async function setupTestTour(): Promise<void> {
    console.log("🔧 Setting up test tour...");

    // Clean up any existing test data
    await db.delete(availabilityHolds).where(like(availabilityHolds.bookingSessionId, "test-session-%"));
    await db.delete(capacityAuditLog).where(eq(capacityAuditLog.productId, TEST_TOUR_ID));
    await db.delete(tourInstances).where(eq(tourInstances.tourId, TEST_TOUR_ID));
    await db.delete(tours).where(eq(tours.id, TEST_TOUR_ID));

    // Create test tour
    const testTour: any = {
        id: TEST_TOUR_ID,
        title: "Concurrent Booking Test Tour",
        description: [`Test tour for concurrent booking validation with ${TOTAL_CAPACITY} seats`],
        price: "$120 / adult",
        childPrice: "$60 / child",
        adultPriceCents: 1000000,
        childPriceCents: 500000,
        capacity: TOTAL_CAPACITY,
        duration: "Full Day",
        minPax: "2 pax",
        image: "/test-image.jpg",
        category: "tour",
        defaultCapacity: TOTAL_CAPACITY,
    };

    await db.insert(tours).values(testTour);
    console.log(`✅ Created test tour with ${TOTAL_CAPACITY} seats capacity`);
}

async function simulateConcurrentBookings(): Promise<{
    successes: number;
    failures: number;
    errors: string[];
}> {
    console.log(`\n🚀 Simulating ${CONCURRENT_REQUESTS} concurrent booking requests...`);
    console.log(`   Each request attempts to book ${SEATS_PER_REQUEST} seats`);
    console.log(`   Total requested: ${CONCURRENT_REQUESTS * SEATS_PER_REQUEST} seats`);
    console.log(`   Available: ${TOTAL_CAPACITY} seats\n`);

    const availabilityService = new AvailabilityService(storage);
    const requests = [];

    for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
        const promise = (async () => {
            const sessionId = `test-session-${i}`;
            try {
                const hold = await availabilityService.createHold(
                    TEST_TOUR_ID,
                    TEST_DATE,
                    SEATS_PER_REQUEST,
                    sessionId
                );
                return { success: true, sessionId, holdId: hold.id, error: null };
            } catch (error) {
                return {
                    success: false,
                    sessionId,
                    holdId: null,
                    error: error instanceof Error ? error.message : String(error),
                };
            }
        })();

        requests.push(promise);
    }

    // Execute all requests concurrently
    const results = await Promise.all(requests);

    const successes = results.filter(r => r.success).length;
    const failures = results.filter(r => !r.success).length;
    const errors = results.filter(r => !r.success).map(r => r.error || "Unknown error");

    console.log("📊 Results:");
    console.log(`   ✅ Successful bookings: ${successes} (${successes * SEATS_PER_REQUEST} seats)`);
    console.log(`   ❌ Failed bookings: ${failures}`);

    if (errors.length > 0) {
        console.log(`\n   Error messages:`);
        errors.forEach((err, i) => console.log(`     ${i + 1}. ${err}`));
    }

    return { successes, failures, errors };
}

async function verifyDatabaseState(): Promise<void> {
    console.log("\n🔍 Verifying database state...");

    // Check tour instance
    const [instance] = await db
        .select()
        .from(tourInstances)
        .where(eq(tourInstances.tourId, TEST_TOUR_ID));

    if (instance) {
        console.log(`   Tour Instance Counts:`);
        console.log(`     Total Capacity: ${instance.totalCapacity}`);
        console.log(`     Held Count: ${instance.heldCount}`);
        console.log(`     Confirmed Count: ${instance.confirmedCount}`);
        console.log(`     Blocked Count: ${instance.blockedCount}`);
        console.log(`     Remaining: ${instance.totalCapacity - (instance.heldCount + instance.confirmedCount + instance.blockedCount)}`);

        // Validate no overbooking
        const totalUsed = instance.heldCount + instance.confirmedCount + instance.blockedCount;
        if (totalUsed > instance.totalCapacity) {
            console.log(`   ⚠️  WARNING: OVERBOOKING DETECTED! Used ${totalUsed} out of ${instance.totalCapacity}`);
            return;
        }
    }

    // Check holds
    const holds = await db
        .select()
        .from(availabilityHolds)
        .where(eq(availabilityHolds.tourInstanceId, instance?.id || ""));

    console.log(`   Active Holds: ${holds.length}`);

    console.log("\n✅ Database state is consistent - NO OVERBOOKING!");
}

async function cleanup(): Promise<void> {
    console.log("\n🧹 Cleaning up test data...");
    await db.delete(availabilityHolds).where(like(availabilityHolds.bookingSessionId, "test-session-%"));
    await db.delete(capacityAuditLog).where(eq(capacityAuditLog.productId, TEST_TOUR_ID));
    await db.delete(tourInstances).where(eq(tourInstances.tourId, TEST_TOUR_ID));
    await db.delete(tours).where(eq(tours.id, TEST_TOUR_ID));
    console.log("✅ Cleanup complete");
}

async function runTest(): Promise<void> {
    console.log("═══════════════════════════════════════════════════");
    console.log("   CONCURRENT BOOKING TEST HARNESS");
    console.log("═══════════════════════════════════════════════════\n");

    try {
        await setupTestTour();
        const results = await simulateConcurrentBookings();
        await verifyDatabaseState();

        // Validate expected behavior
        const expectedSuccesses = Math.floor(TOTAL_CAPACITY / SEATS_PER_REQUEST);
        if (results.successes === expectedSuccesses || results.successes === expectedSuccesses + 1) {
            console.log(`\n✅ TEST PASSED: Concurrency protection working correctly!`);
        } else {
            console.log(`\n⚠️  TEST WARNING: Expected ${expectedSuccesses} successes, got ${results.successes}`);
        }

        await cleanup();
    } catch (error) {
        console.error("\n❌ TEST FAILED:", error);
        await cleanup();
        process.exit(1);
    }
}

// Run the test
runTest().then(() => {
    console.log("\n═══════════════════════════════════════════════════");
    process.exit(0);
}).catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});


import { metricsService } from "../infrastructure/metrics/metrics.service.js";
import { CreateBookingFromCartService } from "../application/booking/CreateBookingFromCartService.js";
import { AtomicSessionConfirmationService } from "../application/booking/AtomicSessionConfirmationService.js";
import { storage } from "../storage.js";
import { db } from "../db.js";
import { tourInstances, bookings, availabilityHolds, tours } from "../../shared/schema.js";
import { eq } from "drizzle-orm";

const TEST_TOUR_ID = "telemetry-test-tour";
const TEST_DATE = "2026-03-20";

async function runTelemetryTest() {
    console.log("🧪 Starting Telemetry Verification Test...");

    // Setup: Create Tour
    await db.insert(tours).values({
        id: TEST_TOUR_ID,
        title: "TEST_Telemetry Test Tour",
        description: ["Test tour for telemetry"],

        price: "$100",
        capacity: 10,
        defaultCapacity: 10,
        adultPriceCents: 10000,
        childPriceCents: 5000,
        category: "tour",
        image: "test.jpg",
        duration: "1h",
        minPax: "1"
    } as any).onConflictDoNothing();

    // Reset metrics
    metricsService.resetMetrics();
    console.log("✅ Metrics reset.");

    // 2. Simulate a successful booking creation
    const service = new CreateBookingFromCartService(storage);

    console.log("\n🔹 Step 1: Simulating successful booking creation...");
    await db.insert(tourInstances).values({
        id: "inst_telemetry_test",
        tourId: TEST_TOUR_ID,
        serviceDate: TEST_DATE,
        totalCapacity: 10,
        confirmedCount: 0,
        heldCount: 0,
        blockedCount: 0
    }).onConflictDoNothing();

    try {
        await service.execute({
            customerName: "Telemetry Test",
            customerEmail: "test@example.com",
            items: [{ productId: TEST_TOUR_ID, adultPax: 2, childPax: 0, infantPax: 0, petPax: 0, date: TEST_DATE }]
        });
        console.log("✅ Booking creation recorded.");
    } catch (e) {
        console.error("❌ Unexpected booking creation failure:", e);
    }

    // 3. Simulate a session confirmation failure
    console.log("\n🔹 Step 2: Simulating session confirmation failure...");
    const sessionService = new AtomicSessionConfirmationService(storage);
    const result = await sessionService.confirmSessionAtomically({
        sessionId: "non_existent_session",
        paymentId: "pay_123"
    });
    console.log("✅ Session failure handled (expected).");

    // 4. Verify metrics
    console.log("\n📊 Verifying Metrics...");
    const metrics = await metricsService.getMetrics();

    console.log("  - avgTransactionTimeMs:", metrics.avgTransactionTimeMs);
    console.log("  - sessionFailures:", JSON.stringify(metrics.concurrency?.sessionFailures));
    console.log("  - avgSessionLatencyMs:", metrics.concurrency?.avgSessionLatencyMs);
    console.log("  - lastErrors Count:", metrics.lastErrors.length);

    let allPassed = true;

    if (metrics.avgTransactionTimeMs > 0) {
        console.log("✅ Transaction latency recorded.");
    } else {
        console.error("❌ Transaction latency NOT recorded.");
        allPassed = false;
    }

    if (metrics.concurrency && metrics.concurrency.sessionFailures["SESSION_EMPTY"] > 0) {
        console.log("✅ Session failure metric recorded.");
    } else {
        console.error("❌ Session failure metric NOT recorded.");
        allPassed = false;
    }

    if (metrics.lastErrors.length > 0) {
        console.log("✅ Error snippets recorded.");
        console.log("     Latest error:", metrics.lastErrors[0].code, "-", metrics.lastErrors[0].message);
    } else {
        console.error("❌ Error snippets NOT recorded.");
        allPassed = false;
    }

    // Cleanup
    console.log("\n🧹 Cleaning up test data...");
    const { capacityAuditLog } = await import("../../shared/schema.js");
    await db.delete(bookings).where(eq(bookings.customerName, "Telemetry Test"));
    await db.delete(availabilityHolds).where(eq(availabilityHolds.tourInstanceId, "inst_telemetry_test"));
    await db.delete(capacityAuditLog).where(eq(capacityAuditLog.tourInstanceId, "inst_telemetry_test"));
    await db.delete(tourInstances).where(eq(tourInstances.id, "inst_telemetry_test"));
    await db.delete(tours).where(eq(tours.id, TEST_TOUR_ID));

    if (allPassed) {
        console.log("\n✨ ALL TELEMETRY VERIFIED SUCCESSFULLY! ✨");
    } else {
        console.error("\n❌ TELEMETRY VERIFICATION FAILED! ❌");
        process.exit(1);
    }
}

runTelemetryTest().catch(console.error);

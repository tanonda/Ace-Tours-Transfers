/**
 * Atomic Session Confirmation Test
 * 
 * Validates Phase 4: All-or-nothing guarantees for multi-item sessions.
 * 
 * Scenario:
 * 1. Create a session with 2 booking items.
 * 2. Artificially "break" one hold (set to EXPIRED).
 * 3. Attempt atomic session confirmation.
 * 4. Verify that NO bookings are confirmed (atomicity).
 */

import { db } from "../db.js";
import {
    bookings,
    availabilityHolds,
    tourInstances,
    tours,
    InsertTour,
    InsertBooking,
    InsertAvailabilityHold,
    capacityAuditLog
} from "../../shared/schema.js";
import { AtomicSessionConfirmationService } from "../application/booking/AtomicSessionConfirmationService.js";
import { storage } from "../storage.js";
import { eq, and, like } from "drizzle-orm";

const TEST_SESSION_ID = "test-atomic-session-123";
const TEST_TOUR_ID = "test-atomic-tour";
const TEST_DATE = "2026-04-20";

async function setup(): Promise<void> {
    console.log("🔧 Setting up atomic session test data...");

    // Cleanup
    await db.delete(bookings).where(eq(bookings.bookingSessionId, TEST_SESSION_ID));
    await db.delete(availabilityHolds).where(eq(availabilityHolds.bookingSessionId, TEST_SESSION_ID));
    await db.delete(capacityAuditLog).where(eq(capacityAuditLog.productId, TEST_TOUR_ID));
    await db.delete(tourInstances).where(eq(tourInstances.tourId, TEST_TOUR_ID));
    await db.delete(tours).where(eq(tours.id, TEST_TOUR_ID));

    // 1. Create Tour
    await db.insert(tours).values({
        id: TEST_TOUR_ID,
        title: "Atomic Test Tour",
        description: ["Test tour for atomicity"],
        price: "$100",
        capacity: 10,
        defaultCapacity: 10,
        adultPriceCents: 10000,
        childPriceCents: 5000,
        category: "tour",
        image: "test.jpg",
        duration: "1h",
        minPax: "1"
    } as any);

    // 2. Create TourInstance
    const [instance] = await db.insert(tourInstances).values({
        tourId: TEST_TOUR_ID,
        serviceDate: TEST_DATE,
        totalCapacity: 10,
        heldCount: 4, // 2 bookings of 2 seats each
        confirmedCount: 0,
        blockedCount: 0,
    } as any).returning();

    // 3. Create 2 holds
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    const [hold1] = await db.insert(availabilityHolds).values({
        tourInstanceId: instance.id,
        quantity: 2,
        status: "ACTIVE",
        expiresAt,
        bookingSessionId: TEST_SESSION_ID
    } as any).returning();

    const [hold2] = await db.insert(availabilityHolds).values({
        tourInstanceId: instance.id,
        quantity: 2,
        status: "ACTIVE",
        expiresAt,
        bookingSessionId: TEST_SESSION_ID
    } as any).returning();

    // 4. Create 2 bookings linked to holds
    await db.insert(bookings).values({
        id: "book-atomic-1",
        tourId: TEST_TOUR_ID,
        bookingSessionId: TEST_SESSION_ID,
        status: "pending",
        holdId: hold1.id,
        amount: "200.00",
        totalAmountCents: 20000,
        currency: "VUV",
        tourName: "Atomic Test Tour",
        customerName: "Test User 1",
        customerEmail: "test1@example.com",
        date: TEST_DATE,
        guests: 2
    } as any);

    await db.insert(bookings).values({
        id: "book-atomic-2",
        tourId: TEST_TOUR_ID,
        bookingSessionId: TEST_SESSION_ID,
        status: "pending",
        holdId: hold2.id,
        amount: "200.00",
        totalAmountCents: 20000,
        currency: "VUV",
        tourName: "Atomic Test Tour",
        customerName: "Test User 2",
        customerEmail: "test2@example.com",
        date: TEST_DATE,
        guests: 2
    } as any);

    console.log("✅ Setup complete: 1 session, 2 bookings, 2 active holds.");
}

async function runTest(): Promise<void> {
    const service = new AtomicSessionConfirmationService(storage);

    console.log("\n🧪 TEST 1: Success Scenario");
    const successResult = await service.confirmSessionAtomically({
        sessionId: TEST_SESSION_ID,
        paymentId: "pay_success_123"
    });

    if (successResult.success && successResult.sessionConfirmed) {
        console.log("✅ SUCCESS: Session confirmed atomically.");
    } else {
        console.error("❌ FAILURE: Expected success, got:", successResult);
    }

    // Reset to pending for failure test
    console.log("\n🔄 Resetting for failure test...");
    await db.update(bookings).set({ status: 'pending' }).where(eq(bookings.bookingSessionId, TEST_SESSION_ID));
    await db.update(availabilityHolds).set({ status: 'ACTIVE' }).where(eq(availabilityHolds.bookingSessionId, TEST_SESSION_ID));
    await db.update(tourInstances).set({ heldCount: 4, confirmedCount: 0 }).where(eq(tourInstances.tourId, TEST_TOUR_ID));

    console.log("\n🧪 TEST 2: Multi-item Failure (Rollback)");
    // Manually expire ONE hold to trigger failure
    const [brokenHold] = await db.select().from(availabilityHolds).where(eq(availabilityHolds.bookingSessionId, TEST_SESSION_ID)).limit(1);
    await db.update(availabilityHolds).set({ status: 'EXPIRED' }).where(eq(availabilityHolds.id, brokenHold.id));
    console.log(`⚠️  Broke Hold ${brokenHold.id} (set to EXPIRED)`);

    const failResult = await service.confirmSessionAtomically({
        sessionId: TEST_SESSION_ID,
        paymentId: "pay_fail_123"
    });

    if (!failResult.success && !failResult.sessionConfirmed) {
        console.log("✅ SUCCESS: Session confirmation failed as expected.");
        console.log("   Reason:", failResult.error?.reason);

        // VERIFY ATOMICITY: No booking should be confirmed
        const confirmedBookings = await db.select().from(bookings).where(and(eq(bookings.bookingSessionId, TEST_SESSION_ID), eq(bookings.status, 'confirmed')));
        if (confirmedBookings.length === 0) {
            console.log("✅ ATOMICITY VERIFIED: 0 bookings were confirmed despite one being valid.");
        } else {
            console.error(`❌ ATOMICITY VIOLATION: ${confirmedBookings.length} bookings were confirmed!`);
        }
    } else {
        console.error("❌ FAILURE: Expected failure, but got success:", failResult);
    }
}

async function cleanup(): Promise<void> {
    console.log("\n🧹 Cleaning up test data...");
    await db.delete(bookings).where(eq(bookings.bookingSessionId, TEST_SESSION_ID));
    await db.delete(availabilityHolds).where(eq(availabilityHolds.bookingSessionId, TEST_SESSION_ID));
    await db.delete(capacityAuditLog).where(eq(capacityAuditLog.productId, TEST_TOUR_ID));
    await db.delete(tourInstances).where(eq(tourInstances.tourId, TEST_TOUR_ID));
    await db.delete(tours).where(eq(tours.id, TEST_TOUR_ID));
    console.log("✅ Cleanup complete");
}

async function main() {
    try {
        await setup();
        await runTest();
        await cleanup();
    } catch (error) {
        console.error("Fatal error:", error);
        await cleanup();
        process.exit(1);
    }
}

main();

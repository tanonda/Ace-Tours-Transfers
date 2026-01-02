import { storage } from "../storage.ts";
import { AvailabilityService, HoldStatus } from "../domain/availability/availability.service.ts";
import { db } from "../db.ts";
import { tourInstances, tours, availabilityHolds, bookings } from "../../shared/schema.ts";
import { eq, and } from "drizzle-orm";

async function runVerification() {
  console.log("--- Starting Availability System Verification ---");

  const service = new AvailabilityService(storage);

  // 1. Setup a test tour
  const [testTour] = await db.insert(tours).values({
    title: "Verification Tour",
    price: "100",
    duration: "2h",
    image: "test.jpg",
    description: ["Test"],
    category: "tour"
  }).returning();

  console.log(`Created test tour: ${testTour.id}`);

  const testDate = "2025-12-30";
  const testSession = "test-session-" + Date.now();

  // 2. Test Availability Check (Initial)
  const initialAvail = await service.checkAvailability(testTour.id, testDate);
  console.log(`Initial availability: ${initialAvail} (Should be 0 if no instance)`);

  // 3. Create Hold
  console.log("Creating hold for 5 seats...");
  const hold = await service.createHold(testTour.id, testDate, 5, testSession);
  console.log(`Hold created: ${hold.id}, quantity: ${hold.quantity}, expiresAt: ${hold.expiresAt}`);

  // 4. Verify Counts after Hold
  const [instance] = await db.select().from(tourInstances).where(eq(tourInstances.id, hold.tourInstanceId));
  console.log(`Instance counts: held=${instance.heldCount}, confirmed=${instance.confirmedCount}, total=${instance.totalCapacity}`);
  if (instance.heldCount !== 5) throw new Error("Held count mismatch after hold");

  // 5. Test Concurrency (Simulated)
  console.log("Testing concurrency: 5 parallel hold attempts for 4 seats each (Total 20)...");
  // Total capacity is 20. 5 are held. 15 remaining.
  // We try 5 * 4 = 20 more. Some should fail.
  const results = await Promise.allSettled([
    service.createHold(testTour.id, testDate, 4, "v1"),
    service.createHold(testTour.id, testDate, 4, "v2"),
    service.createHold(testTour.id, testDate, 4, "v3"),
    service.createHold(testTour.id, testDate, 4, "v4"),
    service.createHold(testTour.id, testDate, 4, "v5"),
  ]);

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  console.log(`Parallel results: Succeeded: ${succeeded}, Failed: ${failed}`);
  // Should have 15 left. 3 * 4 = 12 (fits), 4 * 4 = 16 (too many).
  // So exactly 3 should succeed.
  if (succeeded !== 3) console.warn(`EXPECTED 3 successes, got ${succeeded}. (Check if default capacity changed)`);

  // 6. Test Confirmation Logic
  console.log(`Confirming hold ${hold.id}...`);
  await service.confirmBooking(hold.id);
  
  const [instanceFixed] = await db.select().from(tourInstances).where(eq(tourInstances.id, hold.tourInstanceId));
  console.log(`Instance counts after confirm: held=${instanceFixed.heldCount}, confirmed=${instanceFixed.confirmedCount}`);
  // Expected: 5 confirmed, (3*4) = 12 held. Total 17 occupied.
  if (instanceFixed.confirmedCount !== 5) throw new Error("Confirmed count mismatch");

  // 7. Test Expiry Release
  console.log("Testing expiry release...");
  const [shortHold] = await db.insert(availabilityHolds).values({
    tourInstanceId: instance.id,
    quantity: 2,
    status: HoldStatus.ACTIVE,
    expiresAt: new Date(Date.now() - 1000), // Already expired
    bookingSessionId: "expired-one"
  }).returning();

  // Manually update heldCount to account for this shortHold (since we bypassed service)
  await db.update(tourInstances).set({ heldCount: instanceFixed.heldCount + 2 }).where(eq(tourInstances.id, instance.id));

  console.log("Running releaseHold for expired hold...");
  await service.releaseHold(shortHold.id, HoldStatus.EXPIRED);
  
  const [instanceFinal] = await db.select().from(tourInstances).where(eq(tourInstances.id, hold.tourInstanceId));
  console.log(`Final instance counts: held=${instanceFinal.heldCount}, confirmed=${instanceFinal.confirmedCount}`);
  if (instanceFinal.heldCount !== 12) throw new Error("Held count did not return after expiry");

  console.log("--- Verification Successful ---");
  process.exit(0);
}

runVerification().catch(e => {
  console.error("Verification FAILED:", e);
  process.exit(1);
});

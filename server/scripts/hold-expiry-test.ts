import { storage } from "../storage.js";
import { HoldExpiryJob } from "../infrastructure/jobs/hold-expiry.job.js";
import { AvailabilityApplicationService } from "../application/availability/availability.application-service.js";

async function run() {
  console.log('[TEST] Starting hold expiry test');
  // 1. Create a small test tour
  const tour = await storage.createTour({
    title: 'TEST HOLD TOUR',
    price: 'VUV 1000',
    adultPriceCents: 100000,
    childPriceCents: 0,
    duration: '1h',
    minPax: '1',
    image: '',
    description: ['test'],
    category: 'tour',
    defaultCapacity: 2,
  });

  const date = new Date().toISOString().split('T')[0];

  // 2. Ensure an instance exists
  const instance = await storage.createTourInstance({
    tourId: tour.id,
    serviceDate: date,
    timeSlot: null,
    totalCapacity: 2,
    startTime: null,
    endTime: null,
  });

  // 3. Create a short-lived hold directly using storage (expires in 1s)
  const expiresAt = new Date(Date.now() + 1000); // 1 second
  const hold = await storage.createHold({
    tourInstanceId: instance.id,
    resourceId: null,
    quantity: 1,
    status: 'ACTIVE',
    expiresAt,
    bookingSessionId: 'test-session-1'
  });

  console.log('[TEST] Created hold', hold.id, 'expiresAt', expiresAt.toISOString());

  // 4. Increment heldCount to simulate normal flow (if not already)
  await storage.updateTourInstance(instance.id, { heldCount: instance.heldCount + 1 });

  console.log('[TEST] Waiting 2 seconds for expiry...');
  await new Promise((r) => setTimeout(r, 2000));

  // 5. Run HoldExpiryJob once
  const job = new HoldExpiryJob(storage);
  const result = await job.run();
  console.log('[TEST] Hold expiry job result', result);

  // 6. Verify instance heldCount has decreased
  const refreshed = await storage.getTourInstanceById(instance.id);
  console.log('[TEST] Instance heldCount after expiry:', refreshed?.heldCount);

  // Cleanup (best-effort)
  try {
    await storage.deleteBooking(hold.bookingSessionId as any).catch(() => {});
  } catch (e) {}

  console.log('[TEST] Completed');
}

run().catch(err => {
  console.error('[TEST] Error running hold-expiry-test', err);
  process.exit(1);
});

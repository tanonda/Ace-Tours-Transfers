
import { projectionEngine } from "../server/infrastructure/projections/projection-engine";
import { BookingCreated, PaymentConfirmed } from "../server/domain/events";

/**
 * Projection Verification Script
 * 
 * Tests that projections can be replayed and (optionally) rebuilt.
 */

async function verifyProjections() {
  console.log("--- Starting Projection Verification ---");

  // 1. Create dummy events
  const bookingId = "book_test_123";
  const paymentId = "pay_test_456";
  const events = [
    new BookingCreated(bookingId, 15000),
    new PaymentConfirmed(paymentId, bookingId)
  ];

  // 2. Replay events
  try {
    await projectionEngine.replay(events);
    console.log("[SUCCESS] Event replay executed without errors.");
  } catch (err) {
    console.error("[FAILURE] Event replay failed:", err);
    process.exit(1);
  }

  // 3. Test rebuild (if --rebuild flag is present)
  if (process.argv.includes('--rebuild')) {
    console.log("[INFO] Testing Full Rebuild...");
    try {
      await projectionEngine.rebuild(events);
      console.log("[SUCCESS] Full rebuild executed without errors.");
    } catch (err) {
      console.error("[FAILURE] Full rebuild failed:", err);
      process.exit(1);
    }
  }

  console.log("--- Projection Verification Complete ---");
}

verifyProjections().catch(console.error);

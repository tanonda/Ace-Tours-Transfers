/**
 * Concurrent Booking Test
 * 
 * Simulates 10+ simultaneous booking requests for a 5-seat tour.
 * Validates that no overbooking occurs under concurrent load.
 * 
 * Usage: npx tsx scripts/test-concurrent-bookings.ts
 */

import { IStorage } from "../server/storage.js";
import { storage as defaultStorage } from "../server/storage.js";
import { CreateBookingFromCartService } from "../server/application/booking/CreateBookingFromCartService.js";
import { BookingConfirmationService } from "../server/application/booking/BookingConfirmationService.js";
import { PaymentReconciliationService } from "../server/application/payment-reconciliation.service.js";
import { metricsService } from "../server/infrastructure/metrics/metrics.service.js";
import { config } from "../server/config.js";

interface TestResult {
  totalRequests: number;
  successful: number;
  failed: number;
  overbookingDetected: boolean;
  errorBreakdown: Record<string, number>;
  bookings: string[];
  message: string;
}

async function runConcurrentBookingTest(): Promise<TestResult> {
  const storage = defaultStorage;

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║         CONCURRENT BOOKING TEST - Production Safety           ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  // Test Parameters
  const NUM_CONCURRENT_REQUESTS = 15;
  const TOUR_CAPACITY = 5;
  const GUESTS_PER_BOOKING = 1;
  const TEST_DATE = new Date();
  TEST_DATE.setDate(TEST_DATE.getDate() + 32); // 32 days from now
  const TEST_DATE_STR = TEST_DATE.toISOString().split('T')[0];

  console.log(`📊 Test Configuration:`);
  console.log(`  • Concurrent Requests: ${NUM_CONCURRENT_REQUESTS}`);
  console.log(`  • Tour Capacity: ${TOUR_CAPACITY}`);
  console.log(`  • Guests per Booking: ${GUESTS_PER_BOOKING}`);
  console.log(`  • Test Date: ${TEST_DATE_STR}`);
  console.log(`  • Expected Max Bookings: ${TOUR_CAPACITY}`);
  console.log();

  try {
    // Step 1: Create test tour with capacity
    console.log(`🔧 Setting up test tour...`);
    let testTour = await storage.getTourByTitle("CONCURRENT_TEST_TOUR");

    if (!testTour) {
      testTour = await storage.createTour({
        title: "CONCURRENT_TEST_TOUR",
        price: "5000",
        adultPriceCents: 500000,
        childPriceCents: 250000,
        duration: "1 day",
        minPax: "1",
        image: "https://placeholder.com/concurrent-test.jpg",
        description: ["Test tour for concurrent booking validation"],
        category: "tour",
        capacity: TOUR_CAPACITY,
        defaultCapacity: TOUR_CAPACITY,
      });
    }

    console.log(`✅ Test tour: ${testTour.id} (Capacity: ${testTour.defaultCapacity})`);
    console.log();

    // Step 2: Create tour instance for test date
    console.log(`🔧 Creating tour instance for ${TEST_DATE_STR}...`);
    let instances = await storage.getTourInstances(testTour.id, TEST_DATE_STR);
    let testInstance = instances[0];

    if (!testInstance) {
      testInstance = await storage.createTourInstance({
        tourId: testTour.id,
        serviceDate: TEST_DATE_STR,
        timeSlot: "morning",
        totalCapacity: TOUR_CAPACITY,
        confirmedCount: 0,
        heldCount: 0,
        blockedCount: 0,
      });
    }

    console.log(`✅ Tour instance: ${testInstance.id} (Capacity: ${testInstance.totalCapacity})`);
    console.log();

    // Step 3: Launch concurrent booking requests
    console.log(`🚀 Launching ${NUM_CONCURRENT_REQUESTS} concurrent booking requests...`);
    console.log();

    const bookingService = new CreateBookingFromCartService(storage);
    const bookingConfirmation = new BookingConfirmationService(storage);
    const paymentReconciliation = new PaymentReconciliationService(storage);

    const bookingPromises = Array.from({ length: NUM_CONCURRENT_REQUESTS }, (_, i) =>
      (async () => {
        const requestId = `REQ_${String(i + 1).padStart(2, '0')}`;
        try {
          console.log(`  [${requestId}] Attempting to create booking...`);

          // Create booking
          const booking = await bookingService.execute({
            customerName: `Test Customer ${i + 1}`,
            customerEmail: `customer${i + 1}@test.local`,
            sessionId: `session_concurrent_test_${i}`,
            idempotencyKey: `idempotency_${i}_${Date.now()}`,
            items: [
              {
                productId: testTour.id,
                adultPax: GUESTS_PER_BOOKING,
                childPax: 0,
                date: TEST_DATE_STR,
                slot: "morning",
              },
            ],
          });

          console.log(`  [${requestId}] ✅ Booking created: ${booking.id}`);

          // Simulate payment confirmation
          const confirmResult = await bookingConfirmation.confirmBooking({
            bookingId: booking.id,
            paymentId: `payment_${i}`,
          });

          if (confirmResult.success) {
            console.log(`  [${requestId}] ✅ Booking confirmed: ${booking.id}`);
            return {
              success: true,
              bookingId: booking.id,
              requestId,
            };
          } else {
            console.log(`  [${requestId}] ⚠️ Booking confirmation failed: ${confirmResult.error?.reason}`);
            return {
              success: false,
              bookingId: booking.id,
              requestId,
              error: confirmResult.error?.code || "unknown",
            };
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
          const errorCode = (errorMessage.includes("No single") || errorMessage.includes("Insufficient availability"))
            ? "CAPACITY_EXHAUSTED"
            : errorMessage.includes("hold")
              ? "HOLD_FAILED"
              : "SYSTEM_ERROR";

          console.log(`  [${requestId}] ❌ Error: ${errorCode} - ${errorMessage}`);
          return {
            success: false,
            requestId,
            error: errorCode,
          };
        }
      })()
    );

    // Execute all concurrently
    const results = await Promise.all(bookingPromises);

    console.log();
    console.log(`═══════════════════════════════════════════════════════════════`);
    console.log();

    // Step 4: Analyze results
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);
    const errorBreakdown: Record<string, number> = {};

    failed.forEach((result) => {
      const errorCode = result.error || "unknown";
      errorBreakdown[errorCode] = (errorBreakdown[errorCode] || 0) + 1;
    });

    const bookingIds = results
      .map((r) => r.bookingId)
      .filter((id): id is string => !!id);

    // Verify database state
    const allBookings = await storage.getBookingsForServiceAndDate(testTour.id, TEST_DATE_STR);
    const confirmedBookings = allBookings.filter((b) => b.status === "confirmed");
    const pendingBookings = allBookings.filter((b) => b.status === "pending");

    const overbookingDetected = confirmedBookings.length > TOUR_CAPACITY;

    console.log(`📊 RESULTS:`);
    console.log(`  • Concurrent Requests: ${NUM_CONCURRENT_REQUESTS}`);
    console.log(`  • Successful Bookings: ${successful.length}/${NUM_CONCURRENT_REQUESTS}`);
    console.log(`  • Failed Requests: ${failed.length}/${NUM_CONCURRENT_REQUESTS}`);
    console.log();
    console.log(`📦 Database State:`);
    console.log(`  • Total Bookings: ${allBookings.length}`);
    console.log(`  • Confirmed: ${confirmedBookings.length}`);
    console.log(`  • Pending: ${pendingBookings.length}`);
    console.log(`  • Tour Capacity: ${TOUR_CAPACITY}`);
    console.log();

    if (failed.length > 0) {
      console.log(`❌ Error Breakdown:`);
      Object.entries(errorBreakdown).forEach(([code, count]) => {
        console.log(`  • ${code}: ${count}`);
      });
      console.log();
    }

    // Step 5: Validation
    console.log(`🔍 VALIDATION:`);
    const validations = [
      {
        name: "No Overbooking",
        passed: !overbookingDetected,
        details: `Confirmed bookings (${confirmedBookings.length}) ≤ Capacity (${TOUR_CAPACITY})`,
      },
      {
        name: "Capacity Respected",
        passed: successful.length <= TOUR_CAPACITY,
        details: `Successful bookings (${successful.length}) ≤ Capacity (${TOUR_CAPACITY})`,
      },
      {
        name: "Overflow Rejected",
        passed: failed.length >= NUM_CONCURRENT_REQUESTS - TOUR_CAPACITY,
        details: `Rejected bookings (${failed.length}) ≥ Overflow (${NUM_CONCURRENT_REQUESTS - TOUR_CAPACITY})`,
      },
    ];

    validations.forEach((validation) => {
      const icon = validation.passed ? "✅" : "❌";
      console.log(`  ${icon} ${validation.name}: ${validation.details}`);
    });

    console.log();
    console.log(`═══════════════════════════════════════════════════════════════`);

    const allPassed = validations.every((v) => v.passed);
    if (allPassed) {
      console.log(`✅ ALL TESTS PASSED - System is safe against concurrent overbooking!`);
    } else {
      console.log(`❌ TESTS FAILED - System has race condition vulnerabilities!`);
    }

    // Step 6: Verify Metrics
    console.log();
    console.log(`📊 SYSTEM METRICS (Post-Test):`);
    const metrics = await metricsService.getMetrics();
    console.log(`  • Confirmation Successes: ${metrics.concurrency?.confirmationSuccesses}`);
    console.log(`  • Confirmation Failures: ${JSON.stringify(metrics.concurrency?.confirmationFailures)}`);
    console.log(`  • Conflict Detections: ${JSON.stringify(metrics.concurrency?.conflictDetections)}`);
    console.log(`  • Avg Confirmation Latency: ${metrics.concurrency?.avgConfirmationLatencyMs}ms`);
    console.log(`  • Confirmation Success Rate: ${metrics.concurrency?.confirmationSuccessRate}%`);
    console.log();

    if (metrics.concurrency?.confirmationSuccesses !== successful.length) {
      console.log(`⚠️  Warning: Metrics success count (${metrics.concurrency?.confirmationSuccesses}) mismatch with test success count (${successful.length})`);
    }

    console.log(`═══════════════════════════════════════════════════════════════`);
    console.log();

    return {
      totalRequests: NUM_CONCURRENT_REQUESTS,
      successful: successful.length,
      failed: failed.length,
      overbookingDetected,
      errorBreakdown,
      bookings: bookingIds,
      message: allPassed ? "✅ Test Passed" : `❌ Test Failed - Overbooking Detected!`,
    };
  } catch (error) {
    console.error("❌ Test error:", error);
    throw error;
  }
}

// Run the test
runConcurrentBookingTest().catch((error) => {
  console.error("Test execution failed:", error);
  process.exit(1);
});

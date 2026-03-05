import { db } from "../server/db";
import { storage } from "../server/storage";
import {
  products,
  tourInstances,
  availabilityHolds,
  bookings,
  resources,
  users,
} from "../shared/schema";
import { eq, and, gte } from "drizzle-orm";
import { AvailabilityService } from "../server/domain/availability/availability.service";
import { BookingConfirmationService } from "../server/domain/booking/booking-confirmation.service";
import { metricsService } from "../server/infrastructure/metrics/metrics.service";
import { sql } from "drizzle-orm";

/**
 * Phase 9: Simulation & Load Testing
 * 
 * Stress test script that validates:
 * - 500 concurrent simulated bookings
 * - Mixed products (tours, transfers, vehicles)
 * - Mixed time intervals
 * - Hold expiries
 * - No overbooking
 * - No negative capacity
 * - No race conditions
 * - Accurate final counts
 * - Pricing integrity
 */

interface LoadTestConfig {
  concurrentBookings: number;
  productCount?: number;
  daysAhead?: number;
  slotsPerDay?: number;
  logInterval?: number;
}

interface LoadTestResult {
  totalBookings: number;
  successfulBookings: number;
  failedBookings: number;
  expiredHolds: number;
  confirmationErrors: number;
  overbookingDetected: boolean;
  negativeCapacityDetected: boolean;
  pricingMismatches: number;
  finalCapacityCheck: {
    isValid: boolean;
    violations: string[];
  };
  duration: number;
  metrics: any;
}

export class LoadTester {
  private availabilityService: AvailabilityService;
  private bookingConfirmationService: BookingConfirmationService;

  constructor() {
    this.availabilityService = new AvailabilityService(storage);
    this.bookingConfirmationService = new BookingConfirmationService(storage);
  }

  /**
   * Main load test execution
   */
  async run(config: LoadTestConfig): Promise<LoadTestResult> {
    const startTime = Date.now();
    const testConfig = {
      concurrentBookings: config.concurrentBookings || 500,
      productCount: config.productCount || 5,
      daysAhead: config.daysAhead || 7,
      slotsPerDay: config.slotsPerDay || 3,
      logInterval: config.logInterval || 50,
    };

    console.log("\n════════════════════════════════════════════════════");
    console.log("🚀 LOAD TEST: Concurrent Booking Stress Test");
    console.log("════════════════════════════════════════════════════");
    console.log(`📊 Configuration:`);
    console.log(`   • Concurrent bookings: ${testConfig.concurrentBookings}`);
    console.log(`   • Products: ${testConfig.productCount}`);
    console.log(`   • Days ahead: ${testConfig.daysAhead}`);
    console.log(`   • Time slots per day: ${testConfig.slotsPerDay}`);
    console.log(`   • Log interval: ${testConfig.logInterval}`);
    console.log("════════════════════════════════════════════════════\n");

    let result: LoadTestResult = {
      totalBookings: 0,
      successfulBookings: 0,
      failedBookings: 0,
      expiredHolds: 0,
      confirmationErrors: 0,
      overbookingDetected: false,
      negativeCapacityDetected: false,
      pricingMismatches: 0,
      finalCapacityCheck: {
        isValid: true,
        violations: [],
      },
      duration: 0,
      metrics: {},
    };

    try {
      // Setup test data
      console.log("📋 Setting up test data...");
      const testProductsList = await this.setupTestProducts(testConfig.productCount);
      const testDates = this.generateTestDates(testConfig.daysAhead);
      console.log(`✅ Created ${testProductsList.length} test products and ${testDates.length} dates\n`);

      // Warm up cache
      console.log("🔥 Warming up cache...");
      for (const product of testProductsList.slice(0, 3)) {
        await this.availabilityService.checkAvailability(product.id, testDates[0]);
      }
      console.log("✅ Cache warmed up\n");

      // Generate booking requests
      console.log("📝 Generating booking requests...");
      const bookingRequests = this.generateBookingRequests(
        testConfig.concurrentBookings,
        testProductsList,
        testDates,
        testConfig.slotsPerDay
      );
      console.log(`✅ Generated ${bookingRequests.length} booking requests\n`);

      // Execute concurrent bookings
      console.log("⚡ Executing concurrent bookings...");
      console.log(`   Processing ${testConfig.concurrentBookings} requests in parallel\n`);

      const bookingResults = await Promise.allSettled(
        bookingRequests.map((req, idx) =>
          this.executeBookingFlow(req, idx, testConfig.logInterval)
        )
      );

      // Process results
      for (const res of bookingResults) {
        if (res.status === "fulfilled") {
          result.totalBookings++;
          if (res.value.success) {
            result.successfulBookings++;
          } else {
            result.failedBookings++;
            if (res.value.error?.includes("pricing")) {
              result.pricingMismatches++;
            }
          }
        }
      }

      console.log(`\n✅ Booking execution complete\n`);

      // Simulate hold expiries
      console.log("⏰ Simulating hold expiries...");
      result.expiredHolds = await this.simulateHoldExpiries();
      console.log(`✅ Auto-released ${result.expiredHolds} expired holds\n`);

      // Validate final state
      console.log("🔍 Validating final capacity state...");
      result.finalCapacityCheck = await this.validateFinalCapacityState(testProductsList);
      if (!result.finalCapacityCheck.isValid) {
        result.overbookingDetected = result.finalCapacityCheck.violations.some(v =>
          v.includes("overbooking")
        );
        result.negativeCapacityDetected = result.finalCapacityCheck.violations.some(v =>
          v.includes("negative")
        );
      }
      console.log(`✅ Capacity validation complete\n`);

      // Collect metrics
      result.metrics = await metricsService.getMetrics();
      result.duration = Date.now() - startTime;

      // Print results
      this.printResults(result);

      return result;
    } catch (error) {
      console.error("❌ Load test failed:", error);
      throw error;
    }
  }

  private async setupTestProducts(count: number) {
    const testProductsList: any[] = [];

    // Check if test products already exist
    const existingTours = await db.select().from(products).limit(count);
    if (existingTours.length >= count) {
      console.log(
        `   Using existing ${count} products...`
      );
      return existingTours;
    }

    console.log(`   Creating ${count} test products...`);

    const categories = ["tour", "transfer", "vehicle"];
    for (let i = 0; i < count; i++) {
      const category = categories[i % categories.length];
      const [product] = await db
        .insert(products)
        .values({
          title: `Load Test ${category} ${i + 1}`,
          price: "0",
          adultPriceCents: 10000 + i * 1000,
          childPriceCents: 5000 + i * 500,
          duration: "2h",
          image: "test",
          description: ["Load test product"],
          category,
          defaultCapacity: 20,
        })
        .returning();
      testProductsList.push(product);

      // Create some resources for vehicles
      if (category === "vehicle") {
        for (let j = 0; j < 3; j++) {
          await db.insert(resources).values({
            productId: product.id,
            name: `Test Vehicle ${i}-${j}`,
            seatCapacity: 6,
          });
        }
      }
    }

    return testProductsList;
  }

  private generateTestDates(daysAhead: number): string[] {
    const dates: string[] = [];
    const now = new Date();
    for (let i = 1; i <= daysAhead; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() + i);
      dates.push(date.toISOString().split("T")[0]);
    }
    return dates;
  }

  private generateBookingRequests(
    count: number,
    products: any[],
    dates: string[],
    slotsPerDay: number
  ): any[] {
    const requests = [];
    const timeSlots = ["09:00", "12:00", "15:00"].slice(0, slotsPerDay);

    for (let i = 0; i < count; i++) {
      const product = products[i % products.length];
      const date = dates[i % dates.length];
      const slot = timeSlots[i % timeSlots.length];
      const quantity = 1 + (i % 4); // 1-4 pax
      const sessionId = `session_${Math.floor(i / 5)}`; // Group into sessions

      requests.push({
        tourId: product.id,
        date,
        slot,
        quantity,
        sessionId,
        requestIndex: i,
      });
    }

    return requests;
  }

  private async executeBookingFlow(request: any, idx: number, logInterval: number) {
    try {
      // Create hold
      const hold = await this.availabilityService.createHoldWithInvalidation({
        tourId: request.tourId,
        date: request.date,
        quantity: request.quantity,
        sessionId: request.sessionId,
        slot: request.slot,
        ttlMinutes: 15,
      });

      // Create booking record
      const [booking] = await db
        .insert(bookings)
        .values({
          bookingSessionId: request.sessionId,
          tourId: request.tourId,
          date: request.date,
          guests: request.quantity,
          amount: "0",
          customerName: `Test Customer ${idx}`,
          customerEmail: `test${idx}@example.com`,
          tourName: `Test Tour`,
          status: "pending",
        })
        .returning();

      // Confirm booking
      const confirmResult = await this.bookingConfirmationService.confirmBooking({
        holdId: hold.id,
        bookingId: booking.id,
        idempotencyKey: `test_${idx}`,
        expectedTotalCents: 10000,
        adultPax: request.quantity,
        childPax: 0,
      });

      if (idx % logInterval === 0) {
        console.log(`   [${idx}] Booking confirmed: ${booking.id}`);
      }

      return {
        success: confirmResult.confirmed,
        bookingId: booking.id,
        holdId: hold.id,
        error: confirmResult.reason,
      };
    } catch (error: any) {
      if (idx % logInterval === 0) {
        console.log(
          `   [${idx}] ⚠️  Booking failed: ${error.message}`
        );
      }
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async simulateHoldExpiries(): Promise<number> {
    // Get expired holds
    const now = new Date();
    const result = await db.execute(
      sql`SELECT COUNT(*) as count FROM availability_holds 
          WHERE status = 'ACTIVE' AND expires_at < ${now}`
    );

    const expiredCount = (result.rows?.[0] as any)?.count || 0;

    // In a real scenario, the hold expiry job would handle this
    // For testing, we can manually mark them as expired
    if (expiredCount > 0) {
      await db.execute(
        sql`UPDATE availability_holds 
            SET status = 'EXPIRED' 
            WHERE status = 'ACTIVE' AND expires_at < ${now}`
      );
    }

    return expiredCount;
  }

  private async validateFinalCapacityState(products: any[]) {
    const violations: string[] = [];
    let isValid = true;

    for (const product of products) {
      const instances = await db
        .select()
        .from(tourInstances)
        .where(eq(tourInstances.tourId, product.id));

      for (const instance of instances) {
        const total = instance.confirmedCount + instance.heldCount + instance.blockedCount;

        // Check for negative capacity
        if (instance.confirmedCount < 0 || instance.heldCount < 0 || instance.blockedCount < 0) {
          violations.push(
            `[${product.title}] Negative capacity detected: confirmed=${instance.confirmedCount}, held=${instance.heldCount}, blocked=${instance.blockedCount}`
          );
          isValid = false;
        }

        // Check for overbooking
        if (total > instance.totalCapacity) {
          violations.push(
            `[${product.title}] Overbooking detected: ${total} reserved > ${instance.totalCapacity} capacity on ${instance.serviceDate}`
          );
          isValid = false;
        }

        // Validate sum consistency
        const activeHolds = await db
          .select()
          .from(availabilityHolds)
          .where(
            and(
              eq(availabilityHolds.tourInstanceId, instance.id),
              eq(availabilityHolds.status, "ACTIVE")
            )
          );

        const confirmedBookings = await db
          .select()
          .from(bookings)
          .where(
            and(
              eq(bookings.tourInstanceId, instance.id),
              eq(bookings.status, "confirmed")
            )
          );

        const expectedHeld = activeHolds.reduce((sum: number, h: any) => sum + (h.quantity || 0), 0);
        const expectedConfirmed = confirmedBookings.reduce((sum: number, b: any) => sum + (b.guests || 0), 0);

        if (expectedHeld !== instance.heldCount) {
          violations.push(
            `[${product.title}] Hold count mismatch: expected=${expectedHeld}, actual=${instance.heldCount}`
          );
          isValid = false;
        }

        if (expectedConfirmed !== instance.confirmedCount) {
          violations.push(
            `[${product.title}] Confirmed count mismatch: expected=${expectedConfirmed}, actual=${instance.confirmedCount}`
          );
          isValid = false;
        }
      }
    }

    return { isValid, violations };
  }

  private printResults(result: LoadTestResult) {
    const successRate = ((result.successfulBookings / result.totalBookings) * 100).toFixed(1);
    const failureRate = ((result.failedBookings / result.totalBookings) * 100).toFixed(1);

    console.log("════════════════════════════════════════════════════");
    console.log("📊 LOAD TEST RESULTS");
    console.log("════════════════════════════════════════════════════");
    console.log(`\n⏱️  Duration: ${(result.duration / 1000).toFixed(2)}s`);
    console.log(`\n📈 Booking Results:`);
    console.log(`   • Total bookings: ${result.totalBookings}`);
    console.log(
      `   • ✅ Successful: ${result.successfulBookings} (${successRate}%)`
    );
    console.log(
      `   • ❌ Failed: ${result.failedBookings} (${failureRate}%)`
    );
    console.log(`   • 🔄 Expired holds: ${result.expiredHolds}`);

    console.log(`\n⚠️  Issues:`);
    console.log(`   • Pricing mismatches: ${result.pricingMismatches}`);
    console.log(
      `   • Overbooking detected: ${result.overbookingDetected ? "🔴 YES" : "🟢 NO"}`
    );
    console.log(
      `   • Negative capacity: ${result.negativeCapacityDetected ? "🔴 YES" : "🟢 NO"}`
    );

    if (result.finalCapacityCheck.violations.length > 0) {
      console.log(`\n🚨 Capacity Violations:`);
      result.finalCapacityCheck.violations.forEach(v => {
        console.log(`   • ${v}`);
      });
    } else {
      console.log(`\n✅ Final Capacity State: VALID`);
    }

    console.log(`\n📊 System Metrics:`);
    if (result.metrics) {
      console.log(`   • Total holds (lifetime): ${result.metrics.totalHolds}`);
      console.log(`   • Expired holds: ${result.metrics.expiredHolds}`);
      console.log(`   • Confirmed bookings: ${result.metrics.confirmedBookings}`);
      console.log(
        `   • Failure rate: ${result.metrics.failureRate.toFixed(2)}%`
      );
      console.log(
        `   • Max utilization: ${result.metrics.maxUtilization.toFixed(1)}%`
      );
      if (result.metrics.criticalUtilization?.length > 0) {
        console.log(`   • Critical products: ${result.metrics.criticalUtilization.length}`);
      }
    }

    console.log("\n════════════════════════════════════════════════════");
    const status =
      result.overbookingDetected || result.negativeCapacityDetected
        ? "❌ FAILED"
        : "✅ PASSED";
    console.log(`🎯 Overall Result: ${status}`);
    console.log("════════════════════════════════════════════════════\n");
  }
}

export async function runLoadTest() {
  const tester = new LoadTester();

  try {
    const result = await tester.run({
      concurrentBookings: 500,
      productCount: 5,
      daysAhead: 7,
      slotsPerDay: 3,
      logInterval: 50,
    });

    // Exit with proper code
    process.exit(result.overbookingDetected || result.negativeCapacityDetected ? 1 : 0);
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

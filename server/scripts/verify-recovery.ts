import { db } from "../db.js";
import { bookings, tourInstances, payments, paymentGateways } from "../../shared/schema.js";
import { eq, and, sql, desc } from "drizzle-orm";
import { InventoryRepairService } from "../application/availability/inventory-repair.service.js";
import { PaymentBookingDiffService } from "../application/recovery/recovery-report.service.js";
import { storage } from "../storage.js";
import { PaymentStatus } from "../domain/payments/interfaces.js";

async function runVerification() {
  console.log("=== RECOVERY TOOLING VERIFICATION ===");
  const repairService = new InventoryRepairService(storage);
  const diffService = new PaymentBookingDiffService();

  try {
    // 1. Setup: Ensure we have at least one tour instance and one booking
    const [instance] = await db.select().from(tourInstances).limit(1);
    if (!instance) {
      console.error("No data found for verification. Please run seeds first.");
      return;
    }

    // SCENARIO 1: Inventory Desynchronization
    console.log(`\n[SCENARIO 1] Simulating inventory desync for instance ${instance.id}...`);
    const originalCount = instance.confirmedCount;
    
    // Maliciously set confirmedCount to something wrong
    await db.update(tourInstances).set({ confirmedCount: 999 }).where(eq(tourInstances.id, instance.id));
    console.log(`- Set confirmedCount to 999 (Truth: likely ${originalCount})`);

    // Run repair
    console.log("- Running repairTourInstance...");
    const repairResult = await repairService.repairTourInstance(instance.id);
    console.log(`- Result: Before=${repairResult.beforeCount}, After=${repairResult.afterCount}, Delta=${repairResult.delta}`);
    
    if (repairResult.afterCount !== 999 && repairResult.status === 'fixed') {
      console.log("✅ Inventory repair successful.");
    } else {
      console.error("❌ Inventory repair failed or confirmedCount was actually 999.");
    }

    // SCENARIO 2: Payment/Booking Inconsistency (Money in but Inventory Pending)
    console.log("\n[SCENARIO 2] Simulating payment/booking inconsistency...");
    
    const [gateway] = await db.select().from(paymentGateways).limit(1);
    if (!gateway) {
      console.error("No payment gateways found. Verification cannot proceed.");
      return;
    }

    const [testBooking] = await db.insert(bookings).values({
      tourId: instance.tourId,
      bookingSessionId: "TEST_SESSION",
      customerName: "Test User",
      customerEmail: "test@example.test",
      tourName: "Test Tour",
      date: instance.serviceDate,
      guests: 1,
      amount: "50.00",
      status: "pending",
      tourInstanceId: instance.id,
      createdAt: new Date()
    }).returning();

    const [testPayment] = await db.insert(payments).values({
      bookingId: testBooking.id,
      gatewayId: gateway.id,
      amount: 5000,
      currency: "USD",
      status: PaymentStatus.Completed,
      gatewayReference: "TEST_REF_INCONSISTENT",
      createdAt: new Date()
    }).returning();

    console.log(`- Created pending booking ${testBooking.id} with completed payment ${testPayment.id}`);

    // Generate Diff Report
    console.log("- Generating Diff Report...");
    const report = await diffService.generateReport();
    const issueEntry = report.entries.find((e: any) => e.paymentId === testPayment.id);
    
    if (issueEntry && issueEntry.type === 'payment_without_inventory') {
      console.log(`✅ Inconsistency detected: ${issueEntry.description}`);
      console.log(`- Severity: ${issueEntry.severity}, Recommended: ${issueEntry.recommendedAction.label}`);
    } else {
      console.error("❌ Inconsistency NOT detected in report.");
    }

    // Cleanup
    await db.delete(payments).where(eq(payments.id, testPayment.id));
    await db.delete(bookings).where(eq(bookings.id, testBooking.id));
    // Restore original count
    await db.update(tourInstances).set({ confirmedCount: originalCount }).where(eq(tourInstances.id, instance.id));

    console.log("\n=== VERIFICATION COMPLETE ===");
  } catch (error) {
    console.error("Verification failed with error:", error);
  } finally {
    process.exit(0);
  }
}

runVerification();

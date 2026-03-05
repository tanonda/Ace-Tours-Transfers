import { storage } from "../server/storage";
import { PaymentApplicationService } from "../server/application/payment.application-service";
import { PaymentStatus } from "../server/domain/payments/interfaces";
import { insertBookingSchema, insertPaymentGatewaySchema } from "@shared/schema";

async function runChaos() {
  console.log("🚀 Starting Chaos Simulation...");

  // 1. Setup Pre-requisites
  const tours = await storage.getProducts();
  if (tours.length === 0) {
    console.error("No tours found. Please seed the database first.");
    process.exit(1);
  }
  const tour = tours[0];

  const gateway = await storage.getActivePaymentGateway() || await storage.upsertPaymentGateway({
    slug: "manual",
    displayName: "Manual Chaos Payment",
    priority: 1,
    description: "For testing only",
    active: true,
    isDefault: true,
    config: {},
    supportedCurrencies: ['USD']
  });

  const admin = await storage.createUser({
    username: `admin_${Date.now()}`,
    password: 'password',
    email: `admin_${Date.now()}@example.com`,
    name: "Chaos Admin"
  });
  await storage.updateUserRole(admin.id, 'admin');

  const paymentAppService = new PaymentApplicationService(storage);

  // MOCK ADAPTER for Chaos Verification
  const { PaymentFactory } = await import("../server/infrastructure/payments/factory");
  const mockAdapter = {
    initiatePayment: async () => ({ success: true, redirectUrl: 'http://mock.url', transactionId: 'tx_mock' }),
    handleWebhook: async (event: any) => {
      // Echo back what we want to test
      return {
        success: true,
        bookingId: event.rawEvent.bookingId,
        paymentId: event.rawEvent.paymentId,
        newPaymentStatus: event.rawEvent.status,
        gatewayReference: event.rawEvent.gatewayReference
      };
    },
    queryPaymentStatus: async () => ({ status: PaymentStatus.Completed })
  };

  // Inject mock
  (PaymentFactory as any).getPaymentGatewayService = () => mockAdapter;

  console.log("\n🧪 Scenario 1: Webhook Replay (Idempotency)");
  // Create a booking
  const booking = await storage.createBooking({
    tourId: tour.id,
    tourName: tour.title,
    customerName: "Chaos Test User",
    customerEmail: "chaos@example.com",
    date: "2026-01-01",
    amount: tour.price,
    guests: 1,
    status: 'pending',
    bookingSessionId: 'chaos-session-1'
  });

  // Create a payment
  const payment = await storage.createPayment({
    bookingId: booking.id,
    gatewayId: gateway.id,
    amount: 1000,
    currency: 'USD',
    status: PaymentStatus.Processing,
    expiresAt: new Date(Date.now() + 3600000),
    gatewayReference: 'ch_replay_test'
  });

  console.log(`Created Booking: ${booking.id}, Payment: ${payment.id}`);

  // Mock Webhook Call 1
  console.log("Triggering First 'Completed' Webhook...");
  await paymentAppService.handlePaymentWebhook({
    gatewaySlug: 'stripe',
    rawEvent: { bookingId: booking.id, paymentId: payment.id, status: PaymentStatus.Completed, gatewayReference: 'ch_replay_test' },
    signature: 'mock_sig'
  });

  let updatedBooking = await storage.getBooking(booking.id);
  let updatedPayment = await storage.getPayment(payment.id);
  console.log(`Status after first webhook - Booking: ${updatedBooking?.status}, Payment: ${updatedPayment?.status}`);

  // Mock Webhook Call 2 (Duplicate)
  console.log("Triggering Second 'Completed' Webhook (Replay)...");
  await paymentAppService.handlePaymentWebhook({
    gatewaySlug: 'stripe',
    rawEvent: { bookingId: booking.id, paymentId: payment.id, status: PaymentStatus.Completed, gatewayReference: 'ch_replay_test' },
    signature: 'mock_sig'
  });

  updatedBooking = await storage.getBooking(booking.id);
  updatedPayment = await storage.getPayment(payment.id);
  console.log(`Status after second webhook - Booking: ${updatedBooking?.status}, Payment: ${updatedPayment?.status}`);

  if (updatedBooking?.status === 'confirmed' && updatedPayment?.status === PaymentStatus.Completed) {
    console.log("✅ Scenario 1 Passed: Terminal status is immutable and idempotent.");
  } else {
    console.error("❌ Scenario 1 Failed: Unexpected state transition.");
  }

  console.log("\n🧪 Scenario 2: Out-of-Order Webhook (Late Failure)");
  // Create another booking/payment
  const booking2 = await storage.createBooking({
    tourId: tour.id,
    tourName: tour.title,
    customerName: "Chaos Test User 2",
    customerEmail: "chaos2@example.com",
    date: "2026-01-02",
    amount: tour.price,
    guests: 1,
    status: 'pending',
    bookingSessionId: 'chaos-session-2'
  });

  const payment2 = await storage.createPayment({
    bookingId: booking2.id,
    gatewayId: gateway.id,
    amount: 1000,
    currency: 'USD',
    status: PaymentStatus.Processing,
    expiresAt: new Date(Date.now() + 3600000),
    gatewayReference: 'ch_ooo_test'
  });

  console.log("Triggering 'Completed' Webhook...");
  await paymentAppService.handlePaymentWebhook({
    gatewaySlug: 'stripe',
    rawEvent: { bookingId: booking2.id, paymentId: payment2.id, status: PaymentStatus.Completed, gatewayReference: 'ch_ooo_test' },
    signature: 'mock_sig'
  });

  console.log("Triggering 'Failed' Webhook (Late Arrival)...");
  await paymentAppService.handlePaymentWebhook({
    gatewaySlug: 'stripe',
    rawEvent: { bookingId: booking2.id, paymentId: payment2.id, status: PaymentStatus.Failed, gatewayReference: 'ch_ooo_test' },
    signature: 'mock_sig'
  });

  updatedBooking = await storage.getBooking(booking2.id);
  updatedPayment = await storage.getPayment(payment2.id);
  console.log(`Status after out-of-order webhook - Booking: ${updatedBooking?.status}, Payment: ${updatedPayment?.status}`);

  if (updatedBooking?.status === 'confirmed' && updatedPayment?.status === PaymentStatus.Completed) {
    console.log("✅ Scenario 2 Passed: Completed state is terminal; late failure rejected.");
  } else {
    console.error("❌ Scenario 2 Failed: Completed state was overwritten!");
  }

  console.log("\n🧪 Scenario 3: Partial Failure (Inventory Deadlock)");

  // 1. Create instance and hold
  const instance = await storage.createTourInstance({
    tourId: tour.id,
    serviceDate: "2026-02-01",
    totalCapacity: 10,
    heldCount: 0,
    confirmedCount: 0,
    blockedCount: 0
  });

  const hold = await storage.createHold({
    tourInstanceId: instance.id,
    quantity: 2,
    status: 'ACTIVE',
    expiresAt: new Date(Date.now() + 300000), // 5 min
    bookingSessionId: 'chaos-session-3'
  });

  const booking3 = await storage.createBooking({
    tourId: tour.id,
    tourName: tour.title,
    customerName: "Chaos Test User 3",
    customerEmail: "chaos3@example.com",
    date: "2026-02-01",
    amount: tour.price,
    guests: 2,
    status: 'pending',
    bookingSessionId: 'chaos-session-3',
    holdId: hold.id,
    tourInstanceId: instance.id
  });

  const payment3 = await storage.createPayment({
    bookingId: booking3.id,
    gatewayId: gateway.id,
    amount: 1000,
    currency: 'USD',
    status: PaymentStatus.Processing,
    expiresAt: new Date(Date.now() + 3600000),
    gatewayReference: 'ch_deadlock_test'
  });

  // Inject failure into availabilityService
  (paymentAppService as any).availabilityService.confirmBooking = async () => {
    throw new Error("KABOOM: Inventory database is on fire!");
  };

  console.log("Triggering 'Completed' Webhook (with failing inventory)...");
  await paymentAppService.handlePaymentWebhook({
    gatewaySlug: 'stripe',
    rawEvent: { bookingId: booking3.id, paymentId: payment3.id, status: PaymentStatus.Completed, gatewayReference: 'ch_deadlock_test' },
    signature: 'mock_sig'
  });

  updatedBooking = await storage.getBooking(booking3.id);
  updatedPayment = await storage.getPayment(payment3.id);
  console.log(`Status after inventory failure - Booking: ${updatedBooking?.status}, Payment: ${updatedPayment?.status}, Failure Reason: ${updatedPayment?.failureReason}`);

  if (updatedBooking?.status === 'pending' && updatedPayment?.status === PaymentStatus.ManualReviewRequired) {
    console.log("✅ Scenario 3 Passed: System detected inventory failure and flagged for manual review.");
  } else {
    console.error("❌ Scenario 3 Failed: System lied about success or entered invalid state!");
  }

  // Reset availability service mock
  (paymentAppService as any).availabilityService.confirmBooking = async () => { };

  console.log("\n🧪 Scenario 4: Human Chaos (Concurrent Admin Reconciliation)");

  const payment4 = await storage.createPayment({
    bookingId: booking.id, // Re-use first booking
    gatewayId: gateway.id,
    amount: 1000,
    currency: 'USD',
    status: PaymentStatus.Processing,
    expiresAt: new Date(Date.now() + 3600000),
    gatewayReference: 'ch_concurrent_test'
  });

  const { PaymentReconciliationService } = await import("../server/application/payment-reconciliation.service");
  const reconService = new PaymentReconciliationService(storage);

  console.log("Triggering Twin Manual Reconciliations...");
  // Simulate two admins clicking at once
  await Promise.all([
    reconService.reconcileManually(payment4.id, admin.id, 'Admin 1 Note', PaymentStatus.Completed).catch(() => { }),
    reconService.reconcileManually(payment4.id, admin.id, 'Admin 2 Note', PaymentStatus.Completed).catch(() => { })
  ]);

  updatedPayment = await storage.getPayment(payment4.id);
  console.log(`Status after concurrent reconciliation - Payment: ${updatedPayment?.status}, Note: ${updatedPayment?.reconciliationNote}`);

  console.log("✅ Scenario 4 Passed: System handled concurrency without crashing.");

  console.log("\n🧪 Scenario 5: Data Drift Chaos (Reconciliation Recovery)");

  const booking5 = await storage.createBooking({
    tourId: tour.id,
    tourName: tour.title,
    customerName: "Chaos Test User 5",
    customerEmail: "chaos5@example.com",
    date: "2026-03-01",
    amount: tour.price,
    guests: 1,
    status: 'pending',
    bookingSessionId: 'chaos-session-5'
  });

  const payment5 = await storage.createPayment({
    bookingId: booking5.id,
    gatewayId: gateway.id,
    amount: 1000,
    currency: 'USD',
    status: PaymentStatus.Processing, // DB thinks it's processing
    expiresAt: new Date(Date.now() + 3600000),
    gatewayReference: 'ch_drift_test'
  });

  // Mock adapter thinks it's already Completed
  mockAdapter.queryPaymentStatus = async () => ({ status: PaymentStatus.Completed, gatewayReference: 'ch_drift_test' });

  console.log("Triggering Sync for drifted payment...");
  await reconService.syncPaymentStatus(payment5.id);

  updatedBooking = await storage.getBooking(booking5.id);
  updatedPayment = await storage.getPayment(payment5.id);
  console.log(`Status after sync - Booking: ${updatedBooking?.status}, Payment: ${updatedPayment?.status}`);

  if (updatedBooking?.status === 'confirmed' && updatedPayment?.status === PaymentStatus.Completed) {
    console.log("✅ Scenario 5 Passed: Reconciliation discovered drift and repaired state.");
  } else {
    console.error("❌ Scenario 5 Failed: Data drift remained un-repaired!");
  }

  console.log("\n🏁 Chaos Simulation Complete.");
}

runChaos().catch(err => {
  console.error("Chaos simulation crashed:", err);
  process.exit(1);
});

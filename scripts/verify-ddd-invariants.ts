
import { Cart } from "../server/domain/booking/Cart";
import { Booking, BookingStatus } from "../server/domain/booking/Booking";
import { PricingService } from "../server/domain/pricing/PricingService";
import { PaymentIntent, PaymentIntentStatus } from "../server/domain/payments/PaymentIntent";

// Mocking config since we are in a script context
// PricingService expects config.ddd
(global as any).config = {
  ddd: {
    vatRateOverride: 0.15
  }
};

async function runTests() {
  console.log("--- Starting DDD Invariant Verification ---");

  // 1. Cart Invariants
  console.log("\n[TEST] Cart Invariants");
  const cart = new Cart("test_cart");
  try {
    cart.setPricedSnapshot({} as any);
    console.error("FAIL: Should not be able to price an empty cart");
  } catch (e: any) {
    console.log("PASS: Empty cart pricing rejected:", e.message);
  }

  cart.addItem({ productId: "tour1", name: "Tour 1", unitPriceCents: 10000, quantity: 2, date: "2024-01-01", productType: "tour", adultPax: 0, childPax: 0 });
  console.log("PASS: Item added to cart");

  const snapshot = PricingService.createSnapshot([{ productId: "tour1", name: "Tour 1", unitPriceCents: 10000, quantity: 2, adultPax: 0, childPax: 0 }]);
  cart.setPricedSnapshot(snapshot);
  console.log("PASS: Cart priced successfully. Total:", snapshot.totalCents, "VAT:", snapshot.vatAmountCents);

  // 2. Booking Invariants
  console.log("\n[TEST] Booking Invariants");
  try {
    Booking.createFromCart("book1", cart, { name: "Guest", email: "invalid" });
    console.error("FAIL: Should reject invalid email");
  } catch (e: any) {
    console.log("PASS: Invalid email rejected:", e.message);
  }

  // New test for booking amount matching snapshot
  const booking = Booking.createFromCart("book1", cart, { name: "John Doe", email: "john@example.com" });
  console.log("PASS: Booking created from Cart. Status:", booking.status);

  // Simulate a cart item with specific properties for the new invariant test
  // NOTE: In a real scenario, we would create a NEW cart or clear it, but here we just reuse.
  // We'll skip adding a new item as it might conflict with existing snapshot logic in this simple script.
  // Instead just check existing booking against existing snapshot.

  if (booking.amountCents !== snapshot.totalCents) {
    throw new Error(`Invariant Violation: Booking total ${booking.amountCents} != Snapshot ${snapshot.totalCents}`);
  }
  else {
    console.log("PASS: Booking amount matches Cart snapshot total");
  }

  // 3. Payment Invariants
  console.log("\n[TEST] Payment Invariants");
  try {
    new PaymentIntent({
      id: "pay1",
      bookingId: "book1",
      amount: 100,
      currency: "VUV",
      method: "Stripe",
      provider: "Stripe",
      status: PaymentIntentStatus.PENDING
    });
    console.error("FAIL: Should reject Method == Provider");
  } catch (e: any) {
    console.log("PASS: Method/Provider equality constraint enforced:", e.message);
  }

  const intent = PaymentIntent.initiate("pay1", booking.id, booking.amountCents * 100, "Bank Transfer", "anz");
  console.log("PASS: Payment intent initiated");

  intent.receive();
  console.log("PASS: Payment status transitioned to RECEIVED");

  try {
    intent.fail("too late");
    console.error("FAIL: Should not transition from RECEIVED to FAILED");
  } catch (e: any) {
    console.log("PASS: Illegal status transition rejected:", e.message);
  }

  console.log("\n--- DDD Verification Complete ---");
}

runTests().catch(console.error);

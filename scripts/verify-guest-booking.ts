import { storage } from '../server/storage';
import { AvailabilityApplicationService } from '../server/application/availability/availability.application-service';
import { PaymentApplicationService } from '../server/application/payment.application-service';
import crypto from 'crypto';

async function verifyGuestBooking() {
  console.log("Starting Guest Booking Verification...");
  
  const availabilityService = new AvailabilityApplicationService(storage);
  const paymentService = new PaymentApplicationService(storage);
  
  const tourId = "scenic";
  const date = new Date().toISOString().split('T')[0];
  const sessionId = "test-session-" + crypto.randomBytes(4).toString('hex');
  
  try {
    // 0. Ensure Stripe is active in DB
    console.log("Ensuring Stripe gateway is active...");
    await storage.upsertPaymentGateway({
      slug: "stripe",
      displayName: "Stripe",
      description: "Secure card payment via Stripe",
      active: true,
      isDefault: false,
      credentials: {
        apiKey: "sk_test_mock",
        secretKey: "sk_test_mock",
        publishableKey: "pk_test_mock"
      },
      supportedCurrencies: ["USD", "AUD", "VUV"],
      config: {}
    });

    // 1. Create Hold
    console.log(`Creating hold for tour ${tourId} on ${date}...`);
    const hold = await availabilityService.createHold({
      tourId,
      date,
      quantity: 2,
      sessionId
    });
    console.log("Hold created:", hold.id);
    
    // 2. Create Booking
    console.log("Creating guest booking...");
    const booking = await storage.createBooking({
      tourId,
      date,
      guests: 2,
      amount: "$240",
      status: "pending",
      customerName: "Guest User",
      customerEmail: "guest@example.com",
      tourName: "Efate Scenic Tour",
      bookingSessionId: sessionId,
      holdId: hold.id,
      userId: null,
      tourInstanceId: hold.tourInstanceId
    });
    console.log("Booking created:", booking.id);
    
    // 3. Verify Booking
    console.log("Verifying booking data...");
    const savedBooking = await storage.getBooking(booking.id);
    if (!savedBooking || savedBooking.userId !== null || savedBooking.customerEmail !== "guest@example.com") {
      throw new Error("Booking verification failed: Incorrect data saved.");
    }
    console.log("Booking data verified.");
    
    // 4. Initiate Checkout
    console.log("Initiating guest checkout...");
    const checkout = await paymentService.initiateBookingPayment({
      bookingId: booking.id,
      provider: "stripe",
      successUrl: "http://localhost:5000/success",
      cancelUrl: "http://localhost:5000/cancel"
    });
    
    if (checkout.success && checkout.redirectUrl) {
      console.log("Checkout initiation success! URL:", checkout.redirectUrl);
    } else {
      throw new Error(`Checkout initiation failed: ${checkout.message}`);
    }
    
    console.log("\nGuest Booking Verification PASSED!");
    process.exit(0);
  } catch (error: any) {
    console.error("\nGuest Booking Verification FAILED!");
    console.error(error);
    process.exit(1);
  }
}

verifyGuestBooking();

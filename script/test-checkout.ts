import "dotenv/config";
import { db } from "../server/db.js";
import { bookings } from "../shared/schema.js";
import { PaymentApplicationService } from "../server/application/payment.application-service.js";
import { DatabaseStorage } from "../server/storage.js";
import { eq } from "drizzle-orm";

async function run() {
    const storage = new DatabaseStorage();
    storage.getHold = async () => ({ expiresAt: new Date(Date.now() + 3600000) } as any);
    const paymentAppService = new PaymentApplicationService(storage);

    const booking = await db.query.bookings.findFirst({
        where: eq(bookings.status, 'pending')
    });

    if (!booking) {
        console.log("No pending booking found for test");
        process.exit(0);
    }

    console.log("Found pending booking:", booking.id);
    console.log("Customer email:", booking.customerEmail);
    console.log("Total Amount Cents:", booking.totalAmountCents);

    if (booking.holdId) {
        console.log("Extending hold expiry for test...");
        const { sql } = await import("drizzle-orm");
        await db.execute(sql`UPDATE availability_holds SET expires_at = NOW() + INTERVAL '1 hour' WHERE id = ${booking.holdId}`);
    }

    try {
        console.log("Initiating Payment for manual_transfer...");
        const result = await paymentAppService.initiateBookingPayment({
            bookingId: booking.id,
            userId: undefined,
            sessionId: booking.bookingSessionId,
            recentBookingIds: [],
            provider: 'manual_transfer',
            successUrl: `http://localhost:5000/payment/success?booking=${booking.id}`,
            cancelUrl: `http://localhost:5000/payment/cancel?booking=${booking.id}`,
        });

        console.log("Result:", result);

        // The fire-and-forget block might still be running. Let's wait a bit.
        await new Promise(resolve => setTimeout(resolve, 3000));

    } catch (err: any) {
        console.error("CRASH:", err);
    }
    process.exit(0);
}

run();

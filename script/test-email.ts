import "dotenv/config";
import { db } from "../server/db.js";
import { bookings, bookingItems, products } from "../shared/schema.js";
import { getBookingRequestTemplate, getAdminNewBookingTemplate, sendEmail, sendAdminEmail } from "../server/lib/mail.js";
import { eq } from "drizzle-orm";

async function run() {
    const booking = await db.query.bookings.findFirst({
        where: eq(bookings.status, 'pending')
    });

    if (!booking) {
        console.log("No pending booking found for test");
        process.exit(0);
    }
    console.log("Found booking:", booking.id);

    try {
        const items = await db.select().from(bookingItems).where(eq(bookingItems.bookingId, booking.id));
        const firstItem = items[0];

        let tourInfo = { title: 'Tour/Transfer Booking', id: '' };
        if (firstItem) {
            const tourData = await db.query.products.findFirst({
                where: eq(products.id, firstItem.productId)
            });
            if (tourData) tourInfo = tourData;
        }

        function buildGuestString(item: any): string {
            const parts: string[] = [
                `${item?.adultPax || 1} Adult(s)`,
            ];
            if (item?.childPax) parts.push(`${item.childPax} Child(ren)`);
            if (item?.infantPax) parts.push(`${item.infantPax} Infant(s)`);
            if (item?.petPax) parts.push(`${item.petPax} Pet(s)`);
            return parts.join(", ");
        }

        const emailBooking = {
            ...booking,
            date: booking.date || new Date().toISOString().split('T')[0],
            guests: buildGuestString(firstItem),
            amount: `VT ${(booking.totalAmountCents || 0).toLocaleString()}`,
        };

        console.log("Attempting to generate getBookingRequestTemplate...");
        const guestHtml = await getBookingRequestTemplate(emailBooking, tourInfo, 'bank_transfer');

        console.log("Attempting to generate getAdminNewBookingTemplate...");
        const adminHtml = await getAdminNewBookingTemplate(emailBooking, tourInfo);

        console.log("Attempting to sendEmail to guest...");
        await sendEmail({
            to: 'guest@example.com',
            subject: 'Test Guest Email',
            html: guestHtml
        });
        console.log("sendEmail success!");

        console.log("Attempting to sendAdminEmail...");
        await sendAdminEmail('Test Admin Email', adminHtml);
        console.log("sendAdminEmail success!");

    } catch (err: any) {
        console.error("CRASH:", err);
    }
    process.exit(0);
}

run();

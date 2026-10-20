// What follows an admin's change of a booking's status (the PATCH route and the statement-match
// confirm both use it): a confirm completes the booking's open offline payment
// (manual-confirmation.ts), and the guest gets the status email (or, for a completion, the review
// request). Failures here never fail the change.
import type { Booking } from "../../shared/schema.js";
import { storage } from "../storage.js";
import { sendEmail, getBookingStatusUpdateTemplate, shortBookingRef } from "./mail.js";
import { sendReviewRequest } from "./review-request.js";
import { completeManualConfirmation } from "./manual-confirmation.js";

export async function afterAdminStatusChange(existing: Pick<Booking, "status">, booking: Booking, status: string): Promise<void> {
  if (status === existing.status) return;

  // A confirm by hand completes the booking's offline payment as a gateway payment would, so the
  // bank transfer saga never expires it later. (Its seat holds were confirmed with the status write.)
  if (status === "confirmed") {
    await completeManualConfirmation(storage, booking)
      .catch((err) => console.error(`[BOOKING][CONFIRM] Could not complete the payment for ${booking.id}:`, err));
  }

  // Completed trips get the "How was your trip?" review request in place of the
  // generic status email. Fire-and-forget: email failure never fails the update.
  if (status === "completed") {
    sendReviewRequest(booking).catch((err) => console.error("[BOOKING][STATUS] Review request failed (non-fatal):", err));
    return;
  }
  if (!booking.customerEmail) return;
  try {
    const bookingItems = await storage.getBookingItems(booking.id);
    const firstItem = bookingItems[0];
    const tourData = firstItem ? await storage.getProduct(firstItem.productId) : null;
    const tourInfo = tourData || { title: 'Product/Transfer Booking' };

    const emailBooking = {
      ...booking,
      date: booking.date || new Date().toISOString().split('T')[0],
      guests: `${firstItem?.adultPax || 1} Adult(s)${firstItem?.childPax ? ', ' + firstItem.childPax + ' Child(ren)' : ''}`,
      amount: `VT ${(booking.totalAmountCents || 0).toLocaleString()}`,
    };

    await sendEmail({
      to: booking.customerEmail,
      subject: `Booking ${status.charAt(0).toUpperCase() + status.slice(1)} — ACT-${shortBookingRef(booking.id)}`,
      html: await getBookingStatusUpdateTemplate(emailBooking, status, tourInfo),
    });
  } catch (emailErr) {
    console.error('[BOOKING][STATUS] Email failed (non-fatal):', emailErr);
  }
}

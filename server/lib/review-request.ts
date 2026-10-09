import type { Booking } from "../../shared/schema.js";
import { storage } from "../storage.js";
import { signReviewToken } from "./review-token.js";
import { bookingProducts } from "./review-invite.js";
import { getAppUrl, getMsg, getReviewRequestTemplate, sendEmail } from "./mail.js";

/** Email the customer a signed link to review a completed booking. Never throws. */
export async function sendReviewRequest(booking: Booking): Promise<boolean> {
  if (!booking.customerEmail) return false;
  try {
    const link = `${await getAppUrl()}/review#${signReviewToken(booking.id)}`;
    const names = bookingProducts(booking, await storage.getBookingItems(booking.id)).map((p) => p.productName);
    return await sendEmail({
      to: booking.customerEmail,
      subject: getMsg(booking.locale || "en", "reviewRequestSubject"),
      html: await getReviewRequestTemplate(booking, names, link),
    });
  } catch (err) {
    console.error("[REVIEWS] review request email failed:", err);
    return false;
  }
}

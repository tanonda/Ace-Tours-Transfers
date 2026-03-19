/**
 * GuestNotificationHandler — sends email & SMS to GUESTS on domain events.
 *
 * Mirrors AdminNotificationHandler but targets the booking customer
 * rather than admin users.
 */

import { eventDispatcher } from "../../infrastructure/events/event-dispatcher.js";
import { BookingCreated, PaymentConfirmed, PaymentFailed, PaymentExpired } from "../../domain/events.js";
import { IStorage } from "../../storage.js";
import { smsService } from "../../infrastructure/sms/SmsService.js";

export class GuestNotificationHandler {
    constructor(private storage: IStorage) { }

    public register(): void {
        eventDispatcher.subscribe(BookingCreated, this.onBookingCreated.bind(this));
        eventDispatcher.subscribe(PaymentConfirmed, this.onPaymentConfirmed.bind(this));
        eventDispatcher.subscribe(PaymentFailed, this.onPaymentFailed.bind(this));
        eventDispatcher.subscribe(PaymentExpired, this.onPaymentExpired.bind(this));
        console.log("[GUEST-NOTIFY] Guest notification handler registered");
    }

    // ── Helpers ────────────────────────────────────────────────────────

    private formatRef(id: string): string {
        return `ACT-${id.replace(/^book_/i, "").replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    }

    private formatAmount(cents: number): string {
        return `${Math.round(cents).toLocaleString()} VT`;
    }

    private buildPaxSummary(booking: any): string {
        const parts: string[] = [];
        // Use authoritative _Total fields from the bookings table
        const adults = booking.adultPaxTotal ?? booking.adultPax ?? booking.guests ?? 1;
        parts.push(`${adults} adult${adults !== 1 ? "s" : ""}`);
        const children = booking.childPaxTotal ?? booking.childPax ?? 0;
        if (children > 0) parts.push(`${children} child${children !== 1 ? "ren" : ""}`);
        const infants = booking.infantPaxTotal ?? booking.infantPax ?? 0;
        if (infants > 0) parts.push(`${infants} infant${infants !== 1 ? "s" : ""}`);
        const pets = booking.petPaxTotal ?? booking.petPax ?? 0;
        if (pets > 0) parts.push(`${pets} pet${pets !== 1 ? "s" : ""}`);
        return parts.join(", ");
    }

    // ── Event Handlers ─────────────────────────────────────────────────

    private async onBookingCreated(event: BookingCreated): Promise<void> {
        try {
            const booking = await this.storage.getBooking(event.bookingId);
            if (!booking) return;

            // NOTE: No email is sent here. The booking confirmation email is sent by
            // BookingEventHandler.onPaymentConfirmed once payment succeeds.
            // Sending an email at booking creation (before payment) would incorrectly
            // imply the booking is confirmed when it is still pending.

            // Send SMS acknowledgement if phone is available — brief, non-committal
            if ((booking as any).customerPhone) {
                await smsService.sendBookingConfirmation((booking as any).customerPhone, {
                    id: this.formatRef(booking.id),
                    customerName: booking.customerName || "Guest",
                    tourName: (booking as any).tourName || "Booking",
                    date: booking.date || "TBD",
                    amount: this.formatAmount(booking.totalAmountCents ?? event.amount),
                    locale: booking.locale || 'en',
                });
            }

            console.log(`[GUEST-NOTIFY] Booking created SMS dispatched for ${booking.id}`);
        } catch (error) {
            console.error("[GUEST-NOTIFY] Failed to handle booking created event:", error);
        }
    }

    private async onPaymentConfirmed(event: PaymentConfirmed): Promise<void> {
        try {
            const booking = await this.storage.getBooking(event.bookingId);
            if (!booking) return;

            // NOTE: Confirmation email is already sent by BookingEventHandler.onPaymentConfirmed.
            // This handler only sends the SMS follow-up to avoid duplicate emails.
            if ((booking as any).customerPhone) {
                await smsService.sendPaymentSuccess((booking as any).customerPhone, {
                    bookingId: this.formatRef(booking.id),
                    amount: this.formatAmount(booking.totalAmountCents ?? 0),
                    locale: booking.locale || 'en',
                });
                console.log(`[GUEST-NOTIFY] Payment success SMS sent to ${(booking as any).customerPhone}`);
            }
        } catch (error) {
            console.error("[GUEST-NOTIFY] Failed to send payment success SMS:", error);
        }
    }

    private async onPaymentFailed(event: PaymentFailed): Promise<void> {
        try {
            const booking = await this.storage.getBooking(event.bookingId);
            if (!booking) return;

            // NOTE: Failure email is already sent by BookingEventHandler.onPaymentFailed.
            // This handler only sends the SMS follow-up.
            if ((booking as any).customerPhone) {
                await smsService.sendPaymentFailure((booking as any).customerPhone, {
                    bookingId: this.formatRef(booking.id),
                    reason: event.reason,
                    locale: booking.locale || 'en',
                });
                console.log(`[GUEST-NOTIFY] Payment failure SMS sent to ${(booking as any).customerPhone}`);
            }
        } catch (error) {
            console.error("[GUEST-NOTIFY] Failed to send payment failure SMS:", error);
        }
    }

    private async onPaymentExpired(event: PaymentExpired): Promise<void> {
        try {
            const booking = await this.storage.getBooking(event.bookingId);
            if (!booking) return;

            // NOTE: Expiry email is already sent by BookingEventHandler.onPaymentExpired.
            // This handler only sends the SMS follow-up.
            if ((booking as any).customerPhone) {
                await smsService.sendPaymentExpiry((booking as any).customerPhone, this.formatRef(booking.id), booking.locale || 'en');
                console.log(`[GUEST-NOTIFY] Payment expiry SMS sent to ${(booking as any).customerPhone}`);
            }
        } catch (error) {
            console.error("[GUEST-NOTIFY] Failed to send payment expiry SMS:", error);
        }
    }
}

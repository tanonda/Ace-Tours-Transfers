/**
 * GuestNotificationHandler — sends email & SMS to GUESTS on domain events.
 *
 * Mirrors AdminNotificationHandler but targets the booking customer
 * rather than admin users.
 */

import { eventDispatcher } from "../../infrastructure/events/event-dispatcher.js";
import { BookingCreated, PaymentConfirmed, PaymentFailed, PaymentExpired } from "../../domain/events.js";
import { IStorage } from "../../storage.js";
import { mailingService } from "../../infrastructure/mailing/MailingService.js";
import { smsService } from "../../infrastructure/sms/SmsService.js";
import * as templates from "../../infrastructure/mailing/email-templates.js";

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
        const adults = booking.adultPax ?? booking.guests ?? 1;
        parts.push(`${adults} adult${adults !== 1 ? "s" : ""}`);
        if (booking.childPax && booking.childPax > 0) {
            parts.push(`${booking.childPax} child${booking.childPax !== 1 ? "ren" : ""}`);
        }
        if (booking.infantPax && booking.infantPax > 0) {
            parts.push(`${booking.infantPax} infant${booking.infantPax !== 1 ? "s" : ""}`);
        }
        if (booking.petPax && booking.petPax > 0) {
            parts.push(`${booking.petPax} pet${booking.petPax !== 1 ? "s" : ""}`);
        }
        return parts.join(", ");
    }

    // ── Event Handlers ─────────────────────────────────────────────────

    private async onBookingCreated(event: BookingCreated): Promise<void> {
        try {
            const booking = await this.storage.getBooking(event.bookingId);
            if (!booking || !booking.customerEmail) return;

            const ref = this.formatRef(booking.id);
            const total = this.formatAmount(booking.totalAmountCents ?? event.amount);

            // Send email
            const { subject, html } = templates.bookingConfirmation({
                customerName: booking.customerName || "Guest",
                bookingRef: ref,
                tourName: (booking as any).tourName || "Booking",
                date: booking.date || "TBD",
                paxSummary: this.buildPaxSummary(booking),
                totalFormatted: total,
            });

            await mailingService.sendEmail({ to: booking.customerEmail, subject, html });

            // Send SMS if phone is available
            if ((booking as any).customerPhone) {
                await smsService.sendBookingConfirmation((booking as any).customerPhone, {
                    id: ref,
                    customerName: booking.customerName || "Guest",
                    tourName: (booking as any).tourName || "Booking",
                    date: booking.date || "TBD",
                    amount: total,
                });
            }

            console.log(`[GUEST-NOTIFY] Booking confirmation sent to ${booking.customerEmail}`);
        } catch (error) {
            console.error("[GUEST-NOTIFY] Failed to send booking confirmation:", error);
        }
    }

    private async onPaymentConfirmed(event: PaymentConfirmed): Promise<void> {
        try {
            const booking = await this.storage.getBooking(event.bookingId);
            if (!booking || !booking.customerEmail) return;

            const ref = this.formatRef(booking.id);
            const total = this.formatAmount(booking.totalAmountCents ?? 0);

            const { subject, html } = templates.paymentReceipt({
                customerName: booking.customerName || "Guest",
                bookingRef: ref,
                amount: total,
                transactionId: event.paymentId,
            });

            await mailingService.sendEmail({ to: booking.customerEmail, subject, html });

            // SMS
            if ((booking as any).customerPhone) {
                await smsService.sendPaymentSuccess((booking as any).customerPhone, {
                    bookingId: ref,
                    amount: total,
                });
            }

            console.log(`[GUEST-NOTIFY] Payment receipt sent to ${booking.customerEmail}`);
        } catch (error) {
            console.error("[GUEST-NOTIFY] Failed to send payment receipt:", error);
        }
    }

    private async onPaymentFailed(event: PaymentFailed): Promise<void> {
        try {
            const booking = await this.storage.getBooking(event.bookingId);
            if (!booking || !booking.customerEmail) return;

            const ref = this.formatRef(booking.id);
            const total = this.formatAmount(booking.totalAmountCents ?? 0);

            const { subject, html } = templates.paymentFailure({
                customerName: booking.customerName || "Guest",
                bookingRef: ref,
                amount: total,
                reason: event.reason,
            });

            await mailingService.sendEmail({ to: booking.customerEmail, subject, html });

            // SMS
            if ((booking as any).customerPhone) {
                await smsService.sendPaymentFailure((booking as any).customerPhone, {
                    bookingId: ref,
                    reason: event.reason,
                });
            }

            console.log(`[GUEST-NOTIFY] Payment failure notification sent to ${booking.customerEmail}`);
        } catch (error) {
            console.error("[GUEST-NOTIFY] Failed to send payment failure notification:", error);
        }
    }

    private async onPaymentExpired(event: PaymentExpired): Promise<void> {
        try {
            const booking = await this.storage.getBooking(event.bookingId);
            if (!booking || !booking.customerEmail) return;

            const ref = this.formatRef(booking.id);

            const { subject, html } = templates.paymentExpiry({
                customerName: booking.customerName || "Guest",
                bookingRef: ref,
            });

            await mailingService.sendEmail({ to: booking.customerEmail, subject, html });

            // SMS
            if ((booking as any).customerPhone) {
                await smsService.sendPaymentExpiry((booking as any).customerPhone, ref);
            }

            console.log(`[GUEST-NOTIFY] Payment expiry notification sent to ${booking.customerEmail}`);
        } catch (error) {
            console.error("[GUEST-NOTIFY] Failed to send payment expiry notification:", error);
        }
    }
}

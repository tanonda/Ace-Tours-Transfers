
import { eventDispatcher } from "../../infrastructure/events/event-dispatcher.js";
import { BookingCreated, PaymentConfirmed, PaymentFailed, PaymentExpired } from "../../domain/events.js";
import { IStorage } from "../../storage.js";

export class AdminNotificationHandler {
    private sseClients: any[];

    constructor(private storage: IStorage, sseClients: any[] = []) {
        this.sseClients = sseClients;
    }

    public register(): void {
        eventDispatcher.subscribe(BookingCreated, this.onBookingCreated.bind(this));
        eventDispatcher.subscribe(PaymentConfirmed, this.onPaymentConfirmed.bind(this));
        eventDispatcher.subscribe(PaymentFailed, this.onPaymentFailed.bind(this));
        eventDispatcher.subscribe(PaymentExpired, this.onPaymentExpired.bind(this));
    }

    private async broadcast(notification: any) {
        this.sseClients.forEach(client => {
            if (client.role === 'admin') {
                try {
                    client.res.write(`event: notification\ndata: ${JSON.stringify(notification)}\n\n`);
                } catch (err) {
                    console.error("[NOTIFICATION][SSE] Failed to broadcast to client", err);
                }
            }
        });
    }

    private async onBookingCreated(event: BookingCreated): Promise<void> {
        const booking = await this.storage.getBooking(event.bookingId);
        if (!booking) return;

        const notification = await this.storage.createNotification({
            type: "info",
            title: "New Booking Received",
            message: `A new booking (#${booking.id.slice(0, 8)}) has been created by ${booking.customerName}.`,
            link: `/admin/bookings`,
            userId: null, // Admin-wide
        });

        await this.broadcast(notification);
    }

    private async onPaymentConfirmed(event: PaymentConfirmed): Promise<void> {
        const booking = await this.storage.getBooking(event.bookingId);
        if (!booking) return;

        const notification = await this.storage.createNotification({
            type: "success",
            title: "Payment Confirmed",
            message: `Payment confirmed for booking #${booking.id.slice(0, 8)} (${booking.customerName}).`,
            link: `/admin/bookings`,
            userId: null,
        });

        await this.broadcast(notification);
    }

    private async onPaymentFailed(event: PaymentFailed): Promise<void> {
        const booking = await this.storage.getBooking(event.bookingId);
        if (!booking) return;

        const notification = await this.storage.createNotification({
            type: "error",
            title: "Payment Failed",
            message: `Payment failed for booking #${booking.id.slice(0, 8)}: ${event.reason}`,
            link: `/admin/bookings`,
            userId: null,
        });

        await this.broadcast(notification);
    }

    private async onPaymentExpired(event: PaymentExpired): Promise<void> {
        const booking = await this.storage.getBooking(event.bookingId);
        if (!booking) return;

        const notification = await this.storage.createNotification({
            type: "warning",
            title: "Payment Expired",
            message: `Payment session expired for booking #${booking.id.slice(0, 8)}.`,
            link: `/admin/bookings`,
            userId: null,
        });

        await this.broadcast(notification);
    }
}

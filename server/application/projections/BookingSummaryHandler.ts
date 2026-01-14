import { IProjectionHandler } from "../../infrastructure/projections/projection-engine.js";
import { BookingCreated, PaymentConfirmed } from "../../domain/events.js";
import { IStorage } from "../../storage.js";

export class BookingSummaryHandler implements IProjectionHandler<any> {
  constructor(private storage: IStorage) {}

  public async handle(event: any): Promise<void> {
    const correlationId = (event as any).correlationId || 'no-correlation';
    
    if (event instanceof BookingCreated) {
      const booking = await this.storage.getBooking(event.bookingId);
      if (booking) {
        await (this.storage as any).upsertBookingSummary({
          bookingId: booking.id,
          customerEmail: booking.customerEmail,
          customerName: booking.customerName,
          totalAmount: parseInt(booking.amount),
          currency: 'VUV',
          status: booking.status,
          createdAt: booking.createdAt,
        });
        console.log(`[PROJECTION][${correlationId}] Projected BookingCreated for ${booking.id}`);
      }
    } else if (event instanceof PaymentConfirmed) {
      await (this.storage as any).updateBookingSummary(event.bookingId, {
        status: 'confirmed',
        confirmedAt: new Date(),
      });
      console.log(`[PROJECTION][${correlationId}] Projected PaymentConfirmed for Booking ${event.bookingId}`);
    }
  }
}

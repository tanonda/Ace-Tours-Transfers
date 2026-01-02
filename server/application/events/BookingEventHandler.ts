
import { eventDispatcher } from "../../infrastructure/events/event-dispatcher";
import { PaymentConfirmed } from "../../domain/events";
import { IStorage } from "../../storage";
import { AvailabilityApplicationService } from "../availability/availability.application-service";
import { mailingService } from "../../infrastructure/mailing/MailingService";

export class BookingEventHandler {
  constructor(
    private storage: IStorage,
    private availabilityService: AvailabilityApplicationService
  ) {}

  public register(): void {
    eventDispatcher.subscribe(PaymentConfirmed, this.onPaymentConfirmed.bind(this));
  }

  private async onPaymentConfirmed(event: PaymentConfirmed): Promise<void> {
    const correlationId = event.correlationId || 'no-correlation';
    console.log(`[EVENT][HANDLER][${correlationId}] Handling PaymentConfirmed for Booking ${event.bookingId}`);
    
    const booking = await this.storage.getBooking(event.bookingId);
    if (!booking) {
      console.error(`[EVENT][ERROR] Booking ${event.bookingId} not found for payment confirmation`);
      return;
    }

    if (booking.status !== 'confirmed') {
      try {
        // Secure Inventory if hold exists
        if (booking.holdId) {
          await this.availabilityService.confirmBooking(booking.holdId);
        }

        // Update Booking Status
        await this.storage.updateBooking(booking.id, { status: 'confirmed' });
        console.log(`[EVENT][SUCCESS] Booking ${booking.id} confirmed via PaymentConfirmed event`);
        
        // Trigger emails/admin notifications here
        const tour = await this.storage.getTour(booking.tourId);
        await mailingService.sendBookingConfirmation(booking.customerEmail, {
          id: booking.id,
          customerName: booking.customerName,
          tourName: tour?.name || 'Your Tour',
          date: booking.date,
          amount: booking.amount
        });
      } catch (error) {
        console.error(`[EVENT][ERROR] Failed to confirm booking ${booking.id}:`, error);
        // Implement compensating transaction or manual review flag here
      }
    }
  }
}

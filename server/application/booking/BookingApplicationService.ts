import { IStorage } from "../../storage";
import { AvailabilityApplicationService } from "../availability/availability.application-service";

export class BookingApplicationService {
  private availabilityService: AvailabilityApplicationService;

  constructor(private storage: IStorage) {
    this.availabilityService = new AvailabilityApplicationService(storage);
  }

  async cancelBooking(bookingId: string, reason: string): Promise<void> {
    const booking = await this.storage.getBooking(bookingId);
    if (!booking || booking.status === 'cancelled') return;

    // In a strict DDD implementation, we would load the Booking Aggregate here.
    // For now, we coordinate the state transition and inventory release.
    await this.storage.updateBooking(bookingId, { 
      status: 'cancelled',
      paymentReference: `CANCELLED: ${reason}`
    });

    if (booking.holdId) {
      await this.availabilityService.releaseHold(booking.holdId);
    }
    
    console.log(`[BOOKING] Cancelled booking ${bookingId} due to: ${reason}`);
  }
}

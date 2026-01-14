import { Tour, Booking } from "../../shared/schema.js";
import { AvailabilityDomainService, AvailabilityResult } from "../domain/services/availability.domain-service.js";
import { storage, IStorage } from "../storage.js"; // Assuming Storage acts as a repository interface

export class BookingApplicationService {
  private availabilityService: AvailabilityDomainService;
  private storage: IStorage; // Dependency injection of storage

  constructor(storage: IStorage, availabilityService: AvailabilityDomainService) {
    this.storage = storage;
    this.availabilityService = availabilityService;
  }

  /**
   * Checks the availability of a specific service for a given date and number of guests.
   * @param serviceId The ID of the tour or transfer service.
   * @param dateString The date in YYYY-MM-DD format.
   * @param guests The number of guests for the booking.
   * @returns An AvailabilityResult object.
   */
  async checkServiceAvailability(serviceId: string, dateString: string, guests: number): Promise<AvailabilityResult> {
    const service = await this.storage.getTour(serviceId); // Assuming getTour can fetch any service (tour/transfer)
    if (!service) {
      return { isAvailable: false, availableSlots: 0, message: "Service not found." };
    }

    const bookingDate = new Date(dateString);
    if (isNaN(bookingDate.getTime())) {
      return { isAvailable: false, availableSlots: 0, message: "Invalid date format." };
    }

    // Fetch existing bookings for this service on this date
    // Note: storage.getBookingsForServiceAndDate needs to be implemented or adjusted
    const existingBookings = await this.storage.getBookingsForServiceAndDate(serviceId, dateString);

    return this.availabilityService.checkAvailability(service, bookingDate, guests, existingBookings);
  }

  // Future methods like createBooking, updateBooking could live here
}
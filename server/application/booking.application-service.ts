import { Tour, Booking } from "../../shared/schema.js";
import { AvailabilityDomainService, AvailabilityResult } from "../domain/services/availability.domain-service.js";
import { storage, IStorage } from "../storage.js";

export class BookingApplicationService {
  private availabilityService: AvailabilityDomainService;
  private storage: IStorage;

  constructor(storage: IStorage, availabilityService: AvailabilityDomainService) {
    this.storage = storage;
    this.availabilityService = availabilityService;
  }

  /**
   * Checks the availability of a specific service for a given date and number of guests.
   * Uses the unified availability domain service for consistent validation and pricing.
   * 
   * @param serviceId - The ID of the tour or transfer service
   * @param dateString - The date in YYYY-MM-DD format
   * @param guests - Combined object with adult and child counts
   * @returns An AvailabilityResult object with capacity and pricing
   */
  async checkServiceAvailability(
    serviceId: string,
    dateString: string,
    guests: { adultPax: number; childPax: number; addonIds?: string[]; startTime?: string; endTime?: string }
  ): Promise<AvailabilityResult> {
    const totalGuests = guests.adultPax + guests.childPax;

    return await this.availabilityService.checkAvailability(
      serviceId,
      dateString,
      totalGuests,
      guests.adultPax,
      guests.childPax,
      undefined, // slot
      guests.addonIds,
      guests.startTime,
      guests.endTime
    );
  }
}
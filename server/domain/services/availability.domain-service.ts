import { Tour, Booking } from "../../../shared/schema.js";
import { isSameDay } from "date-fns";

export interface AvailabilityResult {
  isAvailable: boolean;
  availableSlots: number;
  message: string;
}

export class AvailabilityDomainService {

  /**
   * Calculates the available slots for a given service on a specific date.
   * @param service The Tour/Transfer service entity, which includes its total capacity.
   * @param date The date for which to check availability.
   * @param existingBookings A list of all bookings for this service on this date.
   * @returns The number of available slots.
   */
  calculateAvailableSlots(service: Tour, date: Date, existingBookings: Booking[]): number {
    const totalCapacity = service.capacity;
    
    // Sum up guests from confirmed/pending bookings for the same day
    const bookedGuests = existingBookings.reduce((sum, booking) => {
      // Only consider bookings for the exact date and not cancelled
      const bookingDate = new Date(booking.date); // Assuming booking.date is in a format parseable by Date
      if (isSameDay(bookingDate, date) && booking.status !== "cancelled") {
        return sum + booking.guests;
      }
      return sum;
    }, 0);

    const availableSlots = totalCapacity - bookedGuests;
    return Math.max(0, availableSlots); // Ensure available slots is not negative
  }

  /**
   * Checks if a service is available for a requested number of guests on a specific date.
   * @param service The Tour/Transfer service entity.
   * @param date The date for which to check availability.
   * @param requestedGuests The number of guests trying to book.
   * @param existingBookings A list of all bookings for this service on this date.
   * @returns An AvailabilityResult object.
   */
  checkAvailability(service: Tour, date: Date, requestedGuests: number, existingBookings: Booking[]): AvailabilityResult {
    const availableSlots = this.calculateAvailableSlots(service, date, existingBookings);

    if (requestedGuests <= 0) {
        return { isAvailable: false, availableSlots, message: "Requested guests must be at least 1." };
    }
    
    if (availableSlots >= requestedGuests) {
      return { isAvailable: true, availableSlots, message: "Available!" };
    } else if (availableSlots > 0) {
      return { isAvailable: false, availableSlots, message: `Only ${availableSlots} slots remaining.` };
    } else {
      return { isAvailable: false, availableSlots, message: "Fully booked." };
    }
  }
}

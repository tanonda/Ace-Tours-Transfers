export interface TimeRange {
    start: Date | string;
    end: Date | string;
}

/**
 * Time-slot overlap detection utility for transfers and vehicle bookings
 * 
 * Prevents double-booking of vehicles by checking if a new booking's time range
 * overlaps with existing bookings.
 */

export interface BookingWithTime {
    id: string;
    startTime: Date;
    endTime: Date;
}

/**
 * Check if two time ranges overlap
 * 
 * Two ranges overlap if: (start1 < end2) AND (start2 < end1)
 * 
 * Examples:
 * - Range A: 09:00-12:00, Range B: 11:00-14:00 → OVERLAPS (11:00-12:00)
 * - Range A: 09:00-12:00, Range B: 12:00-15:00 → NO OVERLAP (end time equals start time)
 * - Range A: 09:00-12:00, Range B: 13:00-15:00 → NO OVERLAP
 */
export function doTimeRangesOverlap(
    range1: TimeRange,
    range2: TimeRange
): boolean {
    const start1 = new Date(range1.start).getTime();
    const end1 = new Date(range1.end).getTime();
    const start2 = new Date(range2.start).getTime();
    const end2 = new Date(range2.end).getTime();

    return start1 < end2 && start2 < end1;
}

/**
 * Find overlapping bookings for a new time range
 * 
 * @param newBooking - The new booking time range to check
 * @param existingBookings - List of existing bookings with time ranges
 * @returns Array of bookings that overlap with the new booking
 */
export function findOverlappingBookings(
    newBooking: TimeRange,
    existingBookings: BookingWithTime[]
): BookingWithTime[] {
    return existingBookings.filter(existing => {
        const existingRange: TimeRange = {
            start: existing.startTime,
            end: existing.endTime,
        };
        return doTimeRangesOverlap(newBooking, existingRange);
    });
}

/**
 * Check if a new booking can be made without conflicts
 * 
 * @param newBooking - The new booking time range
 * @param existingBookings - List of existing bookings
 * @param vehicleCapacity - Number of vehicles available (default: 1 for transfers)
 * @returns { canBook: boolean, conflictingBookings?: BookingWithTime[] }
 */
export function canBookTimeSlot(
    newBooking: TimeRange,
    existingBookings: BookingWithTime[],
    vehicleCapacity: number = 1
): { canBook: boolean; conflictingBookings?: BookingWithTime[] } {
    const overlapping = findOverlappingBookings(newBooking, existingBookings);

    // If no overlapping bookings, can book
    if (overlapping.length === 0) {
        return { canBook: true };
    }

    // If overlapping bookings exceed vehicle capacity, cannot book
    if (overlapping.length >= vehicleCapacity) {
        return { canBook: false, conflictingBookings: overlapping };
    }

    // Otherwise, can book
    return { canBook: true };
}

/**
 * Format time range for display
 */
export function formatTimeRange(range: TimeRange): string {
    const start = new Date(range.start);
    const end = new Date(range.end);

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
    };

    return `${formatTime(start)} - ${formatTime(end)}`;
}

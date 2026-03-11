import { format } from 'date-fns';

/**
 * Shared availability toast message utilities.
 *
 * Used by both `useAvailabilityToast` (tours & transfers) and
 * vehicle-detail's own slot-based availability callbacks to ensure
 * consistent wording, emojis, and tone across all product types.
 */

// ─── Date/Time Formatting ──────────────────────────────────────────────────────

/** Format a date string into a human-readable label, e.g. "Tuesday, Mar 11" */
export function formatDateLabel(dateStr: string): string {
    try {
        return format(new Date(dateStr), 'EEEE, MMM d');
    } catch {
        return dateStr;
    }
}

/** Build "Tuesday, Mar 11 at 09:00" or just "Tuesday, Mar 11" */
export function formatDateTimeLabel(dateStr: string, timeStr?: string | null): string {
    const dateLabel = formatDateLabel(dateStr);
    if (timeStr) return `${dateLabel} at ${timeStr}`;
    return dateLabel;
}

// ─── Toast Message Builders ────────────────────────────────────────────────────

export type AvailabilityBucket = 'available' | 'limited' | 'sold-out' | 'booking-closed';

export interface AvailabilityToastMessage {
    title: string;
    description: string;
    variant: 'default' | 'destructive';
    duration: number;
}

/**
 * Build the toast content for a given availability bucket.
 *
 * @param bucket    - The availability status bucket
 * @param remaining - Number of remaining spots/slots
 * @param label     - Human-readable date+time label (use `formatDateTimeLabel`)
 * @param hasTime   - Whether a specific time slot was selected
 */
export function buildAvailabilityToast(
    bucket: AvailabilityBucket,
    remaining: number,
    label: string,
    hasTime: boolean = false
): AvailabilityToastMessage {
    switch (bucket) {
        case 'available':
            return {
                title: '🎉 Spots Available!',
                description: `Great news — ${remaining} spot${remaining !== 1 ? 's' : ''} available for ${label}.`,
                variant: 'default',
                duration: 4000,
            };

        case 'limited':
            return {
                title: '⚡ Filling Fast!',
                description: `Only ${remaining} spot${remaining !== 1 ? 's' : ''} left for ${label}. Book now to secure your place!`,
                variant: 'default',
                duration: 5000,
            };

        case 'sold-out':
            return {
                title: '😔 Sold Out',
                description: `No availability for ${label}. Try a different ${hasTime ? 'time slot' : 'date'}.`,
                variant: 'destructive',
                duration: 5000,
            };

        case 'booking-closed':
            return {
                title: '🔒 Booking Closed',
                description: `Online booking has closed for ${label}. Contact us via WhatsApp to check.`,
                variant: 'default',
                duration: 5000,
            };
    }
}

/**
 * Determine the availability bucket from raw availability data.
 * Works with any data shape that has isAvailable, remainingCapacity, and bookingClosed.
 */
export function getAvailabilityBucket(data: {
    isAvailable: boolean;
    remainingCapacity: number;
    bookingClosed?: boolean;
}): AvailabilityBucket {
    if (data.bookingClosed) return 'booking-closed';
    if (!data.isAvailable) return 'sold-out';
    if (data.remainingCapacity <= 3 && data.remainingCapacity > 0) return 'limited';
    return 'available';
}

/**
 * Determine a bucket from slot-level data (used by vehicle detail's TimePicker).
 *
 * @param totalSlots     - Total number of time slots
 * @param availableSlots - Number of available time slots
 */
export function getSlotBucket(totalSlots: number, availableSlots: number): AvailabilityBucket {
    if (availableSlots === 0) return 'sold-out';
    if (availableSlots <= 2) return 'limited';
    return 'available';
}

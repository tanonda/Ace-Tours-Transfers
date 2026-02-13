/**
 * Time interval utilities for universal time-aware availability.
 *
 * Product Type Time Semantics:
 * - Tours: session-based (morning 09:00-12:00, afternoon 13:00-17:00)
 * - Transfers: point-in-time or short intervals (e.g. 06:00-06:30)
 * - Vehicles: full-day intervals (00:00-23:59 per rental day)
 *
 * When startTime/endTime are null on a tour instance, it represents
 * a full-day booking (backward compatible).
 */

export interface TimeInterval {
    startTime: string | null; // HH:MM format, null = start of day (00:00)
    endTime: string | null;   // HH:MM format, null = end of day (23:59)
}

/**
 * Converts HH:MM string to minutes since midnight for comparison.
 */
export function timeToMinutes(time: string | null): number {
    if (!time) return 0; // null → start of day
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + (minutes || 0);
}

/**
 * Default end-of-day in minutes (23:59).
 */
const END_OF_DAY = 23 * 60 + 59;

/**
 * Returns the effective start/end minutes for an interval,
 * treating null as full-day boundaries.
 */
export function normalizeInterval(interval: TimeInterval): { start: number; end: number } {
    return {
        start: interval.startTime ? timeToMinutes(interval.startTime) : 0,
        end: interval.endTime ? timeToMinutes(interval.endTime) : END_OF_DAY,
    };
}

/**
 * Checks if two time intervals overlap.
 * Two intervals [A_start, A_end] and [B_start, B_end] overlap when:
 *   A_start < B_end AND B_start < A_end
 *
 * Full-day intervals (null start/end) overlap with everything on the same date.
 */
export function intervalsOverlap(a: TimeInterval, b: TimeInterval): boolean {
    const normA = normalizeInterval(a);
    const normB = normalizeInterval(b);

    return normA.start < normB.end && normB.start < normA.end;
}

/**
 * Checks if a requested interval fits within an available slot.
 * The requested interval must be fully contained within the slot.
 */
export function intervalFitsWithin(requested: TimeInterval, slot: TimeInterval): boolean {
    const normReq = normalizeInterval(requested);
    const normSlot = normalizeInterval(slot);

    return normReq.start >= normSlot.start && normReq.end <= normSlot.end;
}

/**
 * Generates the full-day interval for vehicle rentals.
 */
export function fullDayInterval(): TimeInterval {
    return { startTime: "00:00", endTime: "23:59" };
}

/**
 * Determines the default time interval based on product category.
 * - Tours: uses the provided slot or defaults to full day
 * - Transfers: uses provided times or defaults to a short window
 * - Vehicles: always full day
 */
export function getDefaultInterval(
    category: string,
    startTime?: string | null,
    endTime?: string | null
): TimeInterval {
    if (category === "vehicle") {
        return fullDayInterval();
    }

    return {
        startTime: startTime || null,
        endTime: endTime || null,
    };
}

/**
 * Formats an interval for display.
 */
export function formatInterval(interval: TimeInterval): string {
    if (!interval.startTime && !interval.endTime) {
        return "Full Day";
    }
    return `${interval.startTime || "00:00"} – ${interval.endTime || "23:59"}`;
}

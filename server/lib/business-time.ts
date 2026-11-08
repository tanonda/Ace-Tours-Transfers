/**
 * Business-time helpers.
 *
 * Ace Tours operates in Port Vila, Vanuatu (Pacific/Efate, UTC+11 all year — no
 * daylight saving). Server processes run in UTC, so every "today", "departure
 * time" and "midnight" calculation must go through this module instead of
 * `new Date(year, month, day, ...)`, which uses the server's zone.
 */

export const BUSINESS_TIME_ZONE = "Pacific/Efate";
export const BUSINESS_UTC_OFFSET_MS = 11 * 60 * 60 * 1000; // Vanuatu has no DST.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** True for a real calendar date such as 2026-02-28, false for 2026-02-31. */
export function isValidCalendarDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** True for a 24-hour clock time such as "08:30" (00:00–23:59). */
export function isValidTime(value: unknown): value is string {
  return typeof value === "string" && HHMM.test(value);
}

/** Today's date in Vanuatu as YYYY-MM-DD. */
export function vanuatuTodayISO(now: Date = new Date()): string {
  return new Date(now.getTime() + BUSINESS_UTC_OFFSET_MS).toISOString().slice(0, 10);
}

/** A Vanuatu wall-clock date/time converted to the corresponding UTC instant. */
export function vanuatuDateTimeToUtc(date: string, time = "00:00"): Date {
  if (!isValidCalendarDate(date) || !isValidTime(time)) {
    throw new Error(`Invalid Vanuatu date/time: ${date} ${time}`);
  }
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - BUSINESS_UTC_OFFSET_MS);
}

/** Midnight today in Vanuatu, as a UTC instant. */
export function vanuatuStartOfDayUtc(now: Date = new Date()): Date {
  return vanuatuDateTimeToUtc(vanuatuTodayISO(now), "00:00");
}

/** True when `date` (YYYY-MM-DD) is before today in Vanuatu. */
export function isVanuatuPastDate(date: string, now: Date = new Date()): boolean {
  return isValidCalendarDate(date) && date < vanuatuTodayISO(now);
}

/** Midnight `daysAgo` days ago in Vanuatu, as a UTC instant (for reporting cut-offs). */
export function vanuatuDaysAgoStartUtc(daysAgo: number, now: Date = new Date()): Date {
  return new Date(vanuatuStartOfDayUtc(now).getTime() - Math.max(0, daysAgo) * 86_400_000);
}

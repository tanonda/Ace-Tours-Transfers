import { describe, it, expect } from "vitest";
import {
  isValidCalendarDate,
  isValidTime,
  vanuatuTodayISO,
  vanuatuDateTimeToUtc,
  vanuatuStartOfDayUtc,
  isVanuatuPastDate,
  vanuatuDaysAgoStartUtc,
} from "./business-time.js";

describe("business time (Vanuatu, UTC+11)", () => {
  it("accepts real calendar dates and rejects impossible ones", () => {
    expect(isValidCalendarDate("2026-02-28")).toBe(true);
    expect(isValidCalendarDate("2024-02-29")).toBe(true);
    expect(isValidCalendarDate("2026-02-29")).toBe(false);
    expect(isValidCalendarDate("2026-02-31")).toBe(false);
    expect(isValidCalendarDate("2026-13-01")).toBe(false);
    expect(isValidCalendarDate("tomorrow")).toBe(false);
  });

  it("accepts 24-hour times only", () => {
    expect(isValidTime("00:00")).toBe(true);
    expect(isValidTime("23:59")).toBe(true);
    expect(isValidTime("24:00")).toBe(false);
    expect(isValidTime("8:30")).toBe(false);
  });

  it("uses the Vanuatu date across the UTC midnight boundary", () => {
    // 2026-11-07 13:30 UTC = 2026-11-08 00:30 in Vanuatu.
    expect(vanuatuTodayISO(new Date("2026-11-07T13:30:00Z"))).toBe("2026-11-08");
    // 2026-11-07 12:30 UTC = 2026-11-07 23:30 in Vanuatu.
    expect(vanuatuTodayISO(new Date("2026-11-07T12:30:00Z"))).toBe("2026-11-07");
  });

  it("converts a Vanuatu departure time to the right UTC instant", () => {
    // 08:30 on 2026-06-20 in Vanuatu is 2026-06-19T21:30Z.
    expect(vanuatuDateTimeToUtc("2026-06-20", "08:30").toISOString()).toBe("2026-06-19T21:30:00.000Z");
    expect(vanuatuDateTimeToUtc("2026-06-20").toISOString()).toBe("2026-06-19T13:00:00.000Z");
  });

  it("computes Vanuatu midnight and past-date comparisons", () => {
    const now = new Date("2026-11-07T13:30:00Z"); // 2026-11-08 00:30 Vanuatu
    expect(vanuatuStartOfDayUtc(now).toISOString()).toBe("2026-11-07T13:00:00.000Z");
    expect(isVanuatuPastDate("2026-11-07", now)).toBe(true);
    expect(isVanuatuPastDate("2026-11-08", now)).toBe(false);
    expect(vanuatuDaysAgoStartUtc(1, now).toISOString()).toBe("2026-11-06T13:00:00.000Z");
  });
});

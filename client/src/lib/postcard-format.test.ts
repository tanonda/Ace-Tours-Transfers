import { describe, it, expect } from "vitest";
import { shortDuration, splitPriceForStamp } from "./postcard-format";

describe("shortDuration", () => {
  it("abbreviates the durations used in the catalogue", () => {
    expect(shortDuration("30 minutes")).toBe("30 MIN");
    expect(shortDuration("5-8 hours")).toBe("5–8 HRS");
    expect(shortDuration("5-8 Hours")).toBe("5–8 HRS");
    expect(shortDuration("1 hour")).toBe("1 HOUR");
    expect(shortDuration("45 Mins")).toBe("45 MIN");
    expect(shortDuration("Half Day")).toBe("HALF DAY");
    expect(shortDuration("Full Day")).toBe("FULL DAY");
  });

  it("gives up on text that will not fit a badge", () => {
    expect(shortDuration("30 minutes to 1 hour")).toBeNull();
    expect(shortDuration("Evening (4-5 Hours)")).toBeNull();
    expect(shortDuration("Two destinations")).toBeNull();
    expect(shortDuration("")).toBeNull();
    expect(shortDuration(undefined)).toBeNull();
  });
});

describe("splitPriceForStamp", () => {
  it("stacks the currency symbol over the amount", () => {
    expect(splitPriceForStamp("VT 9,600")).toEqual(["VT", "9,600"]);
  });

  it("splits on the non-breaking space the price formatter emits", () => {
    expect(splitPriceForStamp("VT\u00a08,000")).toEqual(["VT", "8,000"]);
  });

  it("keeps symbol-attached currencies on one line", () => {
    expect(splitPriceForStamp("A$124.80")).toEqual(["A$124.80"]);
  });
});

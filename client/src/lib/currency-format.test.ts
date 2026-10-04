import { describe, it, expect, vi, afterEach } from "vitest";
import { formatInCurrency } from "./currency-context";

afterEach(() => vi.restoreAllMocks());

describe("formatInCurrency", () => {
  it("formats whole-unit and decimal currencies", () => {
    expect(formatInCurrency(7500, "VUV")).toMatch(/7,500/);
    expect(formatInCurrency(7500, "VUV")).not.toMatch(/\./);
    expect(formatInCurrency(10000, "USD")).toBe("$84.00");
  });

  it("falls back to VUV for unknown currencies", () => {
    expect(formatInCurrency(7500, "XXX")).toBe(formatInCurrency(7500, "VUV"));
  });

  it("builds each currency's formatter once, not once per price", () => {
    formatInCurrency(1, "GBP"); // warm the cache for this currency
    const spy = vi.spyOn(Intl, "NumberFormat");
    for (let i = 0; i < 50; i++) formatInCurrency(1000 + i, "GBP");
    expect(spy).not.toHaveBeenCalled();
  });
});

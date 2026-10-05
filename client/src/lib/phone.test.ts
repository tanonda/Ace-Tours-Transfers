import { describe, it, expect } from "vitest";
import { vanuatuPhone } from "./phone";

describe("vanuatuPhone", () => {
  it("does not repeat the +678 country code already in the setting", () => {
    expect(vanuatuPhone("+678 7114045")).toEqual({ display: "+678 711 4045", tel: "tel:+6787114045" });
  });

  it("adds the country code to a local 7-digit number", () => {
    expect(vanuatuPhone("7342389")).toEqual({ display: "+678 734 2389", tel: "tel:+6787342389" });
    expect(vanuatuPhone("734 2389")).toEqual({ display: "+678 734 2389", tel: "tel:+6787342389" });
  });

  it("accepts 00678 and bare 678 prefixes", () => {
    expect(vanuatuPhone("006787114045")?.tel).toBe("tel:+6787114045");
    expect(vanuatuPhone("6787114045")?.tel).toBe("tel:+6787114045");
  });

  it("returns null for empty input", () => {
    expect(vanuatuPhone("")).toBeNull();
    expect(vanuatuPhone(undefined)).toBeNull();
  });
});

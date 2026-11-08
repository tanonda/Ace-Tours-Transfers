import { describe, it, expect } from "vitest";
import { csvCell, csvRow } from "./csv.js";

describe("csvCell", () => {
  it("quotes and doubles quotes", () => {
    expect(csvCell('Jo "JJ" Guest')).toBe('"Jo ""JJ"" Guest"');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
  });

  it("neutralises spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell("+1-234")).toBe(`"'+1-234"`);
    expect(csvCell("@cmd")).toBe(`"'@cmd"`);
    expect(csvCell("-10")).toBe(`"'-10"`);
  });

  it("leaves ordinary values alone inside the quotes", () => {
    expect(csvCell("Alice")).toBe('"Alice"');
    expect(csvRow(["a", 1, null])).toBe('"a","1",""');
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

// Print windows are written with document.write into a window that shares the
// site's origin. Any booking field interpolated there without escapeHtml is stored
// XSS (a guest's name runs as script when staff print the manifest).
const SRC = path.resolve(__dirname, "..");
// A field inserted as a value: `${b.name}`, `${b.name || ""}`, `${item.total?.toLocaleString()}`.
// Conditions (`${booking.notes ? ...`) are not output. Ternary fallbacks (`... : booking.amount}`)
// are not checked: the same shape in JSX is escaped by React, so they can't be told apart here.
const FIELD = /\$\{\s*(?:b|booking|item|latestPayment)\.[A-Za-z_]+(?:\?\.[A-Za-z_]+\(\))?\s*(?:\|\|\s*""\s*)?\}/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(name) && !name.includes(".test.") ? [full] : [];
  });
}

describe("print windows built with document.write", () => {
  const writers = sourceFiles(SRC).filter((f) => readFileSync(f, "utf-8").includes("document.write("));

  it("exist (the scan is looking in the right place)", () => {
    expect(writers.length).toBeGreaterThanOrEqual(3);
  });

  it.each(writers.map((f) => [path.relative(SRC, f), f]))("%s escapes every booking field", (_name, file) => {
    const unescaped = readFileSync(file, "utf-8").match(FIELD) ?? [];
    expect(unescaped).toEqual([]);
  });
});

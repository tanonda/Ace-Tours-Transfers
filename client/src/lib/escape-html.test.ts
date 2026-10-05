import { describe, it, expect } from "vitest";
import { escapeHtml } from "./escape-html";

// Print windows (itinerary, admin guest manifest, daily schedule) are built as HTML
// strings from booking fields a guest typed. Unescaped, a name like
// <img src=x onerror=...> runs script in the site's origin when staff print it.
describe("escapeHtml", () => {
  it("neutralises markup a guest could type into a booking field", () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("escapes ampersands and single quotes", () => {
    expect(escapeHtml("Tom & Jerry's")).toBe("Tom &amp; Jerry&#39;s");
  });

  it("renders null and undefined as empty, and numbers as text", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml(12500)).toBe("12500");
  });

  it("leaves ordinary text, accents and Bislama untouched", () => {
    expect(escapeHtml("Jean-Marc Ménard — Port Vila")).toBe("Jean-Marc Ménard — Port Vila");
  });
});

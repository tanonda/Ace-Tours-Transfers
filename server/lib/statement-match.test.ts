import { describe, it, expect } from "vitest";
import { matchStatement, parseCsvLine, findAmountColumn, parseAmount, bookingRef } from "./statement-match.js";

// Booking ids are uuids; the reference a guest quotes is the first 8 hex digits, upper case.
const A = { id: "1234abcd-0000-4000-8000-000000000001", totalAmountCents: 13000, updatedAt: new Date("2026-10-19T01:02:03.456Z"), customerName: "Ana" };
const B = { id: "9876fedc-0000-4000-8000-000000000002", totalAmountCents: 20000, updatedAt: "2026-10-19T04:05:06.789Z", customerName: "Ben" };

describe("CSV helpers", () => {
  it("splits quoted cells with commas and doubled quotes", () => {
    expect(parseCsvLine(`2026-10-01,"REF 1234ABCD, thanks","He said ""hi""",13000`)).toEqual(["2026-10-01", "REF 1234ABCD, thanks", `He said "hi"`, "13000"]);
  });

  it("finds the amount column by header, preferring a credit column over a signed amount", () => {
    expect(findAmountColumn(["Date", "Description", "Amount"])).toBe(2);
    expect(findAmountColumn(["Date", "Narrative", "Debit", "Credit", "Balance"])).toBe(3);
    expect(findAmountColumn(["Posting date", "Details", "CR", "DR"])).toBe(2);
    expect(findAmountColumn(["Date", "Particulars", "Deposits", "Withdrawals"])).toBe(2);
    expect(findAmountColumn(["Date", "Reference", "Amount (VUV)"])).toBe(2);
    expect(findAmountColumn(["2026-10-01", "REF 1234ABCD", "13000"])).toBe(-1);
  });

  it("reads whole-vatu cells and nothing else", () => {
    expect(parseAmount("13000")).toBe(13000);
    expect(parseAmount("13,000.00")).toBe(13000);
    expect(parseAmount(" VT 13,000 ")).toBe(13000);
    expect(parseAmount("-13000")).toBe(-13000);
    expect(parseAmount("13000.50")).toBe(13000.5);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("13000 REF 20000")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });

  it("bookingRef is the first 8 hex digits", () => {
    expect(bookingRef(A.id)).toBe("1234ABCD");
  });
});

describe("matchStatement", () => {
  it("an exact amount in the amount column is a suggested match, not a confirmation", () => {
    const csv = ["Date,Description,Amount", "2026-10-01,ACT-1234ABCD transfer,13000"].join("\n");
    const r = matchStatement(csv, [A, B]);
    expect(r.amountColumn).toBe("Amount");
    expect(r.suggestions).toEqual([expect.objectContaining({
      bookingId: A.id, ref: "1234ABCD", statementAmount: 13000, expectedAmount: 13000, status: "suggested",
      updatedAt: "2026-10-19T01:02:03.456Z", customerName: "Ana", lineNo: 2,
    })]);
    expect(r.needsReview).toEqual([]);
  });

  it("an amount written in the description is ignored: a short payment is needs review", () => {
    const csv = ["Date,Description,Amount", "2026-10-01,REF 1234ABCD 13000,500"].join("\n");
    const r = matchStatement(csv, [A]);
    expect(r.suggestions).toEqual([]);
    expect(r.needsReview).toEqual([expect.objectContaining({ bookingId: A.id, statementAmount: 500, expectedAmount: 13000, reason: "amount_mismatch" })]);
  });

  it("without a header row there is no amount column: every reference match is needs review", () => {
    const r = matchStatement("2026-10-01,REF 1234ABCD,13000\n2026-10-02,REF 9876FEDC 20000,20000", [A, B]);
    expect(r.amountColumn).toBeNull();
    expect(r.suggestions).toEqual([]);
    expect(r.needsReview.map((m) => [m.bookingId, m.reason])).toEqual([[A.id, "no_amount_column"], [B.id, "no_amount_column"]]);
  });

  it("an unreadable amount cell, a debit, and a second line for the same booking are needs review", () => {
    const csv = [
      "Date,Narrative,Debit,Credit",
      "2026-10-01,REF 9876FEDC,,see note",
      "2026-10-02,REF 1234ABCD,13000,",
      "2026-10-03,REF 1234ABCD,,13000",
      "2026-10-04,REF 1234ABCD again,,13000",
      "2026-10-05,unrelated,,999",
    ].join("\r\n");
    const r = matchStatement(csv, [A, B]);
    expect(r.amountColumn).toBe("Credit");
    expect(r.suggestions.map((m) => [m.bookingId, m.lineNo])).toEqual([[A.id, 4]]);
    expect(r.needsReview.map((m) => [m.bookingId, m.lineNo, m.reason])).toEqual([
      [B.id, 2, "unparseable_amount"],
      [A.id, 3, "unparseable_amount"],
      [A.id, 5, "duplicate_reference"],
    ]);
    expect(r.ignored).toBe(1);
  });
});

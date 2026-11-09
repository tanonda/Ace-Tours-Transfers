import { describe, it, expect } from "vitest";
import {
  isRefundRecorded,
  isRefundStatus,
  refundSummary,
  statusLabel,
  statusTone,
  statusToneClass,
} from "./payment-status";

describe("statusLabel", () => {
  it("labels every payment status the admin pages can show", () => {
    expect(statusLabel("pending")).toBe("Pending");
    expect(statusLabel("processing")).toBe("Processing");
    expect(statusLabel("completed")).toBe("Completed");
    expect(statusLabel("failed")).toBe("Failed");
    expect(statusLabel("refund_pending")).toBe("Refund pending (manual)");
    expect(statusLabel("refunded")).toBe("Refunded");
    expect(statusLabel("manual_review_required")).toBe("Manual review required");
    expect(statusLabel("cancelled")).toBe("Cancelled");
    expect(statusLabel("expired")).toBe("Expired");
  });

  it("normalises casing, spaces and dashes", () => {
    expect(statusLabel("REFUNDED")).toBe("Refunded");
    expect(statusLabel("Refund Pending")).toBe("Refund pending (manual)");
    expect(statusLabel("refund-pending")).toBe("Refund pending (manual)");
    expect(statusLabel("  refunded  ")).toBe("Refunded");
  });

  it("title-cases unknown statuses instead of throwing", () => {
    expect(statusLabel("partially_captured")).toBe("Partially Captured");
  });

  it("returns a safe label for missing statuses", () => {
    expect(statusLabel(null)).toBe("Unknown");
    expect(statusLabel(undefined)).toBe("Unknown");
    expect(statusLabel("")).toBe("Unknown");
    expect(statusLabel("   ")).toBe("Unknown");
  });
});

describe("isRefundStatus", () => {
  it("recognises the refund statuses", () => {
    expect(isRefundStatus("refunded")).toBe(true);
    expect(isRefundStatus("refund_pending")).toBe(true);
    expect(isRefundStatus("Refund Pending")).toBe(true);
    expect(isRefundStatus("REFUNDED")).toBe(true);
  });

  it("does not flag other statuses", () => {
    expect(isRefundStatus("completed")).toBe(false);
    expect(isRefundStatus("failed")).toBe(false);
    expect(isRefundStatus(null)).toBe(false);
    expect(isRefundStatus(undefined)).toBe(false);
    expect(isRefundStatus("")).toBe(false);
  });
});

describe("isRefundRecorded", () => {
  it("is true only once the payment is actually refunded", () => {
    expect(isRefundRecorded("refunded")).toBe(true);
    expect(isRefundRecorded(" Refunded ")).toBe(true);
    expect(isRefundRecorded("REFUND-PENDING")).toBe(false);
    expect(isRefundRecorded("completed")).toBe(false);
    expect(isRefundRecorded(null)).toBe(false);
  });
});

describe("statusTone / statusToneClass", () => {
  it("gives refunds their own tone and failures a destructive one", () => {
    expect(statusTone("refunded")).toBe("refund");
    expect(statusTone("refund_pending")).toBe("warning");
    expect(statusTone("completed")).toBe("positive");
    expect(statusTone("processing")).toBe("info");
    expect(statusTone("failed")).toBe("danger");
    expect(statusTone("manual_review_required")).toBe("warning");
  });

  it("falls back to neutral tones for unknown statuses", () => {
    expect(statusTone("something_new")).toBe("neutral");
    expect(statusTone(null)).toBe("neutral");
    expect(statusToneClass(null)).toBe(statusToneClass("pending"));
  });

  it("returns non-empty Tailwind classes that distinguish refunds from failures", () => {
    expect(statusToneClass("refunded").length).toBeGreaterThan(0);
    expect(statusToneClass("refunded")).not.toBe(statusToneClass("failed"));
    expect(statusToneClass("refund_pending")).not.toBe(statusToneClass("completed"));
  });
});

describe("refundSummary", () => {
  it("summarises a full refund", () => {
    const summary = refundSummary({
      amount: 12000,
      status: "refunded",
      refundedAmount: 12000,
      refundedAt: "2026-11-08T10:00:00.000Z",
      refundReference: "PAYZEN-REF-123",
    });
    expect(summary.hasRefund).toBe(true);
    expect(summary.kind).toBe("full");
    expect(summary.amount).toBe(12000);
    expect(summary.date).toBe("2026-11-08T10:00:00.000Z");
    expect(summary.reference).toBe("PAYZEN-REF-123");
    expect(summary.isFull).toBe(true);
    expect(summary.isPartial).toBe(false);
  });

  it("summarises a partial refund left on a completed payment", () => {
    const summary = refundSummary({
      amount: 12000,
      status: "completed",
      refundedAmount: 5000,
      refundedAt: "2026-11-08T10:00:00.000Z",
      refundReference: "PAYZEN-REF-456",
    });
    expect(summary.hasRefund).toBe(true);
    expect(summary.kind).toBe("partial");
    expect(summary.amount).toBe(5000);
    expect(summary.isPartial).toBe(true);
    expect(summary.isFull).toBe(false);
  });

  it("also treats a refund recorded against a custom unit amount as full", () => {
    expect(refundSummary({ amount: 12500, refundedAmount: 12500 }).kind).toBe("full");
    // Over-refunds (bank error) are still reported as full, not partial.
    expect(refundSummary({ amount: 12500, refundedAmount: 15000 }).kind).toBe("full");
  });

  it("reports a refund that has metadata but no readable amount as unknown", () => {
    const summary = refundSummary({ amount: 12000, status: "refunded", refundedAt: "2026-11-08T10:00:00.000Z" });
    expect(summary.hasRefund).toBe(true);
    expect(summary.kind).toBe("unknown");
    expect(summary.amount).toBeNull();
    expect(summary.date).toBe("2026-11-08T10:00:00.000Z");
  });

  it("records an amount without warning about fullness when the original amount is unknown", () => {
    const summary = refundSummary({ refundedAmount: 5000, refundReference: "PAYZEN-REF-789" });
    expect(summary.hasRefund).toBe(true);
    expect(summary.kind).toBe("recorded");
    expect(summary.amount).toBe(5000);
    expect(summary.isFull).toBe(false);
    expect(summary.isPartial).toBe(false);
    expect(summary.reference).toBe("PAYZEN-REF-789");
  });

  it("treats the database default of zero as no refund", () => {
    const summary = refundSummary({
      amount: 12000,
      status: "completed",
      refundedAmount: 0,
      refundedAt: null,
      refundReference: null,
    });
    expect(summary.hasRefund).toBe(false);
    expect(summary.kind).toBe("none");
    expect(summary.amount).toBeNull();
    expect(summary.isFull).toBe(false);
    expect(summary.isPartial).toBe(false);
  });

  it("accepts numeric strings from JSON and ignores unreadable values", () => {
    expect(refundSummary({ amount: "12000", refundedAmount: "5000" }).amount).toBe(5000);
    expect(refundSummary({ amount: 12000, refundedAmount: "not-a-number" }).hasRefund).toBe(false);
    expect(refundSummary({ amount: 12000, refundedAmount: Number.NaN }).hasRefund).toBe(false);
    expect(refundSummary({ amount: 12000, refundedAmount: -5000 }).hasRefund).toBe(false);
  });

  it("trims blank dates and references to null", () => {
    expect(refundSummary({ refundedAt: "   ", refundReference: "  " }).hasRefund).toBe(false);
    expect(refundSummary({ refundedAmount: 1000, refundedAt: "  ", refundReference: " " })).toMatchObject({
      hasRefund: true,
      date: null,
      reference: null,
    });
  });

  it("is null-safe for missing payment rows", () => {
    for (const payment of [null, undefined, {}]) {
      expect(refundSummary(payment)).toEqual({
        hasRefund: false,
        kind: "none",
        amount: null,
        date: null,
        reference: null,
        isFull: false,
        isPartial: false,
      });
    }
  });
});

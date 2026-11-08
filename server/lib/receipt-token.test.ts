import { describe, it, expect } from "vitest";
import { signBookingReceiptToken, verifyBookingReceiptToken } from "./receipt-token.js";

const secret = "test-secret-that-is-long-enough-123456";

describe("booking receipt tokens", () => {
  it("round-trips a booking id", () => {
    const token = signBookingReceiptToken("book_123", { secret, now: 1_700_000_000_000 });
    expect(verifyBookingReceiptToken(token, { secret, now: 1_700_000_000_000 })).toEqual({ bookingId: "book_123" });
  });

  it("rejects a tampered token, another secret, and an expired token", () => {
    const token = signBookingReceiptToken("book_123", { secret, now: 1_700_000_000_000 });
    expect(verifyBookingReceiptToken(`${token}x`, { secret, now: 1_700_000_000_000 })).toBeNull();
    expect(verifyBookingReceiptToken(token, { secret: "other-secret", now: 1_700_000_000_000 })).toBeNull();
    expect(verifyBookingReceiptToken(token, { secret, now: 1_700_000_000_000 + 3 * 60 * 60 * 1000 })).toBeNull();
  });
});

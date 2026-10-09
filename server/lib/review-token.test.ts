import { describe, it, expect } from "vitest";
import { signReviewToken, verifyReviewToken, REVIEW_TOKEN_TTL_MS } from "./review-token.js";

const BOOKING = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const opts = { secret: "s".repeat(40), now: 1_800_000_000_000 };

describe("review invite tokens", () => {
  it("round-trips a booking id", () => {
    const token = signReviewToken(BOOKING, opts);
    expect(verifyReviewToken(token, opts)).toEqual({ bookingId: BOOKING });
  });

  it("is URL-safe", () => {
    expect(signReviewToken(BOOKING, opts)).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  it("refuses a payload swapped to another booking", () => {
    const [, sig] = signReviewToken(BOOKING, opts).split(".");
    const [otherPayload] = signReviewToken(OTHER, opts).split(".");
    expect(verifyReviewToken(`${otherPayload}.${sig}`, opts)).toBeNull();
  });

  it("refuses a tampered signature", () => {
    const token = signReviewToken(BOOKING, opts);
    const flipped = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    expect(verifyReviewToken(flipped, opts)).toBeNull();
  });

  it("refuses a token signed with another secret", () => {
    const token = signReviewToken(BOOKING, { ...opts, secret: "t".repeat(40) });
    expect(verifyReviewToken(token, opts)).toBeNull();
  });

  it("expires after 90 days", () => {
    const token = signReviewToken(BOOKING, opts);
    expect(verifyReviewToken(token, { ...opts, now: opts.now + REVIEW_TOKEN_TTL_MS - 1000 })).not.toBeNull();
    expect(verifyReviewToken(token, { ...opts, now: opts.now + REVIEW_TOKEN_TTL_MS + 1000 })).toBeNull();
  });

  it.each(["", "abc", "a.b.c", ".", "x.", ".y", "%%%.%%%"])("refuses malformed token %j", (bad) => {
    expect(verifyReviewToken(bad, opts)).toBeNull();
  });

  it("throws when no secret is configured", () => {
    expect(() => signReviewToken(BOOKING, { secret: "", now: opts.now })).toThrow();
  });
});

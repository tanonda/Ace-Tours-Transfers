import { describe, it, expect } from "vitest";
import { reviewAuthorName } from "./review-author.js";

const pub = { guest: "Anonymous", account: "Guest" };
const adm = { guest: "Anonymous Guest", account: "Registered User" };

describe("reviewAuthorName", () => {
  it("verified account-holder review uses the stored display name, not users.name", () => {
    expect(reviewAuthorName({ verified: true, isGuest: false, guestName: "Sarah M.", userName: "Sarah Mitchell" }, pub)).toBe("Sarah M.");
  });
  it("legacy guest uses guestName or the guest fallback", () => {
    expect(reviewAuthorName({ isGuest: true, guestName: "Bob" }, pub)).toBe("Bob");
    expect(reviewAuthorName({ isGuest: true, guestName: null }, pub)).toBe("Anonymous");
    expect(reviewAuthorName({ isGuest: true, guestName: "" }, adm)).toBe("Anonymous Guest");
  });
  it("legacy account review uses users.name or the account fallback", () => {
    expect(reviewAuthorName({ isGuest: false, userName: "Ann Lee" }, pub)).toBe("Ann Lee");
    expect(reviewAuthorName({ isGuest: false, userName: null }, pub)).toBe("Guest");
    expect(reviewAuthorName({ isGuest: false, userName: null }, adm)).toBe("Registered User");
  });
  it("verified without a stored name falls back to existing logic", () => {
    expect(reviewAuthorName({ verified: true, isGuest: false, guestName: null, userName: "Ann Lee" }, pub)).toBe("Ann Lee");
  });
});

import { describe, it, expect } from "vitest";
import { apiErrorMessage } from "./api-error";

describe("apiErrorMessage", () => {
  it("pulls the server's message out of an apiRequest error", () => {
    expect(apiErrorMessage(new Error('503: {"error":"Video upload isn\'t set up (Cloudinary is not configured)."}'), "x")).toBe(
      "Video upload isn't set up (Cloudinary is not configured).",
    );
  });
  it("keeps plain-text server replies without the status prefix", () => {
    expect(apiErrorMessage(new Error("401: Authentication required"), "x")).toBe("Authentication required");
  });
  it("uses the message of ordinary errors", () => {
    expect(apiErrorMessage(new Error("Network error during upload."), "x")).toBe("Network error during upload.");
  });
  it("falls back when there is nothing readable", () => {
    expect(apiErrorMessage(undefined, "Please try again.")).toBe("Please try again.");
    expect(apiErrorMessage(new Error('500: {"nope":1}'), "Please try again.")).toBe("Please try again.");
    expect(apiErrorMessage(new Error(""), "Please try again.")).toBe("Please try again.");
  });
});

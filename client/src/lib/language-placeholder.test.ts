import { describe, it, expect } from "vitest";
import { keepAcrossLanguageSwitch } from "./language-placeholder";

const query = (queryKey: unknown[]) => ({ queryKey }) as never;

describe("keepAcrossLanguageSwitch", () => {
  it("keeps the previous data when only the language changed", () => {
    const placeholder = keepAcrossLanguageSwitch(["tour", "abc"]);
    expect(placeholder({ title: "Private Bus Hire" }, query(["tour", "abc", "en"]))).toEqual({ title: "Private Bus Hire" });
  });

  it("shows no stale data when navigating to a different item", () => {
    const placeholder = keepAcrossLanguageSwitch(["tour", "xyz"]);
    expect(placeholder({ title: "Private Bus Hire" }, query(["tour", "abc", "en"]))).toBeUndefined();
  });

  it("works for keys that are only a name plus the language", () => {
    const placeholder = keepAcrossLanguageSwitch(["products"]);
    expect(placeholder([1, 2], query(["products", "en"]))).toEqual([1, 2]);
    expect(placeholder([1, 2], query(["settings"]))).toBeUndefined();
  });

  it("has nothing to keep on the first load", () => {
    expect(keepAcrossLanguageSwitch(["products"])(undefined, undefined)).toBeUndefined();
  });
});

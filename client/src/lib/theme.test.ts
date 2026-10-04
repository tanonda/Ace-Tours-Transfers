import { describe, it, expect } from "vitest";
import { INITIAL_THEME, resolveStoredTheme } from "./theme";

describe("theme", () => {
  it("first render is light, matching the prerendered HTML", () => {
    expect(INITIAL_THEME).toBe("light");
  });

  it("uses a stored theme", () => {
    expect(resolveStoredTheme("dark", false)).toBe("dark");
    expect(resolveStoredTheme("light", true)).toBe("light");
  });

  it("falls back to the OS preference when nothing valid is stored", () => {
    expect(resolveStoredTheme(null, true)).toBe("dark");
    expect(resolveStoredTheme(null, false)).toBe("light");
    expect(resolveStoredTheme("purple", true)).toBe("dark");
  });
});

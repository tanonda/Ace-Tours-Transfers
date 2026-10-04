export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "ace-theme";

/** Prerendered pages are captured in light mode; the first client render must match. */
export const INITIAL_THEME: Theme = "light";

export function resolveStoredTheme(stored: string | null, prefersDark: boolean): Theme {
  if (stored === "light" || stored === "dark") return stored;
  return prefersDark ? "dark" : "light";
}

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, ReactNode } from "react";
import { INITIAL_THEME, resolveStoredTheme, THEME_STORAGE_KEY, type Theme } from "./theme";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Start from the prerender's theme so hydration matches, then apply the visitor's
  // choice before the browser paints (layout effect).
  const [theme, setThemeState] = useState<Theme>(INITIAL_THEME);
  const [storedThemeApplied, setStoredThemeApplied] = useState(false);

  useLayoutEffect(() => {
    setThemeState(
      resolveStoredTheme(
        localStorage.getItem(THEME_STORAGE_KEY),
        window.matchMedia("(prefers-color-scheme: dark)").matches,
      ),
    );
    setStoredThemeApplied(true);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    // Don't overwrite the stored choice with the initial value before it is read.
    if (storedThemeApplied) localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme, storedThemeApplied]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  // Memoized: applying a stored theme that equals the prerendered one changes nothing
  // for readers, so they don't re-render.
  const value = useMemo(() => ({ theme, toggleTheme, setTheme }), [theme, toggleTheme, setTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

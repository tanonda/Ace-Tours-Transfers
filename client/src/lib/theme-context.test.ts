import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createElement } from "react";
import { installDom, mount } from "./test-dom";

beforeAll(() => {
  installDom();
  // jsdom has no matchMedia; the OS preference here is light.
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: false }) });
});
beforeEach(() => localStorage.clear());

async function renderToggle() {
  const { ThemeProvider, useTheme } = await import("./theme-context");
  let renders = 0;
  const Toggle = () => {
    renders++;
    return createElement("span", null, useTheme().theme);
  };
  const { container } = await mount(createElement(ThemeProvider, null, createElement(Toggle)));
  return { container, renders: () => renders };
}

describe("ThemeProvider renders", () => {
  it("doesn't re-render theme readers when the stored theme matches the prerendered one", async () => {
    const { container, renders } = await renderToggle();
    expect(container.textContent).toBe("light");
    expect(renders()).toBe(1);
  });

  it("switches to a stored dark theme", async () => {
    localStorage.setItem("ace-theme", "dark");
    const { container } = await renderToggle();
    expect(container.textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});

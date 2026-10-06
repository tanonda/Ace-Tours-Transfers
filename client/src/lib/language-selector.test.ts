import { describe, it, expect, beforeAll, vi } from "vitest";
import { createElement } from "react";
import { installDom, mount, recordRenders } from "./test-dom";

let renders: Map<string, number>;
beforeAll(async () => {
  installDom();
  renders = recordRenders(); // before react-dom loads
  (globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  (window as any).HTMLElement.prototype.scrollIntoView = () => {}; // jsdom lacks it
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(Response.json({}))));
  await import("./i18n");
});

// The switcher sits in the header on every page (three times in the layout), so it
// must cost nothing after the page appears and show its label in prerendered HTML.
describe("LanguageSelector", () => {
  it("shows the current language in server-rendered HTML, so the prerendered button is not empty", async () => {
    const { renderToString } = await import("react-dom/server");
    const { LanguageSelector } = await import("@/components/language-selector");
    expect(renderToString(createElement(LanguageSelector))).toContain("English");
  });

  it("does not re-render after mounting", async () => {
    const { LanguageSelector } = await import("@/components/language-selector");
    renders.clear();
    const { unmount } = await mount(createElement(LanguageSelector));
    // A Shadcn Select re-rendered 22 components here, and a Radix DropdownMenu 7
    // (its Popper recording the button's position); SelectMenu holds no state until opened.
    expect(Object.fromEntries(renders)).toEqual({});
    await unmount();
  });

  it("switches the site language when a language is chosen", async () => {
    const { default: i18n } = await import("./i18n");
    const { LanguageSelector } = await import("@/components/language-selector");
    const change = vi.spyOn(i18n, "changeLanguage").mockResolvedValue((() => "") as any);
    const { container, act, unmount } = await mount(createElement(LanguageSelector));

    const trigger = container.querySelector<HTMLElement>('[data-testid="select-language"]')!;
    await act(async () => trigger.click());
    const french = [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"], [role="option"]')]
      .find((el) => el.textContent?.includes("Français"))!;
    expect(french).toBeTruthy();
    await act(async () => french.click());

    expect(change).toHaveBeenCalledWith("fr");
    change.mockRestore();
    await unmount();
  });
});

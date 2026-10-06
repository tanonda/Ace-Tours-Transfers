import { describe, it, expect, beforeAll, vi } from "vitest";
import { createElement } from "react";
import { installDom, mount, recordRenders } from "./test-dom";

let renders: Map<string, number>;
beforeAll(() => {
  installDom();
  renders = recordRenders(); // before react-dom loads
});

const key = (el: Element, k: string) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));

async function setup(value = "fr") {
  const { SelectMenu } = await import("@/components/select-menu");
  const onSelect = vi.fn();
  const view = await mount(createElement(SelectMenu, {
    value,
    onSelect,
    ariaLabel: "Select language",
    testId: "select-language",
    triggerContent: "Language",
    groups: [
      { label: "Popular", items: [{ value: "en", content: "English" }, { value: "fr", content: "Français" }] },
      { items: [{ value: "bi", content: "Bislama" }] },
    ],
  }));
  const trigger = view.container.querySelector<HTMLButtonElement>('[data-testid="select-language"]')!;
  const menu = () => document.querySelector<HTMLElement>('[role="menu"]');
  const items = () => [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')];
  const open = async () => view.act(async () => trigger.click());
  return { ...view, trigger, menu, items, open, onSelect };
}

// The language and currency menus sit in the header on every page. Radix menus
// re-render their Popper once on mount to record the button's position; this one
// holds no state until it is opened.
describe("SelectMenu", () => {
  it("does not re-render after mounting", async () => {
    renders.clear();
    const { unmount } = await setup();
    expect(Object.fromEntries(renders)).toEqual({});
    await unmount();
  });

  it("opens a menu of radio items above the page, marking the current choice", async () => {
    const { trigger, menu, items, open, container, unmount } = await setup();
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(menu()).toBeNull();
    await open();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(container.contains(menu())).toBe(false); // portalled, so a scrolling container can't clip it
    expect(items().map((i) => i.getAttribute("aria-checked"))).toEqual(["false", "true", "false"]);
    expect(menu()!.textContent).toContain("Popular");
    await unmount();
  });

  it("focuses the current choice when it opens", async () => {
    const { items, open, unmount } = await setup();
    await open();
    expect(document.activeElement).toBe(items()[1]);
    await unmount();
  });

  it("moves through items with the arrow keys, wrapping, and Home/End", async () => {
    const { items, open, act, unmount } = await setup();
    await open();
    await act(async () => key(document.activeElement!, "ArrowDown"));
    expect(document.activeElement).toBe(items()[2]);
    await act(async () => key(document.activeElement!, "ArrowDown"));
    expect(document.activeElement).toBe(items()[0]); // wraps
    await act(async () => key(document.activeElement!, "ArrowUp"));
    expect(document.activeElement).toBe(items()[2]);
    await act(async () => key(document.activeElement!, "Home"));
    expect(document.activeElement).toBe(items()[0]);
    await act(async () => key(document.activeElement!, "End"));
    expect(document.activeElement).toBe(items()[2]);
    await unmount();
  });

  it("selects with Enter, closes, and returns focus to the button", async () => {
    const { trigger, menu, open, act, onSelect, unmount } = await setup();
    await open();
    await act(async () => key(document.activeElement!, "ArrowDown"));
    await act(async () => key(document.activeElement!, "Enter"));
    expect(onSelect).toHaveBeenCalledWith("bi");
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(trigger);
    await unmount();
  });

  it("selects on click", async () => {
    const { items, open, act, onSelect, unmount } = await setup();
    await open();
    await act(async () => items()[0].click());
    expect(onSelect).toHaveBeenCalledWith("en");
    await unmount();
  });

  it("closes on Escape and returns focus to the button", async () => {
    const { trigger, menu, open, act, unmount } = await setup();
    await open();
    await act(async () => key(document.activeElement!, "Escape"));
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(trigger);
    await unmount();
  });

  it("closes on Tab and on a click outside", async () => {
    const { menu, open, act, unmount } = await setup();
    await open();
    await act(async () => key(document.activeElement!, "Tab"));
    expect(menu()).toBeNull();
    await open();
    await act(async () => document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true })));
    expect(menu()).toBeNull();
    await unmount();
  });

  it("inside a modal dialog, opens within the dialog and Escape closes only the menu", async () => {
    const { SelectMenu } = await import("@/components/select-menu");
    const dialogEscapes = vi.fn();
    // Radix dialogs listen for Escape on document, in the capture phase.
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !e.defaultPrevented) dialogEscapes(); }, true);
    const view = await mount(createElement("div", { role: "dialog" },
      createElement(SelectMenu, {
        value: "en", onSelect: vi.fn(), ariaLabel: "Select language", testId: "dialog-lang", triggerContent: "Language",
        groups: [{ items: [{ value: "en", content: "English" }, { value: "fr", content: "Français" }] }],
      })));
    const dialog = view.container.querySelector('[role="dialog"]')!;
    const trigger = view.container.querySelector<HTMLButtonElement>('[data-testid="dialog-lang"]')!;
    await view.act(async () => trigger.click());
    const menu = document.querySelector('[role="menu"]')!;
    expect(dialog.contains(menu)).toBe(true); // a modal dialog blocks clicks outside itself
    await view.act(async () => key(document.activeElement!, "Escape"));
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(dialogEscapes).not.toHaveBeenCalled();
    await view.unmount();
  });
});

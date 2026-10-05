import { describe, it, expect, beforeAll } from "vitest";
import { createElement } from "react";
import { installDom, mount, recordRenders } from "./test-dom";

let renders: Map<string, number>;
beforeAll(() => {
  installDom();
  renders = recordRenders(); // before react-dom loads
});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function setup() {
  const { NavDropdown } = await import("@/components/nav-dropdown");
  const panel = createElement("ul", null,
    createElement("li", null, createElement("a", { href: "/tours/blue-lagoon" }, "Blue Lagoon")),
    createElement("li", null, createElement("a", { href: "/tours" }, "View all tours")),
  );
  const view = await mount(createElement(NavDropdown, { label: "Tours", children: panel }));
  const trigger = view.container.querySelector("button")!;
  const root = trigger.parentElement!;
  const isOpen = () => trigger.getAttribute("aria-expanded") === "true" && view.container.textContent!.includes("Blue Lagoon");
  return { ...view, trigger, root, isOpen };
}

// The header's Tours, Transfers and My Bookings dropdowns. Radix NavigationMenu
// re-rendered ~114 components between them on every page load (also on phones,
// where the desktop nav is mounted but hidden); this one changes nothing until used.
describe("NavDropdown", () => {
  it("does not re-render after mounting", async () => {
    renders.clear();
    const { unmount } = await setup();
    expect(Object.fromEntries(renders)).toEqual({});
    await unmount();
  });

  it("starts closed, with the panel's links not rendered", async () => {
    const { trigger, container, unmount } = await setup();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(container.textContent).not.toContain("Blue Lagoon");
    await unmount();
  });

  it("opens and closes on click", async () => {
    const { trigger, act, isOpen, unmount } = await setup();
    await act(async () => trigger.click());
    expect(isOpen()).toBe(true);
    await act(async () => trigger.click());
    expect(isOpen()).toBe(false);
    await unmount();
  });

  it("opens on hover and closes shortly after the pointer leaves", async () => {
    const { root, act, isOpen, unmount } = await setup();
    await act(async () => { root.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })); });
    expect(isOpen()).toBe(true);
    await act(async () => { root.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body })); });
    expect(isOpen()).toBe(true); // a short grace period to cross the gap to the panel
    await act(async () => { await wait(300); });
    expect(isOpen()).toBe(false);
    await unmount();
  });

  it("closes on Escape and returns focus to the button", async () => {
    const { trigger, container, act, isOpen, unmount } = await setup();
    await act(async () => trigger.click());
    const link = container.querySelector<HTMLAnchorElement>('a[href="/tours"]')!;
    link.focus();
    await act(async () => { link.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect(isOpen()).toBe(false);
    expect(document.activeElement).toBe(trigger);
    await unmount();
  });

  it("closes when one of its links is clicked", async () => {
    const { trigger, container, act, isOpen, unmount } = await setup();
    await act(async () => trigger.click());
    const link = container.querySelector<HTMLAnchorElement>('a[href="/tours/blue-lagoon"]')!;
    link.addEventListener("click", (e) => e.preventDefault()); // jsdom can't navigate
    await act(async () => link.click());
    expect(isOpen()).toBe(false);
    await unmount();
  });
});

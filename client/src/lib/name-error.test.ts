import { describe, it, expect, beforeAll, vi } from "vitest";
import { createElement } from "react";
import { installDom, mount } from "./test-dom";

beforeAll(async () => {
  installDom();
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(Response.json({}))));
  await import("./i18n");
});

// Shown under a name field while the guest types, matching the server's rule
// (shared/person-name.ts), so they find out before pressing submit.
describe("NameError", () => {
  it("shows nothing for an ordinary name", async () => {
    const { NameError } = await import("@/components/name-error");
    const { container, unmount } = await mount(createElement(NameError, { value: "Jean-Marc O'Brien", id: "name-error" }));
    expect(container.textContent).toBe("");
    await unmount();
  });

  it("shows nothing for an empty field", async () => {
    const { NameError } = await import("@/components/name-error");
    const { container, unmount } = await mount(createElement(NameError, { value: "", id: "name-error" }));
    expect(container.textContent).toBe("");
    await unmount();
  });

  it("explains the problem as soon as the name contains < or >", async () => {
    const { NameError } = await import("@/components/name-error");
    const { container, unmount } = await mount(createElement(NameError, { value: "Jo <b>", id: "name-error" }));
    const message = container.querySelector("#name-error")!;
    expect(message.textContent).toBe("Names can't contain < or >.");
    expect(message.getAttribute("role")).toBe("alert");
    await unmount();
  });
});

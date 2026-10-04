import { describe, it, expect, beforeAll, vi } from "vitest";
import { createElement } from "react";
import { installDom, mount } from "./test-dom";

beforeAll(installDom);

describe("AuthProvider renders", () => {
  it("doesn't re-render auth consumers when the visitor navigates", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));
    const { AuthProvider, useAuth } = await import("./auth-context");
    const { navigate } = await import("wouter/use-browser-location");
    let renders = 0;
    const Header = () => {
      renders++;
      return createElement("span", null, useAuth().isLoading ? "…" : "signed out");
    };
    const { container, act } = await mount(createElement(AuthProvider, null, createElement(Header)));
    await act(async () => {}); // let the /api/auth/me check settle
    expect(container.textContent).toBe("signed out");
    const settled = renders;

    await act(async () => navigate("/tours"));
    await act(async () => navigate("/faq"));
    expect(renders).toBe(settled);
  });
});

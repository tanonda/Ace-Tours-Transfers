import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { lazyWithPreload, matchesRoutePattern } from "./preloadable";

describe("lazyWithPreload", () => {
  it("renders synchronously once preloaded, so hydration never waits on the chunk", async () => {
    const Page = lazyWithPreload(async () => ({ default: ({ name }: { name: string }) => createElement("p", null, `hi ${name}`) }));
    await Page.preload();
    expect(renderToString(createElement(Page, { name: "Efate" }))).toBe("<p>hi Efate</p>");
  });

  it("loads the module once however often it is preloaded or rendered", async () => {
    let calls = 0;
    const Page = lazyWithPreload(async () => {
      calls++;
      return { default: () => createElement("p", null, "x") };
    });
    await Promise.all([Page.preload(), Page.preload()]);
    renderToString(createElement(Page));
    expect(calls).toBe(1);
  });
});

describe("matchesRoutePattern", () => {
  it.each([
    ["/", "/", true],
    ["/tours", "/tours", true],
    ["/tours", "/tours/", true],
    ["/tours/:id", "/tours/f9be5daa-41e4", true],
    ["/tours/:id", "/tours", false],
    ["/tours", "/tours/abc", false],
    ["/blog/:slug", "/blog/best-things-to-do", true],
    ["/", "/tours", false],
    ["/faq", "/FAQ", false],
  ])("%s vs %s -> %s", (pattern, path, expected) => {
    expect(matchesRoutePattern(pattern, path)).toBe(expected);
  });
});

import { describe, it, expect, beforeAll, vi } from "vitest";
import { createElement } from "react";
import { installDom, mount } from "./test-dom";

beforeAll(async () => {
  installDom();
  // Helmet writes to <head>/<html> on the next frame; jsdom has no requestAnimationFrame by default.
  (globalThis as any).requestAnimationFrame = (cb: () => void) => setTimeout(cb, 0);
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(Response.json([]))));
  await import("./i18n");
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 50)); // Helmet writes on the next frame

// Switching language in the page is two steps: i18next first switches to "fr" while
// the French translations are still loading (resolvedLanguage stays "en"), then
// re-applies "fr" once they arrive. react-i18next hands components a copy of the
// i18n object that it refreshes only when `language` changes, so the second step
// (same language, new resolvedLanguage) used to leave <html lang="en">.
describe("SEO <html lang>", () => {
  it('becomes "fr" after an in-page switch to French whose translations load late', async () => {
    const { default: i18n } = await import("./i18n");
    const { HelmetProvider } = await import("react-helmet-async");
    const { SEO } = await import("@/components/seo");
    const { act, unmount } = await mount(
      createElement(HelmetProvider, null, createElement(SEO, { title: "Tours", description: "Tours in Efate" })),
    );
    await act(async () => { await settle(); });
    expect(document.documentElement.lang).toBe("en");

    await act(async () => {
      // Step 1: switch before the French bundle exists (as the language selector does).
      await i18n.changeLanguage("fr");
      // Step 2: the bundle arrives and the language is re-applied (language-loader.ts).
      i18n.addResourceBundle("fr", "translation", { nav: { home: "Accueil" } }, true, true);
      await i18n.changeLanguage("fr");
      await settle();
    });

    expect(i18n.resolvedLanguage).toBe("fr");
    expect(document.documentElement.lang).toBe("fr");
    await unmount();
    await i18n.changeLanguage("en");
  });
});

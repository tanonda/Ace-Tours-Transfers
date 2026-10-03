import { describe, expect, it, vi } from "vitest";
import { createLanguageLoader } from "./language-loader";

function fakeI18n(loaded: string[] = ["en"]) {
  const bundles = new Set(loaded);
  return {
    hasResourceBundle: vi.fn((lng: string) => bundles.has(lng)),
    addResourceBundle: vi.fn((lng: string) => {
      bundles.add(lng);
    }),
  };
}

describe("createLanguageLoader", () => {
  it("loads a missing language once and registers it with i18next", async () => {
    const i18n = fakeI18n();
    const fr = vi.fn(async () => ({ default: { hello: "bonjour" } }));
    const ensure = createLanguageLoader(i18n, { fr });

    await ensure("fr");
    await ensure("fr");

    expect(fr).toHaveBeenCalledTimes(1);
    expect(i18n.addResourceBundle).toHaveBeenCalledWith("fr", "translation", { hello: "bonjour" }, true, true);
  });

  it("normalises regional codes like zh-CN to zh", async () => {
    const i18n = fakeI18n();
    const zh = vi.fn(async () => ({ default: {} }));
    await createLanguageLoader(i18n, { zh })("zh-CN");
    expect(zh).toHaveBeenCalled();
  });

  it("does nothing for the bundled language or unknown codes", async () => {
    const i18n = fakeI18n();
    const fr = vi.fn(async () => ({ default: {} }));
    const ensure = createLanguageLoader(i18n, { fr });

    await ensure("en");
    await ensure("de");
    await ensure(undefined);

    expect(fr).not.toHaveBeenCalled();
    expect(i18n.addResourceBundle).not.toHaveBeenCalled();
  });

  it("shares one in-flight request between concurrent callers", async () => {
    const i18n = fakeI18n();
    const es = vi.fn(async () => ({ default: {} }));
    const ensure = createLanguageLoader(i18n, { es });

    await Promise.all([ensure("es"), ensure("es")]);

    expect(es).toHaveBeenCalledTimes(1);
  });

  it("lets a failed load be retried", async () => {
    const i18n = fakeI18n();
    const bi = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ default: {} });
    const ensure = createLanguageLoader(i18n, { bi });

    await expect(ensure("bi")).rejects.toThrow("offline");
    await ensure("bi");

    expect(bi).toHaveBeenCalledTimes(2);
    expect(i18n.addResourceBundle).toHaveBeenCalledTimes(1);
  });
});

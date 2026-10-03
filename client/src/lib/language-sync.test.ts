import { describe, expect, it } from "vitest";
import i18next from "i18next";
import { createLanguageLoader, createLanguageSync } from "./language-loader";

async function setup(lng: string) {
  const i18n = i18next.createInstance();
  await i18n.init({
    lng,
    resources: { en: { translation: { hello: "hello" } } },
    partialBundledLanguages: true,
    fallbackLng: "en",
    supportedLngs: ["en", "fr"],
    load: "languageOnly",
  });
  const ensure = createLanguageLoader(i18n, { fr: async () => ({ default: { hello: "bonjour" } }) });
  return { i18n, sync: createLanguageSync(i18n, ensure) };
}

describe("createLanguageSync", () => {
  it("makes resolvedLanguage follow a lazily loaded language (drives <html lang> and og:locale)", async () => {
    const { i18n, sync } = await setup("fr-FR");
    expect(i18n.resolvedLanguage).toBe("en"); // French not loaded yet: i18next falls back

    await sync(i18n.language);

    expect(i18n.resolvedLanguage).toBe("fr");
    expect(i18n.t("hello")).toBe("bonjour");
  });

  it("leaves English alone", async () => {
    const { i18n, sync } = await setup("en-US");
    await sync(i18n.language);
    expect(i18n.resolvedLanguage).toBe("en");
  });
});

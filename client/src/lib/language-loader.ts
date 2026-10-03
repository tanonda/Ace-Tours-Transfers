type TranslationModule = { default: Record<string, unknown> };
type Loader = () => Promise<TranslationModule>;

interface I18nLike {
  hasResourceBundle(lng: string, ns: string): boolean;
  addResourceBundle(lng: string, ns: string, resources: Record<string, unknown>, deep?: boolean, overwrite?: boolean): unknown;
}

/**
 * Returns ensureLanguage(lng): fetches a translation file the first time a
 * language is needed and registers it with i18next. Only English is bundled;
 * shipping all five languages to every visitor cost ~90 KB of parse per page.
 */
export function createLanguageLoader(i18n: I18nLike, loaders: Record<string, Loader>) {
  const inFlight = new Map<string, Promise<void>>();

  return function ensureLanguage(lng: string | undefined): Promise<void> {
    const code = (lng ?? "").toLowerCase().split(/[-_]/)[0];
    const loader = loaders[code];
    if (!loader || i18n.hasResourceBundle(code, "translation")) return Promise.resolve();

    let pending = inFlight.get(code);
    if (!pending) {
      pending = loader()
        .then((mod) => {
          i18n.addResourceBundle(code, "translation", mod.default, true, true);
        })
        .finally(() => inFlight.delete(code));
      inFlight.set(code, pending);
    }
    return pending;
  };
}

interface I18nSyncLike {
  resolvedLanguage?: string;
  hasResourceBundle(lng: string, ns: string): boolean;
  changeLanguage(lng: string): Promise<unknown>;
}

/**
 * Returns syncLanguage(lng): loads the language, then re-applies it so i18next
 * recomputes resolvedLanguage. i18next resolves the language when it is set; if
 * the translations arrive later it keeps reporting the fallback ("en"), which is
 * what <html lang> and og:locale are built from.
 */
export function createLanguageSync(i18n: I18nSyncLike, ensureLanguage: (lng: string | undefined) => Promise<void>) {
  return async function syncLanguage(lng: string | undefined): Promise<void> {
    await ensureLanguage(lng);
    const code = (lng ?? "").toLowerCase().split(/[-_]/)[0];
    if (lng && i18n.resolvedLanguage !== code && i18n.hasResourceBundle(code, "translation")) {
      await i18n.changeLanguage(lng);
    }
  };
}

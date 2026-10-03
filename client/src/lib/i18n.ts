import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { createLanguageLoader, createLanguageSync } from './language-loader';

// English is bundled: it is the default, the fallback, and what crawlers get.
// Other languages load on demand (see language-loader.ts).
import enTranslations from '@/locales/en.json';

export const ensureLanguage = createLanguageLoader(i18n, {
  fr: () => import('@/locales/fr.json'),
  es: () => import('@/locales/es.json'),
  bi: () => import('@/locales/bi.json'),
  zh: () => import('@/locales/zh.json'),
});

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: enTranslations } },
    partialBundledLanguages: true,
    fallbackLng: 'en',
    supportedLngs: ['en', 'fr', 'es', 'bi', 'zh'],
    load: 'languageOnly',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    // Re-render when a lazily loaded language arrives.
    react: { bindI18nStore: 'added' },
  });

// Load a language's translations and make i18next re-resolve it (see language-loader.ts).
export const syncLanguage = createLanguageSync(i18n, ensureLanguage);

// Covers every language switch (e.g. the language selector).
i18n.on('languageChanged', (lng) => {
  syncLanguage(lng).catch((err) => console.warn(`[i18n] could not load ${lng}:`, err));
});

export default i18n;

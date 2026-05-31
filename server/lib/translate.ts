/**
 * Auto-translation service for CMS content.
 *
 * Uses `google-translate-api-x` (free, no API key required).
 * Supported target languages: fr, es, zh-CN.
 * Bislama (bi) is NOT supported — must be entered manually.
 */

import { translate } from 'google-translate-api-x';

/** Languages we can auto-translate to (source is always English). */
export const AUTO_TRANSLATE_TARGETS = ['fr', 'es', 'zh'] as const;
export type TranslatableLocale = (typeof AUTO_TRANSLATE_TARGETS)[number];

/** Map our internal locale codes to Google Translate codes. */
const LOCALE_MAP: Record<string, string> = {
  fr: 'fr',
  es: 'es',
  zh: 'zh-CN',
};

/**
 * Translate a text string from English to a target language.
 *
 * For rich-text (HTML) content the Google Translate API handles basic HTML tags
 * natively. If translation fails, returns the original text so the UI degrades
 * gracefully rather than erroring out.
 */
export async function translateText(
  text: string,
  targetLocale: string,
): Promise<string> {
  if (!text?.trim()) return text;

  const googleLang = LOCALE_MAP[targetLocale];
  if (!googleLang) {
    console.warn(`[TRANSLATE] Unsupported locale "${targetLocale}" — returning original text.`);
    return text;
  }

  try {
    const result = await translate(text, { from: 'en', to: googleLang });
    return result.text;
  } catch (error: any) {
    console.error(`[TRANSLATE] Failed to translate to ${targetLocale}:`, error?.message);
    return text; // graceful fallback
  }
}

/**
 * Translate a text string to ALL supported target languages in parallel.
 * Returns a map of locale → translated text.
 */
export async function translateToAll(
  text: string,
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};

  await Promise.allSettled(
    AUTO_TRANSLATE_TARGETS.map(async (locale) => {
      results[locale] = await translateText(text, locale);
    }),
  );

  return results;
}

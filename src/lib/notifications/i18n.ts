import fs from 'fs';
import path from 'path';

/**
 * Server-side internationalization utility for push notifications
 * Loads translations from the localization files and provides translation functions
 */

type TranslationMap = Record<string, string>;
const translationCache: Record<string, TranslationMap> = {};

/**
 * Load translations for a given language
 * Falls back to English if the language file is not found
 * @param lang - Language code (e.g., 'en', 'es', 'fr')
 * @returns Translation map for the language
 */
export function loadTranslations(lang: string): TranslationMap {
  // Return cached translations if available
  if (translationCache[lang]) {
    return translationCache[lang];
  }

  const filePath = path.join(
    process.cwd(),
    'src/localization/translations',
    `${lang}.json`
  );

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    translationCache[lang] = JSON.parse(content);
    return translationCache[lang];
  } catch (error) {
    // Fall back to English if the requested language is not found
    if (lang !== 'en') {
      console.warn(
        `[i18n] Translation file not found for "${lang}", falling back to English`
      );
      return loadTranslations('en');
    }
    // If even English is not found, return empty object
    console.error('[i18n] English translation file not found');
    return {};
  }
}

/**
 * Translate a key with optional replacements
 * @param key - Translation key
 * @param lang - Language code (e.g., 'en', 'es', 'fr')
 * @param replacements - Optional key-value pairs for variable replacement
 * @returns Translated string with replacements applied
 */
export function t(
  key: string,
  lang: string,
  replacements?: Record<string, string | number>
): string {
  const translations = loadTranslations(lang);
  let text = translations[key] || key;

  if (replacements) {
    Object.entries(replacements).forEach(([k, v]) => {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    });
  }

  return text;
}

/**
 * Format elapsed time in a localized way
 * @param minutes - Total elapsed minutes
 * @param lang - Language code
 * @returns Formatted time string (e.g., "2 hours 30 minutes")
 */
export function formatTimeElapsed(minutes: number, lang: string): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);

  const parts: string[] = [];

  if (hours > 0) {
    const hourKey =
      hours === 1
        ? 'notification.time.hour'
        : 'notification.time.hours';
    parts.push(t(hourKey, lang, { count: hours }));
  }

  if (mins > 0 || hours === 0) {
    const minuteKey =
      mins === 1
        ? 'notification.time.minute'
        : 'notification.time.minutes';
    parts.push(t(minuteKey, lang, { count: mins }));
  }

  return parts.join(' ');
}

/**
 * Clear the translation cache (useful for testing or hot reloading)
 */
export function clearTranslationCache(): void {
  Object.keys(translationCache).forEach((key) => {
    delete translationCache[key];
  });
}

/**
 * Default language to use when user language preference is not available
 */
export const DEFAULT_LANGUAGE = 'en';

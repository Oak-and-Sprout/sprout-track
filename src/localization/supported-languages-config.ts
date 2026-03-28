import rawSupportedLanguages from '@/src/localization/supported-languages.json';

export type SupportedLanguage = {
  code: string;
  name: string;
  abbreviation: string;
};

function normalizeEntry(
  item: unknown,
  index: number
): SupportedLanguage | null {
  if (typeof item === 'string') {
    const code = item.toLowerCase();
    if (code.length !== 2) return null;
    return {
      code,
      name: code.toUpperCase(),
      abbreviation: code.toUpperCase(),
    };
  }
  if (item && typeof item === 'object' && 'code' in item && 'name' in item) {
    const o = item as Record<string, unknown>;
    const code = typeof o.code === 'string' ? o.code.toLowerCase().trim() : '';
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    if (code.length !== 2 || !name) return null;
    const abbr =
      typeof o.abbreviation === 'string' && o.abbreviation.trim()
        ? o.abbreviation.trim().toUpperCase()
        : code.toUpperCase();
    return { code, name, abbreviation: abbr };
  }
  if (process.env.NODE_ENV === 'development') {
    console.warn(`supported-languages.json: skipping invalid entry at index ${index}`);
  }
  return null;
}

function parseSupportedLanguages(): SupportedLanguage[] {
  if (!Array.isArray(rawSupportedLanguages)) {
    throw new Error('supported-languages.json must be a JSON array');
  }

  const entries: SupportedLanguage[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < rawSupportedLanguages.length; i++) {
    const normalized = normalizeEntry(rawSupportedLanguages[i], i);
    if (!normalized) continue;
    if (seen.has(normalized.code)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`supported-languages.json: duplicate code "${normalized.code}" skipped`);
      }
      continue;
    }
    seen.add(normalized.code);
    entries.push(normalized);
  }

  if (!entries.some((e) => e.code === 'en')) {
    throw new Error('supported-languages.json must include English ("en")');
  }

  return entries;
}

const _supportedLanguages = parseSupportedLanguages();

export const supportedLanguages: readonly SupportedLanguage[] = _supportedLanguages;

export const supportedLanguageCodes: readonly string[] = _supportedLanguages.map((l) => l.code);

export function getSupportedLanguage(code: string): SupportedLanguage | undefined {
  const key = code.toLowerCase();
  return _supportedLanguages.find((l) => l.code === key);
}

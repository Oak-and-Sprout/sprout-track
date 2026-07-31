import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const TRANSLATIONS_DIR = path.join(__dirname, '../src/localization/translations');
const LANGUAGES_FILE = path.join(__dirname, '../src/localization/supported-languages.json');

type Translations = Record<string, string>;

const read = (file: string): Translations =>
  JSON.parse(fs.readFileSync(path.join(TRANSLATIONS_DIR, file), 'utf8'));

const supportedCodes: string[] = JSON.parse(fs.readFileSync(LANGUAGES_FILE, 'utf8')).map(
  (lang: { code: string }) => lang.code.toLowerCase()
);

const translationFiles = fs.readdirSync(TRANSLATIONS_DIR).filter((file) => file.endsWith('.json'));
const reference = read('en.json');
const referenceKeys = Object.keys(reference);

/** Placeholders such as {babyName} must survive translation untouched. */
const placeholders = (value: string): string[] =>
  [...value.matchAll(/\{[^}]*\}/g)].map((match) => match[0]).sort();

describe('translation files', () => {
  it('has a translation file for every supported language', () => {
    const missing = supportedCodes.filter(
      (code) => !fs.existsSync(path.join(TRANSLATIONS_DIR, `${code}.json`))
    );
    expect(missing).toEqual([]);
  });

  it('lists Hindi as a supported language', () => {
    expect(supportedCodes).toContain('hi');
  });

  it.each(translationFiles)('%s covers every key in en.json', (file) => {
    const translations = read(file);
    expect(referenceKeys.filter((key) => !(key in translations))).toEqual([]);
  });

  it.each(translationFiles)('%s preserves the placeholders of en.json', (file) => {
    const translations = read(file);
    const mismatched = referenceKeys.filter(
      (key) =>
        translations[key] &&
        placeholders(translations[key]).join(',') !== placeholders(reference[key]).join(',')
    );
    expect(mismatched).toEqual([]);
  });

  it('hi.json translates every key', () => {
    const hindi = read('hi.json');
    expect(referenceKeys.filter((key) => !hindi[key].trim())).toEqual([]);
  });
});

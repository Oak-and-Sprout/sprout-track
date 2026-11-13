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

/**
 * American spellings/terms that must not appear in en-GB values.
 * Deliberately substring-based where American forms can never appear inside the
 * British replacement (favourite never contains 'favor'); word-bounded where a
 * British word does contain the American form (catalogue > catalog, subscribe > crib).
 */
const AMERICAN_RESIDUE: RegExp[] = [
  /diaper/i,
  /stroller/i,
  /crib/i,
  /color/i,
  /gray/i,
  /favor/i,
  /customiz|organiz|recogniz|categoriz/i,
  /centimeter|milliliter/i,
  /catalog/i,
  /trash/i,
  /daycare/i,
];

/** Placeholders such as {babyName} must survive translation untouched. */
const placeholders = (value: string): string[] =>
  Array.from(value.matchAll(/\{[^}]*\}/g)).map((match) => match[0]).sort();

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

  it.each(['hi.json', 'en-gb.json'])('%s translates every key', (file) => {
    const translations = read(file);
    expect(referenceKeys.filter((key) => !translations[key].trim())).toEqual([]);
  });
});

describe('en-GB locale', () => {
  const enGB = read('en-gb.json');

  it('is registered as a supported language', () => {
    expect(supportedCodes).toContain('en-gb');
  });

  it('has no extra keys beyond en.json', () => {
    expect(Object.keys(enGB).filter((key) => !(key in reference))).toEqual([]);
  });

  it('uses regional terms for the intended value overrides', () => {
    expect(enGB['Diaper']).toBe('Nappy');
    expect(enGB['Diapers']).toBe('Nappies');
    expect(enGB['Diaper logged']).toBe('Nappy logged');
    expect(enGB['Stroller']).toBe('Pram');
    expect(enGB['Crib']).toBe('Cot');
    // Bassinet is standard Australian English and stays; this locale serves AU users too.
    expect(enGB['Bassinet']).toBe('Bassinet');
    expect(enGB['Color']).toBe('Colour');
    expect(enGB['Gray']).toBe('Grey');
    expect(enGB['unit.name.Centimeters']).toBe('Centimetres');
    expect(enGB['unit.name.Cubic Centimeters']).toBe('Cubic Centimetres');
    expect(enGB['unit.name.Milliliters']).toBe('Millilitres');
    expect(enGB['Customize Notifications']).toBe('Customise Notifications');
    expect(enGB['Trash']).toBe('Bin');
    expect(
      enGB[
        'Sprout Track speaks thirteen languages, and every caretaker picks their own. Mom logs in English, oma logs in Deutsch. Same timeline, same entries.'
      ]
    ).toBe(
      'Sprout Track speaks thirteen languages, and every caretaker picks their own. Mum logs in English, oma logs in Deutsch. Same timeline, same entries.'
    );
  });

  it('keeps American vocabulary out of translated values', () => {
    const hits: string[] = [];
    for (const key of referenceKeys) {
      for (const pattern of AMERICAN_RESIDUE) {
        if (pattern.test(enGB[key])) hits.push(`${key}: "${enGB[key]}"`);
      }
    }
    expect(hits).toEqual([]);
  });
});

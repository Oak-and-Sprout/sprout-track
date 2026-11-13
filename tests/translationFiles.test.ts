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
 Array.from(value.matchAll(/\{[^}]*\}/g)).map((match) => match[0]).sort();

/**
 * American spellings/terms that must not appear in en-GB values.
 * Deliberately substring-based where American forms can never appear inside the
 * British replacement (favourite never contains 'favor'); word-bounded where a
 * British word does contain the American form (catalogue ⊃ catalog, subscribe ⊃ crib).
 */
const AMERICAN_RESIDUE: RegExp[] = [
 /diaper/i,
 /stroller/i,
 /\bcrib\b/i,
 /color/i,
 /gray/i,
 /favor/i,
 /customiz|organiz|recogniz|categoriz/i,
 /centimeter|milliliter/i,
 /\bcatalog\b/i,
 /trash/i,
 /daycare/i,
];

describe('en-GB locale', () => {
 const enGB = read('en-gb.json');

 it('has full key parity with en.json (no missing or extra keys)', () => {
  const enGBKeys = Object.keys(enGB);
  expect(referenceKeys.filter((key) => !(key in enGB))).toEqual([]);
  expect(enGBKeys.filter((key) => !(key in reference))).toEqual([]);
 });

 it('translates every key (no empty values carried over from en)', () => {
  expect(referenceKeys.filter((key) => !enGB[key].trim())).toEqual([]);
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

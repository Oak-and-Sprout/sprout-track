import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { getSymbol, getName } from '@/src/hooks/useUnit';

// Bug seen on the Reports stats page: with no pumps in range, the pump unit
// rendered as the literal string "unit.symbol.undefined". getSymbol composed a
// translation key from a missed map lookup ('oz' vs 'OZ' — case-sensitive) and
// the t() fallback returned the composed key verbatim.

const en = JSON.parse(
  readFileSync(path.resolve(__dirname, '../src/localization/translations/en.json'), 'utf8')
) as Record<string, string>;

// Mimics the app's localization fallback: translated value, or the key itself
const t = (key: string) => en[key] || key;

describe('getSymbol', () => {
  it('resolves known abbreviations regardless of case (the "oz" default)', () => {
    expect(getSymbol('OZ', t)).toBe('oz');
    expect(getSymbol('oz', t)).toBe('oz');
    expect(getSymbol('ml', t)).toBe(en['unit.symbol.Milliliters']);
  });

  it('never leaks a composed "unit.symbol.*" key for unknown abbreviations', () => {
    expect(getSymbol('XYZ', t)).toBe('xyz');
    expect(getSymbol('XYZ', t)).not.toContain('unit.symbol');
  });

  it('handles null/undefined without composing "unit.symbol.undefined"', () => {
    expect(getSymbol(undefined, t)).toBe('');
    expect(getSymbol(null, t)).toBe('');
  });
});

describe('getName', () => {
  it('never leaks a composed "unit.name.*" key for unknown units', () => {
    expect(getName('made-up-unit', t)).toBe('made-up-unit');
    expect(getName('made-up-unit', t)).not.toContain('unit.name');
  });
});

// Regression: when the composed "unit.name.*"/"unit.symbol.*" key resolves,
// the raw fallback t() must NOT run. It used to be evaluated eagerly to build
// the fallback argument, calling t('Milliliters')/t('cm') on keys that don't
// exist and spamming dev "Translation key not found" warnings.
describe('lazy fallback', () => {
  it('does not query the raw unit name when the composed key resolves', () => {
    const seen: string[] = [];
    const spyT = (key: string) => {
      seen.push(key);
      return en[key] || key;
    };
    getName('Milliliters', spyT);
    expect(seen).toEqual(['unit.name.Milliliters']);
    expect(seen).not.toContain('Milliliters');
  });

  it('does not query the raw abbreviation when the composed symbol resolves', () => {
    const seen: string[] = [];
    const spyT = (key: string) => {
      seen.push(key);
      return en[key] || key;
    };
    getSymbol('CM', spyT);
    expect(seen).toEqual(['unit.symbol.Centimeters']);
    expect(seen).not.toContain('cm');
  });
});

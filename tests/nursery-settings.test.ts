import { describe, it, expect } from 'vitest';
import { normalizeNurserySettings, NURSERY_DEFAULTS, PALETTES } from '@/src/utils/nursery/settings';

describe('normalizeNurserySettings', () => {
  it('returns defaults for garbage input', () => {
    expect(normalizeNurserySettings(null)).toEqual(NURSERY_DEFAULTS);
    expect(normalizeNurserySettings('x')).toEqual(NURSERY_DEFAULTS);
    expect(normalizeNurserySettings({})).toEqual(NURSERY_DEFAULTS);
  });
  it('passes through a valid v1 object', () => {
    const s = { ...NURSERY_DEFAULTS, scene: 'starlit' as const, hue: 12 };
    expect(normalizeNurserySettings(s)).toEqual(s);
  });
  it('migrates legacy shape', () => {
    const out = normalizeNurserySettings({ hue: 230, brightness: 15, saturation: 25, visibleTiles: ['feed', 'sleep'] });
    expect(out.v).toBe(1);
    expect(out.hue).toBe(230);
    expect(out.dim).toBe(15);
    expect(out.sat).toBe(25);
    expect(out.acts).toEqual({ feed: true, pump: false, diaper: false, sleep: true, food: false });
    expect(out.scene).toBe('ambient');
  });
  it('defaults acts.food to false when missing from stored settings', () => {
    const out = normalizeNurserySettings({ v: 1, acts: { feed: true, pump: true, diaper: true, sleep: true } });
    expect(out.acts.food).toBe(false);
  });
  it('preserves an explicit acts.food = true', () => {
    const out = normalizeNurserySettings({ v: 1, acts: { food: true } });
    expect(out.acts.food).toBe(true);
  });
  it('clamps ranges', () => {
    const out = normalizeNurserySettings({ ...NURSERY_DEFAULTS, hue: 900, dim: -4, starlit: { density: 9999, aura: true } });
    expect(out.hue).toBe(360);
    expect(out.dim).toBe(0);
    expect(out.starlit.density).toBe(400);
  });
  it('falls back on unknown enums', () => {
    const out = normalizeNurserySettings({ ...NURSERY_DEFAULTS, scene: 'disco', layout: 'wall', iconShape: 'hex' });
    expect(out.scene).toBe('ambient');
    expect(out.layout).toBe('cards');
    expect(out.iconShape).toBe('square');
  });
  it('accepts sprite ambient patterns and rejects unknown ones', () => {
    expect(normalizeNurserySettings({ ...NURSERY_DEFAULTS, ambient: { ...NURSERY_DEFAULTS.ambient, pattern: 'sprite:teddy' } }).ambient.pattern).toBe('sprite:teddy');
    expect(normalizeNurserySettings({ ...NURSERY_DEFAULTS, ambient: { ...NURSERY_DEFAULTS.ambient, pattern: 'sprite:nope' } }).ambient.pattern).toBe('aurora');
  });
  it('repairs bad tapestry colors to palette defaults', () => {
    const out = normalizeNurserySettings({ ...NURSERY_DEFAULTS, tapestry: { ...NURSERY_DEFAULTS.tapestry, palette: 'girls', colors: ['red'] } });
    expect(out.tapestry.colors).toEqual(PALETTES.girls.colors);
  });
  it('accepts custom sleep locations, dedupes, and drops blanks', () => {
    const out = normalizeNurserySettings({ ...NURSERY_DEFAULTS, sleep: { locations: ['Bassinet', 'Bassinet', ' ', 'Nana\'s'] } });
    expect(out.sleep.locations).toEqual(['Bassinet', "Nana's"]);
  });
  it('falls back to default sleep locations when empty or invalid', () => {
    expect(normalizeNurserySettings({ ...NURSERY_DEFAULTS, sleep: { locations: [] } }).sleep.locations).toEqual(['Crib', 'Contact']);
    expect(normalizeNurserySettings({ ...NURSERY_DEFAULTS, sleep: { locations: 'Crib' } }).sleep.locations).toEqual(['Crib', 'Contact']);
    expect(normalizeNurserySettings({ ...NURSERY_DEFAULTS, sleep: {} }).sleep.locations).toEqual(['Crib', 'Contact']);
  });
});

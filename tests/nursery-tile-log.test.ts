import { describe, it, expect } from 'vitest';
import { TileEntry, formatTileEntryNote, formatTileLogs } from '@/src/utils/nursery/tileLog';

const es: Record<string, string> = {
  Today: 'Hoy', Yesterday: 'Ayer',
  Bottle: 'Biberón', Breast: 'Pecho', Left: 'Izquierdo', Right: 'Derecho', Both: 'Ambos',
  Wet: 'Mojado', Dirty: 'Sucio', Dry: 'Seco',
  Crib: 'Cuna', Sleep: 'Sueño', Stored: 'Almacenado', Food: 'Comida', Loved: 'Encantó',
};

/** Mirrors the real `t`: translated value, else the key itself. */
const t = (key: string) => es[key] ?? key;
const en = (key: string) => key;

const now = new Date(2026, 6, 31, 16, 29);

describe('formatTileLogs', () => {
  it('localizes the day prefix through the passed translator', () => {
    const entries: Record<string, TileEntry> = {
      feed: { kind: 'feed', at: new Date(2026, 6, 30, 16, 39).toISOString(), feed: { type: 'BOTTLE', amount: 4, unitAbbr: 'OZ' } },
      sleep: { kind: 'sleep', at: new Date(2026, 6, 31, 12, 50).toISOString(), location: 'Crib', durationMinutes: 1 },
    };

    const logs = formatTileLogs(entries, '12h', t, now);

    expect(logs.feed.last).toBe('Ayer, 4:39 pm');
    expect(logs.feed.note).toBe('Biberón: 4oz');
    expect(logs.sleep.last).toBe('Hoy, 12:50 pm');
    expect(logs.sleep.note).toBe('Cuna — 1 min');
  });

  it('re-formats the same entries when the language changes', () => {
    const entries: Record<string, TileEntry> = {
      diaper: { kind: 'diaper', at: new Date(2026, 6, 31, 9, 0).toISOString(), diaperType: 'WET' },
    };

    expect(formatTileLogs(entries, '24h', en, now).diaper).toEqual({ last: 'Today, 09:00', note: 'Wet' });
    expect(formatTileLogs(entries, '24h', t, now).diaper).toEqual({ last: 'Hoy, 09:00', note: 'Mojado' });
  });

  it('honors the 24h time format', () => {
    const entries: Record<string, TileEntry> = {
      pump: { kind: 'pump', at: new Date(2026, 6, 31, 14, 5).toISOString(), pump: { side: 'both', totalAmount: 3, unitAbbr: 'OZ', action: 'STORED' } },
    };

    expect(formatTileLogs(entries, '24h', t, now).pump).toEqual({ last: 'Hoy, 14:05', note: 'Ambos: 3oz — Almacenado' });
  });

  it('returns an empty map for no entries', () => {
    expect(formatTileLogs({}, '12h', t, now)).toEqual({});
  });
});

describe('formatTileEntryNote', () => {
  it('localizes a food try with its enjoyment label', () => {
    const entry: TileEntry = { kind: 'food', at: now.toISOString(), foodName: 'Banana', enjoyment: 'LOVED' };
    expect(formatTileEntryNote(entry, t)).toBe('Banana · Encantó');
  });

  it('falls back to a localized name when the food is missing, and drops an invalid enjoyment', () => {
    const entry: TileEntry = { kind: 'food', at: now.toISOString(), foodName: null, enjoyment: 'BOGUS' };
    expect(formatTileEntryNote(entry, t)).toBe('Comida');
  });

  it('leaves a custom sleep location untranslated', () => {
    const entry: TileEntry = { kind: 'sleep', at: now.toISOString(), location: 'Abuela house', durationMinutes: null };
    expect(formatTileEntryNote(entry, t)).toBe('Abuela house');
  });

  it('falls back to the raw diaper type when it is unrecognized', () => {
    const entry: TileEntry = { kind: 'diaper', at: now.toISOString(), diaperType: 'MYSTERY' };
    expect(formatTileEntryNote(entry, t)).toBe('MYSTERY');
  });

  it('passes an optimistic note through untouched', () => {
    const entry: TileEntry = { kind: 'note', at: now.toISOString(), note: 'Biberón: 3.7oz' };
    expect(formatTileEntryNote(entry, t)).toBe('Biberón: 3.7oz');
  });
});

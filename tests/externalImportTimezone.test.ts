import { describe, expect, it } from 'vitest';
import {
  externalImportDateToUtc,
  externalImportLocalTimeToUtc,
} from '../src/lib/importers/timezone';

describe('external import timezone conversion', () => {
  it('converts Copenhagen winter time to UTC', () => {
    expect(
      externalImportLocalTimeToUtc(
        '2026-01-15T10:00:00',
        'Europe/Copenhagen',
      ).toISOString(),
    ).toBe('2026-01-15T09:00:00.000Z');
  });

  it('converts Copenhagen summer time to UTC', () => {
    expect(
      externalImportLocalTimeToUtc(
        '2026-07-15T10:00:00',
        'Europe/Copenhagen',
      ).toISOString(),
    ).toBe('2026-07-15T08:00:00.000Z');
  });

  it('preserves UTC input when UTC is selected', () => {
    expect(
      externalImportLocalTimeToUtc(
        '2026-07-15T10:00:00',
        'UTC',
      ).toISOString(),
    ).toBe('2026-07-15T10:00:00.000Z');
  });

  it('converts a date-only value to UTC midnight', () => {
    expect(
      externalImportDateToUtc('2026-01-15').toISOString(),
    ).toBe('2026-01-15T00:00:00.000Z');
  });

  it('rejects a missing timezone', () => {
    expect(() =>
      externalImportLocalTimeToUtc(
        '2026-01-15T10:00:00',
        '',
      ),
    ).toThrow('Source timezone is required');
  });

  it('rejects an invalid timezone', () => {
    expect(() =>
      externalImportLocalTimeToUtc(
        '2026-01-15T10:00:00',
        'Not/A-Timezone',
      ),
    ).toThrow('Invalid source timezone');
  });

  it('rejects an invalid local date-time', () => {
    expect(() =>
      externalImportLocalTimeToUtc(
        'not-a-date',
        'Europe/Copenhagen',
      ),
    ).toThrow('Invalid external import date-time');
  });
});

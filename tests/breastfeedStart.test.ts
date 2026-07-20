import { describe, it, expect } from 'vitest';
import { resolveClientStartTime } from '@/src/utils/breastfeedStart';

describe('resolveClientStartTime', () => {
  const dt = new Date('2026-07-19T14:30:00.000Z');

  it('returns the selected time when the user touched the picker', () => {
    expect(resolveClientStartTime(true, dt)).toBe(dt);
  });

  it('returns undefined when the user did not touch the picker', () => {
    expect(resolveClientStartTime(false, dt)).toBeUndefined();
  });

  it('returns undefined when there is no selected time, even if touched', () => {
    expect(resolveClientStartTime(true, null)).toBeUndefined();
    expect(resolveClientStartTime(true, undefined)).toBeUndefined();
  });
});

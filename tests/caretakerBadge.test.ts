import { describe, it, expect } from 'vitest';
import {
  CARETAKER_BADGE_COLORS,
  getBadgeColorOption,
  isValidBadgeColorId,
  getBadgeTextColor,
  resolveCaretakerBadge,
} from '@/src/constants/caretakerBadge';

describe('caretaker badge palette', () => {
  it('exposes exactly 15 unique color ids', () => {
    expect(CARETAKER_BADGE_COLORS).toHaveLength(15);
    const ids = new Set(CARETAKER_BADGE_COLORS.map((c) => c.id));
    expect(ids.size).toBe(15);
  });

  it('validates known ids and rejects unknown / non-string', () => {
    expect(isValidBadgeColorId('teal')).toBe(true);
    expect(isValidBadgeColorId('mauve')).toBe(false);
    expect(isValidBadgeColorId(null)).toBe(false);
    expect(isValidBadgeColorId(undefined)).toBe(false);
    expect(isValidBadgeColorId(42)).toBe(false);
  });

  it('resolves ids to swatches, null for unset/unknown', () => {
    expect(getBadgeColorOption('teal')?.hex).toBe('#14b8a6');
    expect(getBadgeColorOption(null)).toBeNull();
    expect(getBadgeColorOption('nope')).toBeNull();
  });
});

describe('getBadgeTextColor (best contrast)', () => {
  it('uses white on pure black and dark on pure white', () => {
    expect(getBadgeTextColor('#000000')).toBe('#ffffff');
    expect(getBadgeTextColor('#ffffff')).toBe('#111827');
  });

  it('uses dark text on light/bright colors', () => {
    expect(getBadgeTextColor('#eab308')).toBe('#111827'); // yellow
    expect(getBadgeTextColor('#84cc16')).toBe('#111827'); // lime
    expect(getBadgeTextColor('#f59e0b')).toBe('#111827'); // amber
  });

  // WCAG relative luminance, recomputed independently, to assert the invariant:
  // the returned text color must be the higher-contrast of black vs white.
  const luminance = (hex: string) => {
    const int = parseInt(hex.slice(1), 16);
    const chan = [(int >> 16) & 255, (int >> 8) & 255, int & 255].map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
  };
  const contrast = (a: number, b: number) =>
    (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

  it('always picks the maximum-contrast text color for every palette color', () => {
    const lDark = luminance('#111827');
    for (const { id, hex } of CARETAKER_BADGE_COLORS) {
      const lBg = luminance(hex);
      const expected = contrast(lBg, lDark) >= contrast(lBg, 1) ? '#111827' : '#ffffff';
      expect(getBadgeTextColor(hex), `color ${id}`).toBe(expected);
    }
  });

  it('falls back to dark text for malformed hex', () => {
    expect(getBadgeTextColor('not-a-color')).toBe('#111827');
  });
});

describe('resolveCaretakerBadge', () => {
  it('hides the system caretaker (loginId "00")', () => {
    expect(
      resolveCaretakerBadge({ name: 'System', loginId: '00', badgeColor: 'teal' })
    ).toBeNull();
  });

  it('hides when there is no name', () => {
    expect(resolveCaretakerBadge({ name: '  ', loginId: '01' })).toBeNull();
    expect(resolveCaretakerBadge(null)).toBeNull();
    expect(resolveCaretakerBadge(undefined)).toBeNull();
  });

  it('returns name + resolved color for a real caretaker', () => {
    expect(
      resolveCaretakerBadge({ name: 'Alex', loginId: '01', badgeColor: 'teal' })
    ).toEqual({ name: 'Alex', colorId: 'teal' });
  });

  it('drops an unknown color to null but keeps the name', () => {
    expect(
      resolveCaretakerBadge({ name: 'Sam', loginId: '02', badgeColor: 'chartreuse' })
    ).toEqual({ name: 'Sam', colorId: null });
  });
});

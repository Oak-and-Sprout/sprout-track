import { describe, it, expect } from 'vitest';
import {
  getSubscriptionView,
  genderChip,
  caretakerChips,
  nudgeShort,
} from '@/src/utils/accountPresentation';

const NOW = new Date('2026-07-17T12:00:00Z');

describe('getSubscriptionView', () => {
  it('maps lifetime plan regardless of accountStatus', () => {
    expect(
      getSubscriptionView({ accountStatus: 'active', planType: 'full' }, NOW)
    ).toEqual({ kind: 'lifetime' });
  });

  it('maps trial with days left rounded up', () => {
    const view = getSubscriptionView(
      { accountStatus: 'trial', trialEnds: '2026-07-20T18:00:00Z' },
      NOW
    );
    expect(view.kind).toBe('trial');
    if (view.kind === 'trial') {
      expect(view.daysLeft).toBe(4); // 3.25 days -> ceil 4
      expect(view.endDate).toEqual(new Date('2026-07-20T18:00:00Z'));
    }
  });

  it('clamps trial daysLeft at 0 when trialEnds is past', () => {
    const view = getSubscriptionView(
      { accountStatus: 'trial', trialEnds: '2026-07-01T00:00:00Z' },
      NOW
    );
    expect(view).toMatchObject({ kind: 'trial', daysLeft: 0 });
  });

  it('maps trial with no trialEnds to 0 days and null endDate', () => {
    expect(getSubscriptionView({ accountStatus: 'trial' }, NOW)).toEqual({
      kind: 'trial',
      daysLeft: 0,
      endDate: null,
    });
  });

  it('maps active with cancelAtPeriodEnd and planExpires', () => {
    expect(
      getSubscriptionView(
        {
          accountStatus: 'active',
          planType: 'sub',
          planExpires: '2026-08-01T00:00:00Z',
          cancelAtPeriodEnd: true,
        },
        NOW
      )
    ).toEqual({
      kind: 'active',
      cancelAtPeriodEnd: true,
      endDate: new Date('2026-08-01T00:00:00Z'),
    });
  });

  it('maps expired', () => {
    expect(getSubscriptionView({ accountStatus: 'expired' }, NOW)).toEqual({
      kind: 'expired',
    });
  });

  it('maps anything else (inactive, no_family, closed) to none', () => {
    expect(getSubscriptionView({ accountStatus: 'no_family' }, NOW)).toEqual({
      kind: 'none',
    });
  });
});

describe('genderChip', () => {
  it('maps MALE to Boy and FEMALE to Girl (sentence case, blue)', () => {
    expect(genderChip('MALE')).toEqual({ label: 'Boy', variant: 'blue' });
    expect(genderChip('FEMALE')).toEqual({ label: 'Girl', variant: 'blue' });
  });
  it('returns null for missing/unknown gender', () => {
    expect(genderChip(undefined)).toBeNull();
    expect(genderChip(null)).toBeNull();
    expect(genderChip('')).toBeNull();
    expect(genderChip('OTHER')).toBeNull();
  });
});

describe('caretakerChips', () => {
  it('maps ADMIN to Admin (teal), other roles to User (blue)', () => {
    expect(caretakerChips('ADMIN', false)).toEqual([
      { label: 'Admin', variant: 'teal' },
    ]);
    expect(caretakerChips('USER', false)).toEqual([
      { label: 'User', variant: 'blue' },
    ]);
  });
  it('appends Inactive (red) only when inactive — active state is implied', () => {
    expect(caretakerChips('ADMIN', true)).toEqual([
      { label: 'Admin', variant: 'teal' },
      { label: 'Inactive', variant: 'red' },
    ]);
  });
});

describe('nudgeShort', () => {
  it('formats whole hours', () => {
    expect(nudgeShort('03:00')).toBe('3h');
  });
  it('formats hours and minutes', () => {
    expect(nudgeShort('02:30')).toBe('2h 30m');
  });
  it('formats minutes only', () => {
    expect(nudgeShort('00:45')).toBe('45m');
  });
  it('returns empty string for invalid input', () => {
    expect(nudgeShort('')).toBe('');
    expect(nudgeShort('abc')).toBe('');
    expect(nudgeShort('3')).toBe('');
  });
});

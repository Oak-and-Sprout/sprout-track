import { describe, it, expect } from 'vitest';
import { backfillNotificationPreferenceOwners } from '@/app/api/utils/db-backup';

describe('backfillNotificationPreferenceOwners', () => {
  it('backfills familyId/caretakerId/accountId from the matching PushSubscription for a pre-migration row', () => {
    const rows = [
      // Pre-migration shape: no caretakerId/accountId/familyId columns at all.
      { id: 'pref1', subscriptionId: 'sub1', babyId: 'baby1', eventType: 'ACTIVITY_CREATED' },
    ];
    const subscriptionOwners = new Map([
      ['sub1', { familyId: 'fam1', caretakerId: 'care1', accountId: null }],
    ]);

    const result = backfillNotificationPreferenceOwners(rows, subscriptionOwners);

    expect(result).toEqual([
      {
        id: 'pref1',
        subscriptionId: 'sub1',
        babyId: 'baby1',
        eventType: 'ACTIVITY_CREATED',
        familyId: 'fam1',
        caretakerId: 'care1',
        accountId: null,
      },
    ]);
  });

  it('leaves a row untouched if it already has a familyId (a post-migration backup)', () => {
    const rows = [
      { id: 'pref1', subscriptionId: 'sub1', babyId: 'baby1', eventType: 'ACTIVITY_CREATED', familyId: 'fam1', caretakerId: 'care1', accountId: null },
    ];
    const subscriptionOwners = new Map([
      ['sub1', { familyId: 'other-fam', caretakerId: 'other-care', accountId: null }],
    ]);

    const result = backfillNotificationPreferenceOwners(rows, subscriptionOwners);

    // Must not be overwritten by a subscription that has since changed owner.
    expect(result[0].familyId).toBe('fam1');
    expect(result[0].caretakerId).toBe('care1');
  });

  it('preserves the row (doesn\'t drop it) when its subscription is missing from the lookup — a genuinely dangling reference', () => {
    const rows = [
      { id: 'pref1', subscriptionId: 'sub-missing', babyId: 'baby1', eventType: 'ACTIVITY_CREATED' },
    ];

    const result = backfillNotificationPreferenceOwners(rows, new Map());

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(rows[0]);
  });

  it('preserves a native-only row shape unchanged (no subscriptionId to look up)', () => {
    const rows = [
      { id: 'pref1', subscriptionId: null, babyId: 'baby1', eventType: 'ACTIVITY_CREATED', familyId: 'fam1', caretakerId: 'care1', accountId: null },
    ];

    const result = backfillNotificationPreferenceOwners(rows, new Map());

    expect(result).toEqual(rows);
  });
});

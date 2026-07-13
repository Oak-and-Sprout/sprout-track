import { describe, expect, it } from 'vitest';
import {
  collectBabyBuddyWarnings,
} from '../src/lib/importers/baby-buddy';

describe('Baby Buddy import warnings', () => {
  it('reports unsupported birth times', () => {
    const warnings = collectBabyBuddyWarnings([
      {
        name: 'Child.csv',
        content: [
          'id,first_name,last_name,birth_date,birth_time',
          '1,Test,Child,2026-01-01,12:30:00',
        ].join('\n'),
      },
    ]);

    expect(warnings).toContainEqual({
      code: 'birth-time-unsupported',
      entityType: 'child',
      affectedRows: 1,
    });
  });

  it('reports both-breast and direct-breast amount handling', () => {
    const warnings = collectBabyBuddyWarnings([
      {
        name: 'Feeding.csv',
        content: [
          'id,child_id,start,end,type,method,amount,notes,tags',
          '1,1,2026-01-01 10:00:00,2026-01-01 10:30:00,breast milk,both breasts,,,',
          '2,1,2026-01-01 11:00:00,2026-01-01 11:30:00,breast milk,right breast,10,,',
        ].join('\n'),
      },
    ]);

    expect(warnings).toContainEqual({
      code: 'both-breasts-without-side',
      entityType: 'feeding',
      affectedRows: 1,
    });

    expect(warnings).toContainEqual({
      code: 'breast-feed-amount-unsupported',
      entityType: 'feeding',
      affectedRows: 1,
    });
  });

  it('reports populated unsupported tags', () => {
    const warnings = collectBabyBuddyWarnings([
      {
        name: 'Sleep.csv',
        content: [
          'id,child_id,start,end,nap,notes,tags',
          '1,1,2026-01-01 10:00:00,2026-01-01 11:00:00,1,,important',
        ].join('\n'),
      },
    ]);

    expect(warnings).toContainEqual({
      code: 'tags-unsupported',
      entityType: 'sleep',
      affectedRows: 1,
    });
  });

  it('reports unsupported BMI records', () => {
    const warnings = collectBabyBuddyWarnings([
      {
        name: 'BMI.csv',
        content: [
          'id,child_id,bmi,date,notes,tags',
          '1,1,16.2,2026-01-01,,',
          '2,1,16.4,2026-01-08,,',
        ].join('\n'),
      },
    ]);

    expect(warnings).toContainEqual({
      code: 'bmi-unsupported',
      entityType: 'bmi',
      affectedRows: 2,
    });
  });

  it('reports WET-only colours without affecting valid colours', () => {
    const warnings = collectBabyBuddyWarnings([
      {
        name: 'DiaperChange.csv',
        content: [
          'id,child_id,time,wet,solid,color,amount,notes,tags',
          '1,1,2026-01-01 10:00:00,1,0,yellow,,,',
          '2,1,2026-01-01 11:00:00,1,1,green,,,',
        ].join('\n'),
      },
    ]);

    expect(warnings).toContainEqual({
      code: 'wet-diaper-colour-unsupported',
      entityType: 'diaper-change',
      affectedRows: 1,
    });
  });

  it('does not produce warnings for blank unsupported fields', () => {
    const warnings = collectBabyBuddyWarnings([
      {
        name: 'Sleep.csv',
        content:
          'id,child_id,start,end,nap,notes,tags\n',
      },
    ]);

    expect(warnings).toEqual([]);
  });
});

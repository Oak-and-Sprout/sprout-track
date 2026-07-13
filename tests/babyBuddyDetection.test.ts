import { describe, expect, it } from 'vitest';
import { babyBuddyDetector } from '../src/lib/importers/baby-buddy';

describe('Baby Buddy CSV detection', () => {
  it.each([
    [
      'Child-2026-07-13.csv',
      'id,first_name,last_name,birth_date,birth_time\n',
      'child',
    ],
    [
      'Feeding-2026-07-13.csv',
      [
        'id',
        'child_id',
        'child_first_name',
        'child_last_name',
        'start',
        'end',
        'type',
        'method',
        'amount',
        'notes',
        'tags',
      ].join(','),
      'feeding',
    ],
    [
      'Sleep-2026-07-13.csv',
      'id,child_id,start,end,nap,notes,tags\n',
      'sleep',
    ],
    [
      'DiaperChange-2026-07-13.csv',
      'id,child_id,time,wet,solid,color,amount,notes,tags\n',
      'diaper-change',
    ],
    [
      'Weight-2026-07-13.csv',
      'id,child_id,weight,date,notes,tags\n',
      'weight',
    ],
  ])(
    'detects %s',
    (name, content, expectedEntityType) => {
      const [result] = babyBuddyDetector.detectFiles([
        { name, content },
      ]);

      expect(result.status).toBe('detected');
      expect(result.entityType).toBe(expectedEntityType);
    },
  );

  it('detects a header regardless of column order', () => {
    const [result] = babyBuddyDetector.detectFiles([
      {
        name: 'children.csv',
        content:
          '\uFEFFbirth_date,last_name,id,first_name,birth_time\n',
      },
    ]);

    expect(result.status).toBe('detected');
    expect(result.entityType).toBe('child');
  });

  it('reports unknown CSV headers as unsupported', () => {
    const [result] = babyBuddyDetector.detectFiles([
      {
        name: 'unknown.csv',
        content: 'id,unknown_field\n',
      },
    ]);

    expect(result.status).toBe('unsupported');
    expect(result.entityType).toBeUndefined();
  });

  it('reports non-CSV files as unsupported', () => {
    const [result] = babyBuddyDetector.detectFiles([
      {
        name: 'children.json',
        content: '[]',
      },
    ]);

    expect(result.status).toBe('unsupported');
    expect(result.error).toBe('Only CSV files are supported');
  });

  it('reports an empty CSV as invalid', () => {
    const [result] = babyBuddyDetector.detectFiles([
      {
        name: 'empty.csv',
        content: '',
      },
    ]);

    expect(result.status).toBe('invalid');
  });
});

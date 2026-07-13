import { describe, expect, it } from 'vitest';
import { parseBabyBuddyCsv } from '../src/lib/importers/baby-buddy';

describe('Baby Buddy CSV parser', () => {
  it('parses headers and rows', () => {
    const result = parseBabyBuddyCsv(
      [
        'id,child_id,start,end,nap,notes,tags',
        '1,4,2026-07-13 10:00:00,2026-07-13 11:00:00,1,,',
        '2,4,2026-07-13 20:00:00,2026-07-13 21:00:00,0,,',
      ].join('\n'),
    );

    expect(result.headers).toEqual([
      'id',
      'child_id',
      'start',
      'end',
      'nap',
      'notes',
      'tags',
    ]);

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({
      id: '1',
      child_id: '4',
      start: '2026-07-13 10:00:00',
      end: '2026-07-13 11:00:00',
      nap: '1',
      notes: '',
      tags: '',
    });
  });

  it('preserves quoted commas and line breaks', () => {
    const result = parseBabyBuddyCsv(
      [
        'id,child_id,note,time,tags',
        '1,4,"Contains, a comma",2026-07-13 10:00:00,',
        '2,4,"Contains',
        'a line break",2026-07-13 11:00:00,',
      ].join('\n'),
    );

    expect(result.rows[0].note).toBe('Contains, a comma');
    expect(result.rows[1].note).toBe('Contains\na line break');
  });

  it('removes a UTF-8 byte order mark', () => {
    const result = parseBabyBuddyCsv(
      '\uFEFFid,first_name,last_name,birth_date\n1,Test,Child,2026-01-01\n',
    );

    expect(result.headers[0]).toBe('id');
  });

  it('returns headers for an export containing no rows', () => {
    const result = parseBabyBuddyCsv(
      'id,child_id,start,end,amount,notes,tags\n',
    );

    expect(result.headers).toEqual([
      'id',
      'child_id',
      'start',
      'end',
      'amount',
      'notes',
      'tags',
    ]);
    expect(result.rows).toEqual([]);
  });

  it('rejects rows with an inconsistent number of columns', () => {
    expect(() =>
      parseBabyBuddyCsv(
        [
          'id,first_name,last_name,birth_date',
          '1,Only,Three',
        ].join('\n'),
      ),
    ).toThrow();
  });

  it('rejects a file without a header row', () => {
    expect(() => parseBabyBuddyCsv('')).toThrow(
      'CSV file does not contain a header row',
    );
  });
});

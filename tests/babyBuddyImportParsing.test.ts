import { describe, expect, it } from 'vitest';

import { parseBabyBuddyCsv } from '../src/lib/importers/baby-buddy';
import { babyBuddyDetector } from '../src/lib/importers/baby-buddy';
import {
  analyseBabyBuddyFiles,
} from '../src/lib/importers/baby-buddy';
import {
  collectBabyBuddyWarnings,
} from '../src/lib/importers/baby-buddy';

{
// Consolidated from tests/babyBuddyCsvParser.test.ts
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

}


{
// Consolidated from tests/babyBuddyDetection.test.ts
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

}


{
// Consolidated from tests/babyBuddyAnalysis.test.ts
describe('Baby Buddy import analysis', () => {
  it('extracts children without interpreting personal fields', () => {
    const analysis = analyseBabyBuddyFiles([
      {
        name: 'Child.csv',
        content: [
          'id,first_name,last_name,birth_date,birth_time',
          '7,Test,Child,2026-01-01,12:30:00',
        ].join('\n'),
      },
    ]);

    expect(analysis.children).toEqual([
      {
        sourceId: '7',
        firstName: 'Test',
        lastName: 'Child',
        birthDate: '2026-01-01',
        birthTime: '12:30:00',
      },
    ]);
  });

  it('requires a feeding unit only when amounts exist', () => {
    const analysis = analyseBabyBuddyFiles([
      {
        name: 'Feeding.csv',
        content: [
          [
            'id',
            'child_id',
            'start',
            'end',
            'type',
            'method',
            'amount',
            'notes',
            'tags',
          ].join(','),
          '1,7,2026-01-01 10:00:00,2026-01-01 10:30:00,breast milk,bottle,100,,',
          '2,7,2026-01-01 11:00:00,2026-01-01 11:30:00,breast milk,both breasts,,,',
        ].join('\n'),
      },
    ]);

    expect(analysis.unitRequirements).toEqual([
      {
        entityType: 'feeding',
        populatedRows: 1,
        allowedUnits: ['ML', 'OZ', 'SKIP'],
        optional: true,
      },
    ]);
  });

  it('does not request a feeding unit for blank amounts', () => {
    const analysis = analyseBabyBuddyFiles([
      {
        name: 'Feeding.csv',
        content: [
          'id,child_id,start,end,type,method,amount,notes,tags',
          '1,7,2026-01-01 10:00:00,2026-01-01 10:30:00,breast milk,both breasts,,,',
        ].join('\n'),
      },
    ]);

    expect(analysis.unitRequirements).toEqual([]);
  });

  it('requests measurement units for populated exports', () => {
    const analysis = analyseBabyBuddyFiles([
      {
        name: 'Height.csv',
        content: [
          'id,child_id,height,date,notes,tags',
          '1,7,50.5,2026-01-01,,',
          '2,7,51.0,2026-01-08,,',
        ].join('\n'),
      },
      {
        name: 'Temperature.csv',
        content: [
          'id,child_id,temperature,time,notes,tags',
          '1,7,37.2,2026-01-01 10:00:00,,',
        ].join('\n'),
      },
    ]);

    expect(analysis.unitRequirements).toEqual([
      {
        entityType: 'height',
        populatedRows: 2,
        allowedUnits: ['cm', 'in'],
        optional: false,
      },
      {
        entityType: 'temperature',
        populatedRows: 1,
        allowedUnits: ['°C', '°F'],
        optional: false,
      },
    ]);
  });

  it('ignores unsupported and invalid files', () => {
    const analysis = analyseBabyBuddyFiles([
      {
        name: 'unknown.csv',
        content: 'id,unknown\n1,value\n',
      },
      {
        name: 'children.json',
        content: '[]',
      },
    ]);

    expect(analysis).toEqual({
      children: [],
      unitRequirements: [],
    });
  });

  it('requires a feeding unit only for bottle amounts', () => {
    const details = analyseBabyBuddyFiles([
      {
        name: 'Feeding.csv',
        content: [
          'id,child_id,start,end,type,method,amount,notes,tags',
          '1,7,2026-01-02 10:00:00,2026-01-02 10:10:00,solid food,parent fed,100,,',
          '2,7,2026-01-02 11:00:00,2026-01-02 11:10:00,breast milk,bottle,,,',
        ].join('\\n'),
      },
    ]);

    expect(
      details.unitRequirements.find(
        requirement =>
          requirement.entityType === 'feeding',
      ),
    ).toBeUndefined();
  });

});

}


{
// Consolidated from tests/babyBuddyWarnings.test.ts
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

}

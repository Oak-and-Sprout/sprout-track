import { describe, expect, it } from 'vitest';
import {
  analyseBabyBuddyFiles,
} from '../src/lib/importers/baby-buddy';

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

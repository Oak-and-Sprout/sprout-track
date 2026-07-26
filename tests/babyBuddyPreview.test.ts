import { describe, expect, it } from 'vitest';
import { babyBuddyPreviewer } from '../src/lib/importers/baby-buddy';

describe('Baby Buddy import preview', () => {
  it('returns detected files and total row count', () => {
    const preview = babyBuddyPreviewer.previewFiles([
      {
        name: 'Child.csv',
        content: [
          'id,first_name,last_name,birth_date,birth_time',
          '1,Test,Child,2026-01-01,12:00:00',
        ].join('\n'),
      },
      {
        name: 'Sleep.csv',
        content: [
          'id,child_id,start,end,nap,notes,tags',
          '1,1,2026-01-02 10:00:00,2026-01-02 11:00:00,1,,',
          '2,1,2026-01-02 20:00:00,2026-01-02 22:00:00,0,,',
        ].join('\n'),
      },
    ]);

    expect(preview.providerId).toBe('baby-buddy');
    expect(preview.totalRows).toBe(3);
    expect(preview.ready).toBe(true);
    expect(preview.files).toEqual([
      expect.objectContaining({
        fileName: 'Child.csv',
        entityType: 'child',
        rowCount: 1,
        status: 'detected',
      }),
      expect.objectContaining({
        fileName: 'Sleep.csv',
        entityType: 'sleep',
        rowCount: 2,
        status: 'detected',
      }),
    ]);
  });

  it('supports empty Baby Buddy exports', () => {
    const preview = babyBuddyPreviewer.previewFiles([
      {
        name: 'Pumping.csv',
        content:
          'id,child_id,start,end,amount,notes,tags\n',
      },
    ]);

    expect(preview.ready).toBe(true);
    expect(preview.totalRows).toBe(0);
    expect(preview.files[0].rowCount).toBe(0);
    expect(preview.files[0].entityType).toBe('pumping');
  });

  it('is not ready when a file is unsupported', () => {
    const preview = babyBuddyPreviewer.previewFiles([
      {
        name: 'unknown.csv',
        content: 'id,unknown\n1,value\n',
      },
    ]);

    expect(preview.ready).toBe(false);
    expect(preview.totalRows).toBe(0);
    expect(preview.files[0].status).toBe('unsupported');
  });

  it('is not ready when a detected file contains malformed rows', () => {
    const preview = babyBuddyPreviewer.previewFiles([
      {
        name: 'Child.csv',
        content: [
          'id,first_name,last_name,birth_date,birth_time',
          '1,Missing,Columns',
        ].join('\n'),
      },
    ]);

    expect(preview.ready).toBe(false);
    expect(preview.files[0].status).toBe('invalid');
    expect(preview.files[0].entityType).toBe('child');
  });

  it('warns when multiple exports represent the same entity', () => {
    const preview = babyBuddyPreviewer.previewFiles([
      {
        name: 'Sleep-1.csv',
        content:
          'id,child_id,start,end,nap,notes,tags\n',
      },
      {
        name: 'Sleep-2.csv',
        content:
          'id,child_id,start,end,nap,notes,tags\n',
      },
    ]);

    expect(preview.ready).toBe(true);
    expect(preview.warnings).toEqual([
      'Multiple sleep exports were uploaded',
    ]);
  });

  it('is not ready without files', () => {
    const preview = babyBuddyPreviewer.previewFiles([]);

    expect(preview.ready).toBe(false);
    expect(preview.totalRows).toBe(0);
    expect(preview.files).toEqual([]);
  });
});

import { describe, it, expect } from 'vitest';
import {
  validatePhotoFile,
  mbToBytes,
  getEffectiveQuotaMb,
  isOverQuota,
  resolveTakenAt,
  isPurgeEligible,
  trashDaysRemaining,
  getVisibleThumbnails,
  formatQuotaLabel,
  countUniquePhotoIds,
  filterTaggableMilestones,
  MAX_PHOTO_FILE_SIZE,
  TRASH_RETENTION_DAYS,
} from '@/src/utils/photoUtils';

describe('validatePhotoFile', () => {
  it('accepts a normal jpeg', () => {
    expect(validatePhotoFile({ mimeType: 'image/jpeg', fileSize: 500_000 }).valid).toBe(true);
  });
  it('accepts uppercase mime and heic', () => {
    expect(validatePhotoFile({ mimeType: 'IMAGE/HEIC', fileSize: 1 }).valid).toBe(true);
  });
  it('rejects non-image mime with error', () => {
    const r = validatePhotoFile({ mimeType: 'application/pdf', fileSize: 1 });
    expect(r.valid).toBe(false);
    expect(r.error).toBeTruthy();
  });
  it('rejects oversize at exactly one byte over the cap', () => {
    expect(validatePhotoFile({ mimeType: 'image/png', fileSize: MAX_PHOTO_FILE_SIZE + 1 }).valid).toBe(false);
  });
  it('accepts a file exactly at the cap', () => {
    expect(validatePhotoFile({ mimeType: 'image/png', fileSize: MAX_PHOTO_FILE_SIZE }).valid).toBe(true);
  });
});

describe('quota math', () => {
  it('mbToBytes converts', () => {
    expect(mbToBytes(5)).toBe(5 * 1024 * 1024);
  });
  it('family override wins over default', () => {
    expect(getEffectiveQuotaMb(1024, 5120)).toBe(1024);
  });
  it('null and undefined fall back to default', () => {
    expect(getEffectiveQuotaMb(null, 5120)).toBe(5120);
    expect(getEffectiveQuotaMb(undefined, 5120)).toBe(5120);
  });
  it('isOverQuota is false when exactly filling the quota', () => {
    expect(isOverQuota(900, 100, 1000)).toBe(false);
  });
  it('isOverQuota is true one byte over', () => {
    expect(isOverQuota(900, 101, 1000)).toBe(true);
  });
  it('formatQuotaLabel computes percent and GB strings', () => {
    const r = formatQuotaLabel(mbToBytes(2458), mbToBytes(5120));
    expect(r.percent).toBe(48);
    expect(r.usedGb).toBe('2.4');
    expect(r.totalGb).toBe('5');
  });
});

describe('resolveTakenAt (user > EXIF > fallback)', () => {
  const exif = new Date('2026-07-01T10:00:00Z');
  const fallback = new Date('2026-07-13T08:00:00Z');
  it('user-supplied wins', () => {
    expect(resolveTakenAt('2026-07-05T09:00:00Z', exif, fallback).toISOString()).toBe('2026-07-05T09:00:00.000Z');
  });
  it('EXIF wins when no user value', () => {
    expect(resolveTakenAt(null, exif, fallback)).toEqual(exif);
    expect(resolveTakenAt('', exif, fallback)).toEqual(exif);
  });
  it('falls back to now when neither', () => {
    expect(resolveTakenAt(undefined, null, fallback)).toEqual(fallback);
  });
  it('invalid user date string falls through to EXIF', () => {
    expect(resolveTakenAt('not-a-date', exif, fallback)).toEqual(exif);
  });
});

describe('trash lifecycle', () => {
  const now = new Date('2026-07-31T12:00:00Z');
  it('not eligible when deletedAt is null', () => {
    expect(isPurgeEligible(null, now)).toBe(false);
  });
  it('not eligible before 30 days', () => {
    expect(isPurgeEligible(new Date('2026-07-02T12:00:00Z'), now)).toBe(false);
  });
  it('eligible at exactly 30 days', () => {
    expect(isPurgeEligible(new Date('2026-07-01T12:00:00Z'), now)).toBe(true);
  });
  it('accepts ISO strings', () => {
    expect(isPurgeEligible('2026-06-01T00:00:00Z', now)).toBe(true);
  });
  it('daysRemaining counts up-days, floor 0', () => {
    expect(trashDaysRemaining(new Date('2026-07-30T11:00:00Z'), now)).toBe(29);
    expect(trashDaysRemaining(new Date('2026-06-01T00:00:00Z'), now)).toBe(0);
  });
  it('retention is 30 days', () => {
    expect(TRASH_RETENTION_DAYS).toBe(30);
  });
});

describe('getVisibleThumbnails', () => {
  const ph = ['a', 'b', 'c', 'd'];
  it('no overflow when all fit', () => {
    expect(getVisibleThumbnails(ph.slice(0, 2), 3)).toEqual({ visible: ['a', 'b'], overflow: 0 });
  });
  it('desktop: 3 visible, +N badge replaces nothing extra', () => {
    expect(getVisibleThumbnails(ph, 3)).toEqual({ visible: ['a', 'b', 'c'], overflow: 1 });
  });
  it('mobile: 2 visible', () => {
    expect(getVisibleThumbnails(ph, 2)).toEqual({ visible: ['a', 'b'], overflow: 2 });
  });
  it('empty input', () => {
    expect(getVisibleThumbnails([], 3)).toEqual({ visible: [], overflow: 0 });
  });
});

describe('countUniquePhotoIds', () => {
  it('counts photos across multiple items with no overlap', () => {
    const items = [{ photos: [{ id: 'a' }, { id: 'b' }] }, { photos: [{ id: 'c' }] }];
    expect(countUniquePhotoIds(items)).toBe(3);
  });
  it('dedupes a photo shared by a standalone photo-log entry and an attached activity', () => {
    const items = [{ photos: [{ id: 'a' }] }, { photos: [{ id: 'a' }, { id: 'b' }] }];
    expect(countUniquePhotoIds(items)).toBe(2);
  });
  it('ignores items with no photos field', () => {
    const items = [{}, { photos: [{ id: 'a' }] }, { photos: undefined }];
    expect(countUniquePhotoIds(items)).toBe(1);
  });
  it('empty list returns 0', () => {
    expect(countUniquePhotoIds([])).toBe(0);
  });
});

describe('filterTaggableMilestones', () => {
  const now = new Date('2026-07-13T12:00:00Z');
  const ms = (id: string, date: string) => ({ id, date });

  it('keeps milestones within ±10 days of now', () => {
    const list = [ms('past', '2026-07-04T12:00:00Z'), ms('today', '2026-07-13T08:00:00Z'), ms('future', '2026-07-22T12:00:00Z')];
    expect(filterTaggableMilestones(list, now).map((m) => m.id)).toEqual(['past', 'today', 'future']);
  });
  it('drops milestones outside the window on both sides', () => {
    const list = [ms('too-old', '2026-06-01T00:00:00Z'), ms('in', '2026-07-10T00:00:00Z'), ms('too-far', '2026-08-15T00:00:00Z')];
    expect(filterTaggableMilestones(list, now).map((m) => m.id)).toEqual(['in']);
  });
  it('exact boundary (10 days) is included', () => {
    expect(filterTaggableMilestones([ms('edge', '2026-07-03T12:00:00Z')], now)).toHaveLength(1);
    expect(filterTaggableMilestones([ms('edge', '2026-07-23T12:00:00Z')], now)).toHaveLength(1);
  });
  it('always keeps the already-selected milestone even outside the window', () => {
    const list = [ms('old-tag', '2025-01-01T00:00:00Z'), ms('other-old', '2025-01-02T00:00:00Z')];
    expect(filterTaggableMilestones(list, now, 'old-tag').map((m) => m.id)).toEqual(['old-tag']);
  });
  it('drops milestones with invalid dates', () => {
    expect(filterTaggableMilestones([ms('bad', 'not-a-date')], now)).toHaveLength(0);
  });
  it('respects a custom window', () => {
    const list = [ms('near', '2026-07-12T12:00:00Z'), ms('far', '2026-07-16T12:00:00Z')];
    expect(filterTaggableMilestones(list, now, undefined, 2).map((m) => m.id)).toEqual(['near']);
  });
  it('empty input returns empty', () => {
    expect(filterTaggableMilestones([], now)).toEqual([]);
  });
});

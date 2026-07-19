import { describe, it, expect } from 'vitest';
import { buildLinkTargets, groupPhotoLinks, photoLogHasLivePhotos, PhotoLinkRow } from '@/app/api/timeline/timeline-photo-links';

describe('buildLinkTargets', () => {
  it('filters out types with empty id lists', () => {
    const targets = buildLinkTargets({
      feed: ['f1', 'f2'],
      bath: [],
      play: ['p1'],
      milestone: [],
    });
    expect(targets).toEqual([
      { activityType: 'feed', ids: ['f1', 'f2'] },
      { activityType: 'play', ids: ['p1'] },
    ]);
  });

  it('returns an empty array when every type has no ids', () => {
    expect(buildLinkTargets({ feed: [], bath: [] })).toEqual([]);
  });

  it('returns an empty array for empty input', () => {
    expect(buildLinkTargets({})).toEqual([]);
  });

  it('preserves the key order of the input record', () => {
    const targets = buildLinkTargets({
      photo: ['ph1'],
      feed: ['f1'],
      bath: ['b1'],
    });
    expect(targets.map((t) => t.activityType)).toEqual(['photo', 'feed', 'bath']);
  });

  it('carries foodLog targets through for the food tracker (issue #203)', () => {
    const targets = buildLinkTargets({
      feed: ['f1'],
      foodLog: ['fl1', 'fl2'],
    });
    expect(targets).toEqual([
      { activityType: 'feed', ids: ['f1'] },
      { activityType: 'foodLog', ids: ['fl1', 'fl2'] },
    ]);
  });
});

describe('groupPhotoLinks', () => {
  const row = (activityType: string, activityId: string, photoId: string, caption: string | null = null): PhotoLinkRow => ({
    activityType,
    activityId,
    photo: { id: photoId, caption },
  });

  it('returns an empty map for empty input', () => {
    const map = groupPhotoLinks([]);
    expect(map.size).toBe(0);
  });

  it('groups link rows into a map keyed by activityType:activityId', () => {
    const rows = [row('feed', 'f1', 'photo1', 'first')];
    const map = groupPhotoLinks(rows);
    expect(map.get('feed:f1')).toEqual([{ id: 'photo1', caption: 'first' }]);
  });

  it('preserves row order within a group', () => {
    const rows = [
      row('feed', 'f1', 'photoA'),
      row('feed', 'f1', 'photoB'),
      row('feed', 'f1', 'photoC'),
    ];
    const map = groupPhotoLinks(rows);
    expect(map.get('feed:f1')!.map((p) => p.id)).toEqual(['photoA', 'photoB', 'photoC']);
  });

  it('the same photo linked to two different activities appears under both keys', () => {
    const rows = [
      row('feed', 'f1', 'sharedPhoto', 'shared'),
      row('bath', 'b1', 'sharedPhoto', 'shared'),
    ];
    const map = groupPhotoLinks(rows);
    expect(map.get('feed:f1')).toEqual([{ id: 'sharedPhoto', caption: 'shared' }]);
    expect(map.get('bath:b1')).toEqual([{ id: 'sharedPhoto', caption: 'shared' }]);
  });

  it('duplicate rows produce duplicate entries (current behavior is not deduped)', () => {
    const rows = [
      row('play', 'p1', 'dup'),
      row('play', 'p1', 'dup'),
    ];
    const map = groupPhotoLinks(rows);
    expect(map.get('play:p1')).toEqual([{ id: 'dup', caption: null }, { id: 'dup', caption: null }]);
  });

  it('a photosFor-style lookup of a key that was never populated returns undefined', () => {
    const map = groupPhotoLinks([row('feed', 'f1', 'photo1')]);
    const photosFor = (activityType: string, activityId: string) => map.get(`${activityType}:${activityId}`);
    expect(photosFor('milestone', 'does-not-exist')).toBeUndefined();
  });
});

describe('photoLogHasLivePhotos', () => {
  const row = (activityType: string, activityId: string, photoId: string): PhotoLinkRow => ({
    activityType,
    activityId,
    photo: { id: photoId, caption: null },
  });

  it('true when the log has at least one live linked photo', () => {
    const map = groupPhotoLinks([row('photo', 'log1', 'p1')]);
    expect(photoLogHasLivePhotos(map, 'log1')).toBe(true);
  });

  it('false when the log has no entry at all (all photos trashed or purged)', () => {
    const map = groupPhotoLinks([]);
    expect(photoLogHasLivePhotos(map, 'log1')).toBe(false);
  });

  it('false when other logs have photos but this one does not', () => {
    const map = groupPhotoLinks([row('photo', 'otherLog', 'p1')]);
    expect(photoLogHasLivePhotos(map, 'log1')).toBe(false);
  });

  it('only matches the photo activity type, not another activity with the same id', () => {
    const map = groupPhotoLinks([row('feed', 'log1', 'p1')]);
    expect(photoLogHasLivePhotos(map, 'log1')).toBe(false);
  });
});

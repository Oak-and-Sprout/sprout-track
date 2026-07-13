import { describe, it, expect } from 'vitest';
import { filterGalleryPhotos, groupByMonth, groupByMilestone, GalleryPhotoLike } from '@/src/utils/photoGalleryUtils';

const p = (id: string, takenAt: string, caption: string | null, milestoneTitle: string | null, activityTypes: string[], isFavorite = false): GalleryPhotoLike =>
  ({ id, takenAt, caption, milestoneTitle, activityTypes, isFavorite });

const photos = [
  p('1', '2026-07-13T07:45:00Z', 'Morning giggles', null, ['photo'], true),
  p('2', '2026-07-13T07:02:00Z', 'First taste of avocado', 'First Solids', ['feed', 'milestone']),
  p('3', '2026-07-10T18:30:00Z', 'Splash zone', null, ['bath']),
  p('4', '2026-06-28T15:10:00Z', 'Rolled over!', 'Rolling Over', ['milestone'], true),
  p('5', '2026-06-20T19:30:00Z', null, null, ['photo']),
];

describe('filterGalleryPhotos', () => {
  it('query matches captions case-insensitively', () => {
    expect(filterGalleryPhotos(photos, { query: 'AVOCADO' }).map(x => x.id)).toEqual(['2']);
  });
  it('query matches milestone titles', () => {
    expect(filterGalleryPhotos(photos, { query: 'rolling' }).map(x => x.id)).toEqual(['4']);
  });
  it('null captions do not crash and never match', () => {
    expect(filterGalleryPhotos(photos, { query: 'zzz' })).toEqual([]);
  });
  it('type filter selects by link activityType', () => {
    expect(filterGalleryPhotos(photos, { type: 'feed' }).map(x => x.id)).toEqual(['2']);
    expect(filterGalleryPhotos(photos, { type: 'photo' }).map(x => x.id)).toEqual(['1', '5']);
  });
  it("type 'all' and empty query pass everything", () => {
    expect(filterGalleryPhotos(photos, { type: 'all', query: '' })).toHaveLength(5);
  });
  it('favoritesOnly composes with type', () => {
    expect(filterGalleryPhotos(photos, { favoritesOnly: true }).map(x => x.id)).toEqual(['1', '4']);
    expect(filterGalleryPhotos(photos, { favoritesOnly: true, type: 'milestone' }).map(x => x.id)).toEqual(['4']);
  });
});

describe('groupByMonth', () => {
  it('groups by YYYY-MM, newest month first, newest photo first inside', () => {
    const groups = groupByMonth(photos);
    expect(groups.map(g => g.monthKey)).toEqual(['2026-07', '2026-06']);
    expect(groups[0].photos.map(x => x.id)).toEqual(['1', '2', '3']);
    expect(groups[1].photos.map(x => x.id)).toEqual(['4', '5']);
  });
  it('empty input gives empty groups', () => {
    expect(groupByMonth([])).toEqual([]);
  });
});

describe('groupByMilestone', () => {
  it('tagged groups first, untagged ("No milestone") last', () => {
    const groups = groupByMilestone(photos);
    expect(groups[groups.length - 1].milestoneTitle).toBeNull();
    expect(groups[groups.length - 1].photos.map(x => x.id)).toEqual(['1', '3', '5']);
    expect(groups.slice(0, -1).map(g => g.milestoneTitle)).toEqual(['First Solids', 'Rolling Over']);
  });
  it('all untagged yields single null group', () => {
    const groups = groupByMilestone([photos[0], photos[4]]);
    expect(groups).toHaveLength(1);
    expect(groups[0].milestoneTitle).toBeNull();
  });
});

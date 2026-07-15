/**
 * Client-side gallery shaping: search, type/favorite filtering, and
 * month/milestone grouping. The gallery fetches the photo list once and
 * derives every view from these pure functions.
 */

export interface GalleryPhotoLike {
  id: string;
  takenAt: string;
  caption: string | null;
  milestoneTitle: string | null;
  activityTypes: string[];
  isFavorite: boolean;
}

export type GalleryTypeFilter = 'all' | 'photo' | 'feed' | 'bath' | 'milestone';

export function filterGalleryPhotos<T extends GalleryPhotoLike>(
  photos: T[],
  opts: { query?: string; type?: GalleryTypeFilter; favoritesOnly?: boolean }
): T[] {
  const q = (opts.query || '').trim().toLowerCase();
  return photos.filter((photo) => {
    if (opts.favoritesOnly && !photo.isFavorite) return false;
    if (opts.type && opts.type !== 'all' && !photo.activityTypes.includes(opts.type)) return false;
    if (q) {
      const haystack = `${photo.caption || ''} ${photo.milestoneTitle || ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

function sortNewestFirst<T extends GalleryPhotoLike>(photos: T[]): T[] {
  return [...photos].sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime());
}

/**
 * Groups photos by the LOCAL calendar month (not UTC) they were taken in, so
 * the month a photo lands under always matches the wall-clock date the user
 * sees elsewhere in the app (mirrors the local-day convention used by
 * PhotoLibraryTab).
 */
export function groupByMonth<T extends GalleryPhotoLike>(photos: T[]): { monthKey: string; photos: T[] }[] {
  const sorted = sortNewestFirst(photos);
  const groups = new Map<string, T[]>();
  for (const photo of sorted) {
    const d = new Date(photo.takenAt);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; // local 'YYYY-MM'
    if (!groups.has(monthKey)) groups.set(monthKey, []);
    groups.get(monthKey)!.push(photo);
  }
  return Array.from(groups.entries()).map(([monthKey, groupPhotos]) => ({ monthKey, photos: groupPhotos }));
}

export function groupByMilestone<T extends GalleryPhotoLike>(photos: T[]): { milestoneTitle: string | null; photos: T[] }[] {
  const sorted = sortNewestFirst(photos);
  const tagged = new Map<string, T[]>();
  const untagged: T[] = [];
  for (const photo of sorted) {
    if (photo.milestoneTitle) {
      if (!tagged.has(photo.milestoneTitle)) tagged.set(photo.milestoneTitle, []);
      tagged.get(photo.milestoneTitle)!.push(photo);
    } else {
      untagged.push(photo);
    }
  }
  const groups: { milestoneTitle: string | null; photos: T[] }[] = Array.from(tagged.entries()).map(
    ([milestoneTitle, groupPhotos]) => ({ milestoneTitle, photos: groupPhotos })
  );
  if (untagged.length) groups.push({ milestoneTitle: null, photos: untagged });
  return groups;
}

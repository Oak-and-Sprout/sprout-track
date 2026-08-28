/**
 * Photo quota planner for family migration (import side).
 *
 * Pure, DB- and FS-free. Given the photos to import and the remaining byte
 * budget on the target family, selects photos oldest-first (`takenAt`) until the
 * budget is exhausted. Each photo costs `fileSize + thumbSize` (thumbnails count
 * toward the quota, matching `getQuotaInfo`). The first photo that does not fit
 * stops selection — it and every remaining (newer) photo are reported as
 * `skippedOverQuota`, mirroring spec 04.
 *
 * The caller computes `remainingBytes` from `getQuotaInfo(targetFamilyId)`
 * (`totalBytes - usedBytes`, derived from `Settings.photoQuotaMB` /
 * `AppConfig.defaultPhotoQuotaMB`).
 */

/** The minimal shape the planner needs from a photo row. */
export interface QuotaPhoto {
  takenAt: Date;
  fileSize: number;
  thumbSize: number;
}

/** Selection result: photos that fit and photos skipped for lack of budget. */
export interface PhotoQuotaPlan<T> {
  selected: T[];
  skippedOverQuota: T[];
}

/**
 * Select photos oldest-first that fit within `remainingBytes`.
 * Does not mutate the input array.
 */
export function planPhotoQuota<T extends QuotaPhoto>(
  photos: readonly T[],
  remainingBytes: number
): PhotoQuotaPlan<T> {
  const ordered = [...photos].sort((a, b) => a.takenAt.getTime() - b.takenAt.getTime());

  const selected: T[] = [];
  const skippedOverQuota: T[] = [];
  let usedBytes = 0;
  let budgetExhausted = false;

  for (const photo of ordered) {
    if (budgetExhausted) {
      skippedOverQuota.push(photo);
      continue;
    }
    const cost = photo.fileSize + photo.thumbSize;
    if (usedBytes + cost <= remainingBytes) {
      selected.push(photo);
      usedBytes += cost;
    } else {
      budgetExhausted = true;
      skippedOverQuota.push(photo);
    }
  }

  return { selected, skippedOverQuota };
}

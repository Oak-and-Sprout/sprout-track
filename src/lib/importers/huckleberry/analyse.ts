import { ExternalImportFile } from '@/src/types/external-import';
import { huckleberryDetector } from './detect';
import { parseHuckleberryCsv } from './parse';
import {
  HUCKLEBERRY_SOURCE_CHILD_ID,
  HuckleberryImportWarning,
  HuckleberryPreviewDetails,
} from './types';

export function analyseHuckleberryFiles(
  _files: readonly ExternalImportFile[],
): HuckleberryPreviewDetails {
  return {
    children: [{
      sourceId: HUCKLEBERRY_SOURCE_CHILD_ID,
      firstName: 'Huckleberry care log',
      lastName: '',
      activityOnly: true,
    }],
    unitRequirements: [],
  };
}

export function collectHuckleberryWarnings(
  files: readonly ExternalImportFile[],
): readonly HuckleberryImportWarning[] {
  const detections = huckleberryDetector.detectFiles(files);
  const counts = new Map<HuckleberryImportWarning['code'], number>();
  const add = (code: HuckleberryImportWarning['code'], count: number) => {
    if (count > 0) counts.set(code, (counts.get(code) ?? 0) + count);
  };

  detections.forEach((detection, index) => {
    if (detection.status !== 'detected') return;
    const rows = parseHuckleberryCsv(files[index].content).rows;

    add(
      'unsupported-activity-type',
      rows.filter(row =>
        !['feed', 'diaper', 'pump'].includes(row.type?.trim().toLowerCase()),
      ).length,
    );
    add(
      'both-breasts-without-side',
      rows.filter(row =>
        row.type?.trim().toLowerCase() === 'feed' &&
        row['start location']?.trim().toLowerCase() === 'breast' &&
        Boolean(row['start condition']?.trim()) &&
        Boolean(row['end condition']?.trim()),
      ).length,
    );
    add(
      'pumping-duration-unavailable',
      rows.filter(row => row.type?.trim().toLowerCase() === 'pump').length,
    );
    add(
      'bottle-amount-missing',
      rows.filter(row =>
        row.type?.trim().toLowerCase() === 'feed' &&
        row['start location']?.trim().toLowerCase() === 'bottle' &&
        !row['end condition']?.trim(),
      ).length,
    );
  });

  return Array.from(counts, ([code, affectedRows]) => ({
    code,
    entityType: 'care-log',
    affectedRows,
  }));
}

import { ExternalImportFile } from '@/src/types/external-import';
import { babyBuddyDetector } from './detect';
import { isBabyBuddyBottleLikeMethod } from './map';
import { parseBabyBuddyCsv } from './parse';
import {
  BabyBuddyImportWarning,
  BabyBuddyWarningCode,
} from './types';

function countMatching(
  rows: readonly Readonly<Record<string, string>>[],
  predicate: (row: Readonly<Record<string, string>>) => boolean,
): number {
  return rows.filter(predicate).length;
}

export function collectBabyBuddyWarnings(
  files: readonly ExternalImportFile[],
): readonly BabyBuddyImportWarning[] {
  const detections = babyBuddyDetector.detectFiles(files);
  const warningCounts = new Map<
    string,
    BabyBuddyImportWarning
  >();

  function addWarning(
    code: BabyBuddyWarningCode,
    entityType: string,
    affectedRows: number,
  ): void {
    if (affectedRows === 0) {
      return;
    }

    const key = `${code}:${entityType}`;
    const existing = warningCounts.get(key);

    warningCounts.set(key, {
      code,
      entityType,
      affectedRows:
        affectedRows + (existing?.affectedRows ?? 0),
    });
  }

  detections.forEach((detection, index) => {
    if (
      detection.status !== 'detected' ||
      !detection.entityType
    ) {
      return;
    }

    const rows = parseBabyBuddyCsv(
      files[index].content,
    ).rows;

    addWarning(
      'tags-unsupported',
      detection.entityType,
      countMatching(rows, row => Boolean(row.tags?.trim())),
    );

    switch (detection.entityType) {
      case 'child':
        addWarning(
          'birth-time-unsupported',
          'child',
          countMatching(
            rows,
            row => Boolean(row.birth_time?.trim()),
          ),
        );
        break;

      case 'bmi':
        addWarning('bmi-unsupported', 'bmi', rows.length);
        break;

      case 'feeding':
        addWarning(
          'both-breasts-without-side',
          'feeding',
          countMatching(
            rows,
            row => row.method?.trim() === 'both breasts',
          ),
        );

        addWarning(
          'breast-feed-amount-unsupported',
          'feeding',
          countMatching(
            rows,
            row =>
              ['left breast', 'right breast', 'both breasts']
                .includes(row.method?.trim()) &&
              Boolean(row.amount?.trim()),
          ),
        );

        addWarning(
          'feeding-combination-unsupported',
          'feeding',
          countMatching(rows, row => {
            const method = row.method?.trim();
            const type = row.type?.trim();
            return !(
              ['left breast', 'right breast', 'both breasts']
                .includes(method ?? '') ||
              type === 'solid food' ||
              isBabyBuddyBottleLikeMethod(method)
            );
          }),
        );
        break;

      case 'diaper-change':
        addWarning(
          'wet-diaper-colour-unsupported',
          'diaper-change',
          countMatching(
            rows,
            row =>
              row.solid?.trim() !== '1' &&
              Boolean(row.color?.trim()),
          ),
        );

        addWarning(
          'diaper-amount-unsupported',
          'diaper-change',
          countMatching(
            rows,
            row => Boolean(row.amount?.trim()),
          ),
        );
        break;

      case 'pumping':
        addWarning(
          'pumping-defaults-to-stored',
          'pumping',
          rows.length,
        );
        break;

      case 'medication':
        addWarning(
          'medication-dosage-missing',
          'medication',
          countMatching(
            rows,
            row => !row.dosage?.trim(),
          ),
        );
        break;
    }
  });

  return Array.from(warningCounts.values());
}

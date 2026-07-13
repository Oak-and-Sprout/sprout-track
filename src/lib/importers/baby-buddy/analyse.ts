import { ExternalImportFile } from '@/src/types/external-import';
import { babyBuddyDetector } from './detect';
import { parseBabyBuddyCsv } from './parse';
import {
  BabyBuddyPreviewChild,
  BabyBuddyPreviewDetails,
  BabyBuddyUnitRequirement,
  BabyBuddyUnitRequirementType,
} from './types';

const unitOptions: Record<
  BabyBuddyUnitRequirementType,
  readonly string[]
> = {
  feeding: ['ML', 'OZ', 'SKIP'],
  pumping: ['ML', 'OZ'],
  height: ['cm', 'in'],
  weight: ['kg', 'lb'],
  'head-circumference': ['cm', 'in'],
  temperature: ['°C', '°F'],
};

function populatedValueCount(
  rows: readonly Readonly<Record<string, string>>[],
  field: string,
): number {
  return rows.filter(row => row[field]?.trim()).length;
}

export function analyseBabyBuddyFiles(
  files: readonly ExternalImportFile[],
): BabyBuddyPreviewDetails {
  const detections = babyBuddyDetector.detectFiles(files);
  const children: BabyBuddyPreviewChild[] = [];
  const unitRequirements: BabyBuddyUnitRequirement[] = [];

  detections.forEach((detection, index) => {
    if (
      detection.status !== 'detected' ||
      !detection.entityType
    ) {
      return;
    }

    const parsed = parseBabyBuddyCsv(files[index].content);

    if (detection.entityType === 'child') {
      parsed.rows.forEach(row => {
        children.push({
          sourceId: row.id,
          firstName: row.first_name,
          lastName: row.last_name,
          birthDate: row.birth_date,
          birthTime: row.birth_time || undefined,
        });
      });

      return;
    }

    const entityType =
      detection.entityType as BabyBuddyUnitRequirementType;

    if (!(entityType in unitOptions)) {
      return;
    }

    const populatedRows =
      entityType === 'feeding' ||
      entityType === 'pumping'
        ? populatedValueCount(parsed.rows, 'amount')
        : parsed.rows.length;

    if (populatedRows === 0) {
      return;
    }

    unitRequirements.push({
      entityType,
      populatedRows,
      allowedUnits: unitOptions[entityType],
      optional: entityType === 'feeding',
    });
  });

  return {
    children,
    unitRequirements,
  };
}

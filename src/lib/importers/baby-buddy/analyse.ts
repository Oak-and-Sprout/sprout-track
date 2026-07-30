import { ExternalImportFile } from '@/src/types/external-import';
import { babyBuddyDetector } from './detect';
import { isBabyBuddyBottleLikeMethod } from './map';
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
  const activityChildren = new Map<
    string,
    { firstName: string; lastName: string }
  >();
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

    parsed.rows.forEach(row => {
      const sourceId = row.child_id?.trim();

      if (!sourceId) {
        return;
      }

      const existing = activityChildren.get(sourceId);

      if (!existing || (!existing.firstName && row.child_first_name?.trim())) {
        activityChildren.set(sourceId, {
          firstName: row.child_first_name?.trim() || '',
          lastName: row.child_last_name?.trim() || '',
        });
      }
    });

    const entityType =
      detection.entityType as BabyBuddyUnitRequirementType;

    if (!(entityType in unitOptions)) {
      return;
    }

    const populatedRows =
      entityType === 'feeding'
        ? parsed.rows.filter(
            row =>
              isBabyBuddyBottleLikeMethod(row.method) &&
              Boolean(row.amount?.trim()),
          ).length
        : entityType === 'pumping'
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

  const knownIds = new Set(
    children.map(child => child.sourceId),
  );

  const derivedChildren = Array.from(
    activityChildren.entries(),
  )
    .filter(([sourceId]) => !knownIds.has(sourceId))
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([sourceId, names]) => ({
      sourceId,
      firstName: names.firstName,
      lastName: names.lastName,
      activityOnly: true,
    }));

  return {
    children: [...children, ...derivedChildren],
    unitRequirements,
  };
}

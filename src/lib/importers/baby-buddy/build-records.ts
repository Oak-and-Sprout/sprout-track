import {
  ExternalImportFile,
  ExternalImportRecord,
} from '@/src/types/external-import';
import { babyBuddyDetector } from './detect';
import {
  mapBabyBuddyChild,
  mapBabyBuddyDiaperChange,
  mapBabyBuddyFeeding,
  mapBabyBuddyNote,
  mapBabyBuddySleep,
} from './map';
import {
  mapBabyBuddyMeasurement,
  mapBabyBuddyPumping,
  mapBabyBuddyTummyTime,
} from './remaining-map';
import { parseBabyBuddyCsv } from './parse';
import {
  BabyBuddyExecutionConfiguration,
} from './types';

function requiredConfiguration<T>(
  value: T | undefined,
  name: string,
): T {
  if (value === undefined) {
    throw new Error(
      `Missing Baby Buddy import configuration: ${name}`,
    );
  }

  return value;
}

export function buildBabyBuddyImportRecords(
  files: readonly ExternalImportFile[],
  configuration: BabyBuddyExecutionConfiguration,
): readonly ExternalImportRecord[] {
  const detections = babyBuddyDetector.detectFiles(files);
  const records: ExternalImportRecord[] = [];

  detections.forEach((detection, index) => {
    if (
      detection.status !== 'detected' ||
      !detection.entityType
    ) {
      throw new Error(
        detection.error ||
          `Unable to identify import file: ${detection.fileName}`,
      );
    }

    const rows = parseBabyBuddyCsv(
      files[index].content,
    ).rows;

    switch (detection.entityType) {
      case 'child':
        records.push(...rows.map(mapBabyBuddyChild));
        break;

      case 'sleep':
        records.push(...rows.map(mapBabyBuddySleep));
        break;

      case 'note':
        records.push(...rows.map(mapBabyBuddyNote));
        break;

      case 'diaper-change':
        records.push(
          ...rows.map(mapBabyBuddyDiaperChange),
        );
        break;

      case 'feeding': {
        const populatedBottleAmounts = rows.some(
          row =>
            row.method?.trim() === 'bottle' &&
            Boolean(row.amount?.trim()),
        );

        const unit = populatedBottleAmounts
          ? requiredConfiguration(
              configuration.feedingUnit,
              'feedingUnit',
            )
          : configuration.feedingUnit || 'SKIP';

        records.push(
          ...rows.map(row =>
            mapBabyBuddyFeeding(row, unit),
          ),
        );
        break;
      }

      case 'pumping':
        if (rows.length > 0) {
          const unit = requiredConfiguration(
            configuration.pumpingUnit,
            'pumpingUnit',
          );

          records.push(
            ...rows.map(row =>
              mapBabyBuddyPumping(row, unit),
            ),
          );
        }
        break;

      case 'height':
        if (rows.length > 0) {
          const unit = requiredConfiguration(
            configuration.heightUnit,
            'heightUnit',
          );

          records.push(
            ...rows.map(row =>
              mapBabyBuddyMeasurement(
                'height',
                row,
                unit,
              ),
            ),
          );
        }
        break;

      case 'weight':
        if (rows.length > 0) {
          const unit = requiredConfiguration(
            configuration.weightUnit,
            'weightUnit',
          );

          records.push(
            ...rows.map(row =>
              mapBabyBuddyMeasurement(
                'weight',
                row,
                unit,
              ),
            ),
          );
        }
        break;

      case 'head-circumference':
        if (rows.length > 0) {
          const unit = requiredConfiguration(
            configuration.headCircumferenceUnit,
            'headCircumferenceUnit',
          );

          records.push(
            ...rows.map(row =>
              mapBabyBuddyMeasurement(
                'head-circumference',
                row,
                unit,
              ),
            ),
          );
        }
        break;

      case 'temperature':
        if (rows.length > 0) {
          const unit = requiredConfiguration(
            configuration.temperatureUnit,
            'temperatureUnit',
          );

          records.push(
            ...rows.map(row =>
              mapBabyBuddyMeasurement(
                'temperature',
                row,
                unit,
              ),
            ),
          );
        }
        break;

      case 'tummy-time':
        records.push(
          ...rows.map(mapBabyBuddyTummyTime),
        );
        break;

      case 'bmi':
      case 'tag':
        break;

      default:
        throw new Error(
          `Unsupported Baby Buddy export type: ${detection.entityType}`,
        );
    }
  });

  return records;
}

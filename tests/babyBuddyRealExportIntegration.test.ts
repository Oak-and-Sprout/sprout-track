import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import {
  analyseBabyBuddyFiles,
  babyBuddyDetector,
  buildBabyBuddyImportRecords,
} from '../src/lib/importers/baby-buddy';
import {
  createExternalImportExecutionPlan,
} from '../src/lib/importers/plan';

const fixtureDir = join(__dirname, 'fixtures', 'baby-buddy');

function fixture(name: string) {
  return {
    name,
    content: readFileSync(join(fixtureDir, name), 'utf8'),
  };
}

const englishFiles = readdirSync(fixtureDir)
  .filter(
    name =>
      name.endsWith('.csv') && !name.endsWith('-de.csv'),
  )
  .map(fixture);

const fullConfiguration = {
  feedingUnit: 'ML',
  pumpingUnit: 'ML',
  heightUnit: 'cm',
  weightUnit: 'kg',
  headCircumferenceUnit: 'cm',
  temperatureUnit: '°C',
} as const;

describe('Baby Buddy real export integration', () => {
  it('detects every English fixture file', () => {
    const detections =
      babyBuddyDetector.detectFiles(englishFiles);

    for (const detection of detections) {
      expect(
        detection,
        detection.fileName,
      ).toMatchObject({ status: 'detected' });
    }
  });

  it('analyses children with birth dates from the child export', () => {
    const details = analyseBabyBuddyFiles(englishFiles);

    expect(details.children.length).toBeGreaterThan(0);
    for (const child of details.children) {
      expect(child.birthDate).toBeTruthy();
      expect(child.activityOnly).toBeUndefined();
    }
  });

  it('builds records for the full export set including medicine', () => {
    const records = buildBabyBuddyImportRecords(
      englishFiles,
      fullConfiguration,
    );

    const types = new Set(
      records.map(record => record.targetType),
    );

    expect(records.length).toBeGreaterThan(0);
    expect(types.has('baby')).toBe(true);
    expect(types.has('medicine')).toBe(true);
  });

  it('plans without error when every child maps to an existing baby', () => {
    const records = buildBabyBuddyImportRecords(
      englishFiles,
      fullConfiguration,
    );
    const details = analyseBabyBuddyFiles(englishFiles);

    const childDestinations = Object.fromEntries(
      details.children.map((child, index) => [
        child.sourceId,
        {
          mode: 'existing' as const,
          targetBabyId: `baby-${index}`,
        },
      ]),
    );

    expect(() =>
      createExternalImportExecutionPlan(records, {
        sourceTimezone: 'UTC',
        childDestinations,
      }),
    ).not.toThrow();
  });

  it('parses German-locale exports to the same amounts as English ones', () => {
    const english = buildBabyBuddyImportRecords(
      [fixture('Medication.csv'), fixture('Feeding.csv')],
      fullConfiguration,
    );
    const german = buildBabyBuddyImportRecords(
      [
        fixture('Medication-de.csv'),
        fixture('Feeding-de.csv'),
      ],
      fullConfiguration,
    );

    const amounts = (records: typeof english) =>
      records
        .map(record =>
          record.targetType === 'medicine'
            ? record.doseAmount
            : record.targetType === 'feed'
              ? (record.amount ?? null)
              : null,
        )
        .filter(value => value !== null)
        .sort((a, b) => (a as number) - (b as number));

    expect(amounts(german)).toEqual(amounts(english));
  });

  it('derives children when only a single activity file is uploaded', () => {
    const details = analyseBabyBuddyFiles([
      fixture('Sleep.csv'),
    ]);

    expect(details.children.length).toBeGreaterThan(0);
    for (const child of details.children) {
      expect(child.activityOnly).toBe(true);
      expect(child.firstName).toBeTruthy();
    }
  });
});

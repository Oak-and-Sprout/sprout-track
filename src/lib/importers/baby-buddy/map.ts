import {
  ExternalImportBabyRecord,
  ExternalImportNoteRecord,
  ExternalImportRecord,
  ExternalImportSleepRecord,
} from '@/src/types/external-import';
import { BabyBuddyCsvRow } from './parse';

function required(
  row: BabyBuddyCsvRow,
  field: string,
): string {
  const value = row[field]?.trim();

  if (!value) {
    throw new Error(`Required field is missing: ${field}`);
  }

  return value;
}

function toUtcInput(value: string): string {
  const trimmed = value.trim();

  if (
    !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)
  ) {
    throw new Error(`Invalid Baby Buddy date-time: ${value}`);
  }

  return trimmed.replace(' ', 'T');
}

export function mapBabyBuddyChild(
  row: BabyBuddyCsvRow,
): ExternalImportBabyRecord {
  const sourceId = required(row, 'id');

  return {
    targetType: 'baby',
    source: {
      providerId: 'baby-buddy',
      entityType: 'child',
      recordId: sourceId,
      childId: sourceId,
    },
    firstName: required(row, 'first_name'),
    lastName: required(row, 'last_name'),
    birthDate: required(row, 'birth_date'),
  };
}

export function mapBabyBuddySleep(
  row: BabyBuddyCsvRow,
): ExternalImportSleepRecord {
  const sourceChildId = required(row, 'child_id');

  return {
    targetType: 'sleep',
    source: {
      providerId: 'baby-buddy',
      entityType: 'sleep',
      recordId: required(row, 'id'),
      childId: sourceChildId,
    },
    sourceChildId,
    startTime: toUtcInput(required(row, 'start')),
    endTime: toUtcInput(required(row, 'end')),
    type: required(row, 'nap') === '1'
      ? 'NAP'
      : 'NIGHT_SLEEP',
  };
}

export function mapBabyBuddyNote(
  row: BabyBuddyCsvRow,
): ExternalImportNoteRecord {
  const sourceChildId = required(row, 'child_id');

  return {
    targetType: 'note',
    source: {
      providerId: 'baby-buddy',
      entityType: 'note',
      recordId: required(row, 'id'),
      childId: sourceChildId,
    },
    sourceChildId,
    time: toUtcInput(required(row, 'time')),
    content: required(row, 'note'),
  };
}

export function mapBabyBuddyRows(
  entityType: string,
  rows: readonly BabyBuddyCsvRow[],
): readonly ExternalImportRecord[] {
  switch (entityType) {
    case 'child':
      return rows.map(mapBabyBuddyChild);

    case 'sleep':
      return rows.map(mapBabyBuddySleep);

    case 'note':
      return rows.map(mapBabyBuddyNote);

    default:
      return [];
  }
}

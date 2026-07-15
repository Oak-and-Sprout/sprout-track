import {
  ExternalImportBabyRecord,
  ExternalImportDiaperRecord,
  ExternalImportFeedRecord,
  ExternalImportFeedingAmountUnit,
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

    case 'diaper-change':
      return rows.map(mapBabyBuddyDiaperChange);

    default:
      return [];
  }
}

function optionalNumber(
  row: BabyBuddyCsvRow,
  field: string,
): number | undefined {
  const value = row[field]?.trim();

  if (!value) {
    return undefined;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(`Invalid number in field ${field}: ${value}`);
  }

  return number;
}

function durationSeconds(
  startTime: string,
  endTime: string,
): number {
  const start = new Date(`${startTime}Z`);
  const end = new Date(`${endTime}Z`);
  const duration = Math.round(
    (end.getTime() - start.getTime()) / 1000,
  );

  if (!Number.isFinite(duration) || duration < 0) {
    throw new Error('Feeding end time must not be before start time');
  }

  return duration;
}

export function mapBabyBuddyFeeding(
  row: BabyBuddyCsvRow,
  amountUnit: ExternalImportFeedingAmountUnit = 'SKIP',
): ExternalImportFeedRecord {
  const sourceChildId = required(row, 'child_id');
  const startTime = toUtcInput(required(row, 'start'));
  const endTime = toUtcInput(required(row, 'end'));
  const method = required(row, 'method');
  const sourceType = required(row, 'type');
  const notes = row.notes?.trim() || undefined;

  const base = {
    targetType: 'feed' as const,
    source: {
      providerId: 'baby-buddy',
      entityType: 'feeding',
      recordId: required(row, 'id'),
      childId: sourceChildId,
    },
    sourceChildId,
    time: endTime,
    notes,
  };

  if (
    method === 'left breast' ||
    method === 'right breast' ||
    method === 'both breasts'
  ) {
    return {
      ...base,
      type: 'BREAST',
      startTime,
      endTime,
      feedDuration: durationSeconds(startTime, endTime),
      side:
        method === 'left breast'
          ? 'LEFT'
          : method === 'right breast'
            ? 'RIGHT'
            : undefined,
    };
  }

  const amount = optionalNumber(row, 'amount');
  const importAmount =
    amount !== undefined && amountUnit !== 'SKIP';

  if (sourceType === 'solid food') {
    return {
      ...base,
      type: 'SOLIDS',
      ...(importAmount && {
        amount,
        unitAbbr: amountUnit,
      }),
    };
  }

  if (method === 'bottle') {
    const bottleType =
      sourceType === 'formula'
        ? 'Formula'
        : sourceType === 'breast milk'
          ? 'Breast Milk'
          : 'Other';

    return {
      ...base,
      type: 'BOTTLE',
      bottleType,
      ...(importAmount && {
        amount,
        unitAbbr: amountUnit,
      }),
    };
  }

  throw new Error(
    `Unsupported Baby Buddy feeding combination: ${sourceType} / ${method}`,
  );
}

export function mapBabyBuddyDiaperChange(
  row: BabyBuddyCsvRow,
): ExternalImportDiaperRecord {
  const sourceChildId = required(row, 'child_id');
  const wet = required(row, 'wet') === '1';
  const solid = required(row, 'solid') === '1';

  if (!wet && !solid) {
    throw new Error(
      'Baby Buddy diaper change must be wet, solid, or both',
    );
  }

  const type = wet && solid
    ? 'BOTH'
    : wet
      ? 'WET'
      : 'DIRTY';

  const rawColor = row.color?.trim().toUpperCase();
  const supportedColors = [
    'YELLOW',
    'BROWN',
    'GREEN',
    'BLACK',
  ] as const;

  const color =
    solid &&
    supportedColors.includes(
      rawColor as typeof supportedColors[number],
    )
      ? rawColor as typeof supportedColors[number]
      : undefined;

  return {
    targetType: 'diaper',
    source: {
      providerId: 'baby-buddy',
      entityType: 'diaper-change',
      recordId: required(row, 'id'),
      childId: sourceChildId,
    },
    sourceChildId,
    time: toUtcInput(required(row, 'time')),
    type,
    color,
  };
}

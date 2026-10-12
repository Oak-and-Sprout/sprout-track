import { createHash } from 'node:crypto';
import {
  ExternalImportDiaperRecord,
  ExternalImportFeedRecord,
  ExternalImportPumpRecord,
  ExternalImportRecord,
} from '@/src/types/external-import';
import {
  HUCKLEBERRY_SOURCE_CHILD_ID,
  HuckleberryCsvRow,
} from './types';

const canonicalFields = [
  'type',
  'start',
  'end',
  'duration',
  'start condition',
  'start location',
  'end condition',
  'notes',
  'logged by',
] as const;

function required(
  row: HuckleberryCsvRow,
  field: string,
): string {
  const value = row[field]?.trim();
  if (!value) {
    throw new Error(
      `Required Huckleberry field is missing: ${field}`,
    );
  }
  return value;
}

function localDateTime(value: string): string {
  const source = value.trim();
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?$/.test(source)) {
    throw new Error(`Invalid Huckleberry date-time: ${value}`);
  }
  return `${source.replace(' ', 'T')}${source.length === 16 ? ':00' : ''}`;
}

function amount(
  value: string,
): { value: number; unit: 'ML' | 'OZ' } | undefined {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(ml|oz)$/i);
  if (!match) return undefined;
  return {
    value: Number(match[1]),
    unit: match[2].toUpperCase() as 'ML' | 'OZ',
  };
}

function durationSeconds(startTime: string, endTime: string): number {
  const milliseconds =
    new Date(`${endTime}Z`).getTime() - new Date(`${startTime}Z`).getTime();
  const seconds = Math.round(milliseconds / 1000);
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new Error(
      'Huckleberry feeding end time must not be before its start time',
    );
  }
  return seconds;
}

function source(entityType: string, recordId: string) {
  return {
    providerId: 'huckleberry',
    entityType,
    recordId,
    childId: HUCKLEBERRY_SOURCE_CHILD_ID,
  } as const;
}

function combineNotes(...values: (string | undefined)[]): string | undefined {
  const notes = values.map(value => value?.trim()).filter(Boolean);
  return notes.length > 0 ? notes.join('\n') : undefined;
}

export function fingerprintHuckleberryRow(
  row: HuckleberryCsvRow,
): string {
  const canonical = canonicalFields.map(field => row[field] ?? '');
  return createHash('sha256')
    .update(JSON.stringify(canonical))
    .digest('hex')
    .slice(0, 24);
}

function mapFeed(
  row: HuckleberryCsvRow,
  recordId: string,
): ExternalImportFeedRecord {
  const startTime = localDateTime(required(row, 'start'));
  const location = required(row, 'start location').toLowerCase();
  const sourceNotes = row.notes?.trim() || undefined;

  if (location === 'bottle') {
    const parsedAmount = amount(row['end condition'] ?? '');
    const sourceType = row['start condition']?.trim().toLowerCase();
    const bottleType = sourceType === 'formula'
      ? 'Formula'
      : sourceType === 'breast milk'
        ? 'Breast Milk'
        : 'Other';

    return {
      targetType: 'feed',
      source: source('feeding', recordId),
      sourceChildId: HUCKLEBERRY_SOURCE_CHILD_ID,
      time: startTime,
      type: 'BOTTLE',
      bottleType,
      ...(parsedAmount && {
        amount: parsedAmount.value,
        unitAbbr: parsedAmount.unit,
      }),
      notes: sourceNotes,
    };
  }

  if (location !== 'breast') {
    throw new Error(
      `Unsupported Huckleberry feeding location: ${row['start location']}`,
    );
  }

  const endTime = localDateTime(required(row, 'end'));
  const sideValues = [row['start condition'], row['end condition']]
    .map(value => value?.trim())
    .filter(Boolean) as string[];
  const sides = new Set(
    sideValues
      .map(value => value.match(/[LR]$/i)?.[0]?.toUpperCase())
      .filter(Boolean),
  );
  const side = sides.size === 1
    ? (sides.has('L') ? 'LEFT' : 'RIGHT')
    : undefined;
  const sideSummary = sideValues.length > 0
    ? `Huckleberry sides: ${sideValues.join(', ')}`
    : undefined;

  return {
    targetType: 'feed',
    source: source('feeding', recordId),
    sourceChildId: HUCKLEBERRY_SOURCE_CHILD_ID,
    time: endTime,
    type: 'BREAST',
    startTime,
    endTime,
    feedDuration: durationSeconds(startTime, endTime),
    side,
    notes: combineNotes(sourceNotes, sideSummary),
  };
}

function mapDiaper(
  row: HuckleberryCsvRow,
  recordId: string,
): ExternalImportDiaperRecord {
  const condition = required(row, 'end condition');
  const kind = condition.split(',')[0].split(':')[0].trim().toLowerCase();
  if (!['pee', 'poo', 'both'].includes(kind)) {
    throw new Error(`Unsupported Huckleberry diaper condition: ${condition}`);
  }
  const type = kind === 'pee' ? 'WET' : kind === 'poo' ? 'DIRTY' : 'BOTH';
  const sourceColor = row.duration?.trim().toUpperCase();
  const color = ['YELLOW', 'BROWN', 'GREEN', 'BLACK'].includes(sourceColor)
    ? sourceColor as ExternalImportDiaperRecord['color']
    : undefined;
  const conditionDetail = condition
    .replace(/^(pee|poo|both)\s*[:,]?\s*/i, '')
    .trim();
  const detail = [conditionDetail, row['start condition']?.trim()]
    .filter(Boolean)
    .join('; ');

  return {
    targetType: 'diaper',
    source: source('diaper-change', recordId),
    sourceChildId: HUCKLEBERRY_SOURCE_CHILD_ID,
    time: localDateTime(required(row, 'start')),
    type,
    color,
    notes: combineNotes(
      row.notes,
      detail ? `Huckleberry: ${detail}` : undefined,
    ),
  };
}

function mapPump(
  row: HuckleberryCsvRow,
  recordId: string,
): ExternalImportPumpRecord {
  const startTime = localDateTime(required(row, 'start'));
  const parsedAmount = amount(required(row, 'start condition'));
  if (!parsedAmount) {
    throw new Error(`Invalid Huckleberry pumping amount: ${row['start condition']}`);
  }

  return {
    targetType: 'pump',
    source: source('pumping', recordId),
    sourceChildId: HUCKLEBERRY_SOURCE_CHILD_ID,
    startTime,
    endTime: startTime,
    duration: 0,
    totalAmount: parsedAmount.value,
    unitAbbr: parsedAmount.unit,
    pumpAction: 'STORED',
    notes: row.notes?.trim() || undefined,
  };
}

export interface HuckleberryMappedRows {
  readonly records: readonly ExternalImportRecord[];
  readonly unmappableRows: number;
}

/**
 * Maps supported rows, skipping (and counting) rows the mapper rejects so one
 * odd row cannot abort the whole import.
 *
 * Huckleberry exports carry no child identifier, so record IDs are content
 * fingerprints. `recordScope` (the destination baby ID) is prefixed so the same
 * row imported into two babies, e.g. twins' identical bottles, is not treated as
 * a duplicate of the other baby's record.
 */
export function mapHuckleberryRows(
  rows: readonly HuckleberryCsvRow[],
  recordScope: string,
): HuckleberryMappedRows {
  const occurrences = new Map<string, number>();
  const records: ExternalImportRecord[] = [];
  let unmappableRows = 0;

  rows.forEach(row => {
    const activityType = row.type?.trim().toLowerCase();
    if (!['feed', 'diaper', 'pump'].includes(activityType)) return;

    const fingerprint = fingerprintHuckleberryRow(row);
    const occurrence = (occurrences.get(fingerprint) ?? 0) + 1;
    occurrences.set(fingerprint, occurrence);
    const recordId = `${recordScope}:${activityType}-${fingerprint}-${occurrence}`;

    try {
      if (activityType === 'feed') records.push(mapFeed(row, recordId));
      if (activityType === 'diaper') records.push(mapDiaper(row, recordId));
      if (activityType === 'pump') records.push(mapPump(row, recordId));
    } catch {
      unmappableRows += 1;
    }
  });

  return { records, unmappableRows };
}

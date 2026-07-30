import { ExternalImportMedicineRecord } from '@/src/types/external-import';
import { BabyBuddyCsvRow } from './parse';
import { parseBabyBuddyNumber } from './numbers';

function required(row: BabyBuddyCsvRow, field: string): string {
  const value = row[field]?.trim();
  if (!value) throw new Error(`Required field is missing: ${field}`);
  return value;
}

function toUtcInput(value: string): string {
  const source = value.trim();
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(source)) {
    throw new Error(`Invalid Baby Buddy date-time: ${value}`);
  }
  return source.replace(' ', 'T');
}

const dosageUnits: Record<
  string,
  'MG' | 'ML' | 'TAB' | 'DROP'
> = {
  mg: 'MG',
  ml: 'ML',
  tablets: 'TAB',
  drops: 'DROP',
};

export function babyBuddyIntervalToDoseMinTime(
  value: string,
): string | undefined {
  const match = value
    .trim()
    .match(/^(?:(\d+) days?, )?(\d+):(\d{2}):(\d{2})(?:\.\d+)?$/);

  if (!match) {
    return undefined;
  }

  let days = Number(match[1] || 0);
  let hours = Number(match[2]);
  const minutes = match[3];

  // Normalize: move excess hours into days
  days += Math.floor(hours / 24);
  hours %= 24;

  return `${String(days).padStart(2, '0')}:${String(hours).padStart(2, '0')}:${minutes}`;
}

export function mapBabyBuddyMedication(
  row: BabyBuddyCsvRow,
): ExternalImportMedicineRecord {
  const sourceChildId = required(row, 'child_id');
  const dosage = row.dosage?.trim();
  const unitAbbr =
    dosageUnits[row.dosage_unit?.trim().toLowerCase() ?? ''];
  const doseMinTime = babyBuddyIntervalToDoseMinTime(
    row.next_dose_interval ?? '',
  );

  return {
    targetType: 'medicine',
    source: {
      providerId: 'baby-buddy',
      entityType: 'medication',
      recordId: required(row, 'id'),
      childId: sourceChildId,
    },
    sourceChildId,
    time: toUtcInput(required(row, 'time')),
    medicineName: required(row, 'name'),
    doseAmount: dosage
      ? parseBabyBuddyNumber(dosage, 'dosage')
      : 0,
    ...(unitAbbr && { unitAbbr }),
    ...(doseMinTime && { doseMinTime }),
    notes: row.notes?.trim() || undefined,
  };
}

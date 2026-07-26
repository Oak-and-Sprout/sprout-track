import {
  ExternalImportMeasurementRecord,
  ExternalImportPlayRecord,
  ExternalImportPumpRecord,
} from '@/src/types/external-import';
import { BabyBuddyCsvRow } from './parse';

function required(row: BabyBuddyCsvRow, field: string): string {
  const value = row[field]?.trim();
  if (!value) throw new Error(`Required field is missing: ${field}`);
  return value;
}

function numberValue(row: BabyBuddyCsvRow, field: string): number {
  const source = required(row, field);
  const value = Number(source);
  if (!Number.isFinite(value)) throw new Error(`Invalid number in field ${field}: ${source}`);
  return value;
}

function toUtcInput(value: string): string {
  const source = value.trim();
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(source)) {
    throw new Error(`Invalid Baby Buddy date-time: ${value}`);
  }
  return source.replace(' ', 'T');
}

function dateAtUtcMidnight(value: string): string {
  const source = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(source)) {
    throw new Error(`Invalid Baby Buddy date: ${value}`);
  }
  return `${source}T00:00:00`;
}

function source(entityType: string, row: BabyBuddyCsvRow) {
  const childId = required(row, 'child_id');
  return {
    providerId: 'baby-buddy',
    entityType,
    recordId: required(row, 'id'),
    childId,
  } as const;
}

export function mapBabyBuddyMeasurement(
  entityType: 'height' | 'weight' | 'head-circumference' | 'temperature',
  row: BabyBuddyCsvRow,
  unit: ExternalImportMeasurementRecord['unit'],
): ExternalImportMeasurementRecord {
  const definitions = {
    height: { targetType: 'HEIGHT', field: 'height', dateField: 'date' },
    weight: { targetType: 'WEIGHT', field: 'weight', dateField: 'date' },
    'head-circumference': { targetType: 'HEAD_CIRCUMFERENCE', field: 'head_circumference', dateField: 'date' },
    temperature: { targetType: 'TEMPERATURE', field: 'temperature', dateField: 'time' },
  } as const;
  const definition = definitions[entityType];
  const allowedUnits = {
    height: ['cm', 'in'],
    weight: ['kg', 'lb'],
    'head-circumference': ['cm', 'in'],
    temperature: ['°C', '°F'],
  } as const;

  if (!(allowedUnits[entityType] as readonly string[]).includes(unit)) {
    throw new Error(
      `Unsupported unit for ${entityType}: ${unit}`,
    );
  }

  const sourceChildId = required(row, 'child_id');
  const date = definition.dateField === 'time'
    ? toUtcInput(required(row, definition.dateField))
    : dateAtUtcMidnight(required(row, definition.dateField));
  return {
    targetType: 'measurement', source: source(entityType, row), sourceChildId,
    date, type: definition.targetType, value: numberValue(row, definition.field),
    unit, notes: row.notes?.trim() || undefined,
  };
}

export function mapBabyBuddyPumping(
  row: BabyBuddyCsvRow,
  unitAbbr: 'ML' | 'OZ',
): ExternalImportPumpRecord {
  const sourceChildId = required(row, 'child_id');
  const startTime = toUtcInput(required(row, 'start'));
  const endTime = toUtcInput(required(row, 'end'));
  const duration = Math.round((new Date(`${endTime}Z`).getTime() - new Date(`${startTime}Z`).getTime()) / 60000);
  if (!Number.isFinite(duration) || duration < 0) throw new Error('Pumping end time must not be before start time');
  return {
    targetType: 'pump', source: source('pumping', row), sourceChildId,
    startTime, endTime, duration, totalAmount: numberValue(row, 'amount'),
    unitAbbr, pumpAction: 'STORED', notes: row.notes?.trim() || undefined,
  };
}

export function mapBabyBuddyTummyTime(row: BabyBuddyCsvRow): ExternalImportPlayRecord {
  const sourceChildId = required(row, 'child_id');
  const startTime = toUtcInput(required(row, 'start'));
  const endTime = toUtcInput(required(row, 'end'));
  const duration = Math.round((new Date(`${endTime}Z`).getTime() - new Date(`${startTime}Z`).getTime()) / 60000);
  if (!Number.isFinite(duration) || duration < 0) throw new Error('Tummy time end time must not be before start time');
  return {
    targetType: 'play', source: source('tummy-time', row), sourceChildId,
    startTime, duration, type: 'TUMMY_TIME', notes: row.milestone?.trim() || undefined,
  };
}

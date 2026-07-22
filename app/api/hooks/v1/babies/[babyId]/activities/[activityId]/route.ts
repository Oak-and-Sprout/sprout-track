import { NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import prisma from '../../../../../../db';
import { withApiKeyAuth, ApiKeyContext, validateBabyAccess } from '../../../../auth';
import { checkRateLimit } from '../../../../rate-limiter';
import { hookSuccess, hookError } from '../../../../response';

const VALID_TYPES = ['sleep', 'feed', 'diaper', 'note', 'pump', 'play', 'bath', 'measurement', 'medicine', 'supplement'] as const;
type ActivityType = typeof VALID_TYPES[number];

type RouteContext = {
  params: Promise<{ babyId: string; activityId: string }>;
};

type JsonObject = Record<string, unknown>;

type MutationSummary = {
  activityType: ActivityType;
  id: string;
  babyId: string;
  time?: string;
  status: 'updated' | 'deleted';
  details?: JsonObject;
};

type FoundActivity = {
  type: ActivityType;
  id: string;
  babyId: string;
  time?: Date;
};

const TYPE_ALIASES: Record<string, ActivityType> = {
  sleep: 'sleep',
  feed: 'feed',
  diaper: 'diaper',
  note: 'note',
  pump: 'pump',
  play: 'play',
  bath: 'bath',
  measurement: 'measurement',
  medicine: 'medicine',
  supplement: 'supplement',
};

const TYPE_FIELDS: Record<ActivityType, readonly string[]> = {
  sleep: ['type', 'sleepType', 'time', 'startTime', 'endTime', 'duration', 'location', 'quality'],
  feed: ['type', 'feedType', 'time', 'startTime', 'endTime', 'duration', 'feedDuration', 'amount', 'unitAbbr', 'side', 'food', 'notes', 'bottleType', 'breastMilkAmount'],
  diaper: ['type', 'diaperType', 'time', 'condition', 'color', 'blowout', 'creamApplied'],
  note: ['type', 'time', 'content', 'category'],
  pump: ['type', 'time', 'startTime', 'endTime', 'duration', 'leftAmount', 'rightAmount', 'totalAmount', 'unitAbbr', 'pumpAction', 'notes'],
  play: ['type', 'time', 'startTime', 'duration', 'playType', 'notes', 'activities'],
  bath: ['type', 'time', 'bathType', 'soapUsed', 'shampooUsed', 'notes'],
  measurement: ['type', 'measurementType', 'time', 'date', 'value', 'unit', 'notes'],
  medicine: ['type', 'medicineName', 'time', 'amount', 'doseAmount', 'unitAbbr', 'notes'],
  supplement: ['type', 'supplementName', 'medicineName', 'time', 'amount', 'doseAmount', 'unitAbbr', 'notes'],
};

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseActivityType(value: unknown): ActivityType | null {
  if (typeof value !== 'string') return null;
  return TYPE_ALIASES[value] ?? null;
}

function parseDate(value: unknown, field: string): { value?: Date; error?: string } {
  if (value === undefined) return {};
  if (typeof value !== 'string') return { error: `${field} must be an ISO 8601 string` };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { error: `${field} must be a valid ISO 8601 timestamp` };
  return { value: date };
}

function parseNumber(value: unknown, field: string): { value?: number | null; error?: string } {
  if (value === undefined) return {};
  if (value === null) return { value: null };
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(number)) return { error: `${field} must be a finite number` };
  return { value: number };
}

function parseBoolean(value: unknown, field: string): { value?: boolean; error?: string } {
  if (value === undefined) return {};
  if (typeof value !== 'boolean') return { error: `${field} must be a boolean` };
  return { value };
}

function parseString(value: unknown, field: string): { value?: string | null; error?: string } {
  if (value === undefined) return {};
  if (value === null) return { value: null };
  if (typeof value !== 'string') return { error: `${field} must be a string` };
  const trimmed = value.trim();
  return { value: trimmed || null };
}

function rejectUnknownFields(type: ActivityType, body: JsonObject): string | null {
  const allowed = new Set(TYPE_FIELDS[type]);
  const forbidden = Object.keys(body).filter((key) => !allowed.has(key));
  if (!forbidden.length) return null;
  return `Unsupported field(s) for ${type}: ${forbidden.join(', ')}`;
}

function requireEnum<T extends string>(value: unknown, field: string, allowed: readonly T[]): { value?: T; error?: string } {
  if (value === undefined) return {};
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    return { error: `${field} must be one of: ${allowed.join(', ')}` };
  }
  return { value: value as T };
}

function assignDate(target: JsonObject, body: JsonObject, sourceField: string, targetField: string): string | null {
  const parsed = parseDate(body[sourceField], sourceField);
  if (parsed.error) return parsed.error;
  if (parsed.value) target[targetField] = parsed.value;
  return null;
}

function assignNumber(target: JsonObject, body: JsonObject, sourceField: string, targetField = sourceField): string | null {
  const parsed = parseNumber(body[sourceField], sourceField);
  if (parsed.error) return parsed.error;
  if (parsed.value !== undefined) target[targetField] = parsed.value;
  return null;
}

function assignString(target: JsonObject, body: JsonObject, sourceField: string, targetField = sourceField): string | null {
  const parsed = parseString(body[sourceField], sourceField);
  if (parsed.error) return parsed.error;
  if (parsed.value !== undefined) target[targetField] = parsed.value;
  return null;
}

function assignBoolean(target: JsonObject, body: JsonObject, sourceField: string, targetField = sourceField): string | null {
  const parsed = parseBoolean(body[sourceField], sourceField);
  if (parsed.error) return parsed.error;
  if (parsed.value !== undefined) target[targetField] = parsed.value;
  return null;
}

function timeFrom(body: JsonObject, explicitField: string): { value?: Date; error?: string } {
  if (body[explicitField] !== undefined) return parseDate(body[explicitField], explicitField);
  return parseDate(body.time, 'time');
}

function ensureNonEmptyUpdate(data: JsonObject): string | null {
  return Object.keys(data).length ? null : 'At least one mutable field is required';
}

function toIso(value: Date | null | undefined): string | undefined {
  return value ? value.toISOString() : undefined;
}

function summary(
  activityType: ActivityType,
  id: string,
  babyId: string,
  status: 'updated' | 'deleted',
  time?: Date | null,
  details?: JsonObject
): MutationSummary {
  return {
    activityType,
    id,
    babyId,
    status,
    ...(time ? { time: time.toISOString() } : {}),
    ...(details ? { details } : {}),
  };
}

function buildFeedData(body: JsonObject): { data?: Prisma.FeedLogUpdateInput; error?: string } {
  const data: JsonObject = {};
  const feedType = requireEnum(body.feedType, 'feedType', ['BREAST', 'BOTTLE', 'SOLIDS'] as const);
  if (feedType.error) return { error: feedType.error };
  if (feedType.value) data.type = feedType.value;
  for (const field of ['time', 'startTime', 'endTime'] as const) {
    const error = assignDate(data, body, field, field);
    if (error) return { error };
  }
  const duration = parseNumber(body.duration ?? body.feedDuration, body.duration !== undefined ? 'duration' : 'feedDuration');
  if (duration.error) return { error: duration.error };
  if (duration.value !== undefined) data.feedDuration = duration.value === null ? null : Math.round(duration.value * 60);
  for (const field of ['amount', 'breastMilkAmount'] as const) {
    const error = assignNumber(data, body, field);
    if (error) return { error };
  }
  for (const field of ['unitAbbr', 'side', 'food', 'notes', 'bottleType'] as const) {
    const error = assignString(data, body, field);
    if (error) return { error };
  }
  const empty = ensureNonEmptyUpdate(data);
  return empty ? { error: empty } : { data: data as Prisma.FeedLogUpdateInput };
}

function buildDiaperData(body: JsonObject): { data?: Prisma.DiaperLogUpdateInput; error?: string } {
  const data: JsonObject = {};
  const diaperType = requireEnum(body.diaperType, 'diaperType', ['WET', 'DIRTY', 'BOTH'] as const);
  if (diaperType.error) return { error: diaperType.error };
  if (diaperType.value) data.type = diaperType.value;
  const timeError = assignDate(data, body, 'time', 'time');
  if (timeError) return { error: timeError };
  for (const field of ['condition', 'color'] as const) {
    const error = assignString(data, body, field);
    if (error) return { error };
  }
  for (const field of ['blowout', 'creamApplied'] as const) {
    const error = assignBoolean(data, body, field);
    if (error) return { error };
  }
  const empty = ensureNonEmptyUpdate(data);
  return empty ? { error: empty } : { data: data as Prisma.DiaperLogUpdateInput };
}

function buildSleepData(body: JsonObject): { data?: Prisma.SleepLogUpdateInput; error?: string } {
  const data: JsonObject = {};
  const sleepType = requireEnum(body.sleepType, 'sleepType', ['NAP', 'NIGHT_SLEEP'] as const);
  if (sleepType.error) return { error: sleepType.error };
  if (sleepType.value) data.type = sleepType.value;
  const start = timeFrom(body, 'startTime');
  if (start.error) return { error: start.error };
  if (start.value) data.startTime = start.value;
  const endError = assignDate(data, body, 'endTime', 'endTime');
  if (endError) return { error: endError };
  const durationError = assignNumber(data, body, 'duration');
  if (durationError) return { error: durationError };
  for (const field of ['location', 'quality'] as const) {
    const error = assignString(data, body, field);
    if (error) return { error };
  }
  const empty = ensureNonEmptyUpdate(data);
  return empty ? { error: empty } : { data: data as Prisma.SleepLogUpdateInput };
}

function buildNoteData(body: JsonObject): { data?: Prisma.NoteUpdateInput; error?: string } {
  const data: JsonObject = {};
  const timeError = assignDate(data, body, 'time', 'time');
  if (timeError) return { error: timeError };
  for (const field of ['content', 'category'] as const) {
    const error = assignString(data, body, field);
    if (error) return { error };
  }
  const empty = ensureNonEmptyUpdate(data);
  return empty ? { error: empty } : { data: data as Prisma.NoteUpdateInput };
}

function buildPumpData(body: JsonObject): { data?: Prisma.PumpLogUpdateInput; error?: string } {
  const data: JsonObject = {};
  const start = timeFrom(body, 'startTime');
  if (start.error) return { error: start.error };
  if (start.value) data.startTime = start.value;
  const endError = assignDate(data, body, 'endTime', 'endTime');
  if (endError) return { error: endError };
  for (const field of ['duration', 'leftAmount', 'rightAmount', 'totalAmount'] as const) {
    const error = assignNumber(data, body, field);
    if (error) return { error };
  }
  for (const field of ['unitAbbr', 'notes'] as const) {
    const error = assignString(data, body, field);
    if (error) return { error };
  }
  const pumpAction = requireEnum(body.pumpAction, 'pumpAction', ['STORED', 'FED', 'DISCARDED'] as const);
  if (pumpAction.error) return { error: pumpAction.error };
  if (pumpAction.value) data.pumpAction = pumpAction.value;
  const empty = ensureNonEmptyUpdate(data);
  return empty ? { error: empty } : { data: data as Prisma.PumpLogUpdateInput };
}

function buildPlayData(body: JsonObject): { data?: Prisma.PlayLogUpdateInput; error?: string } {
  const data: JsonObject = {};
  const start = timeFrom(body, 'startTime');
  if (start.error) return { error: start.error };
  if (start.value) data.startTime = start.value;
  const duration = parseNumber(body.duration, 'duration');
  if (duration.error) return { error: duration.error };
  if (duration.value !== undefined) {
    data.duration = duration.value;
    if (duration.value && data.startTime instanceof Date) {
      data.endTime = new Date(data.startTime.getTime() + duration.value * 60000);
    }
  }
  const playType = requireEnum(body.playType, 'playType', ['TUMMY_TIME', 'INDOOR_PLAY', 'OUTDOOR_PLAY', 'WALK', 'CUSTOM'] as const);
  if (playType.error) return { error: playType.error };
  if (playType.value) data.type = playType.value;
  for (const field of ['notes', 'activities'] as const) {
    const error = assignString(data, body, field);
    if (error) return { error };
  }
  const empty = ensureNonEmptyUpdate(data);
  return empty ? { error: empty } : { data: data as Prisma.PlayLogUpdateInput };
}

function buildBathData(body: JsonObject): { data?: Prisma.BathLogUpdateInput; error?: string } {
  const data: JsonObject = {};
  const timeError = assignDate(data, body, 'time', 'time');
  if (timeError) return { error: timeError };
  for (const field of ['bathType', 'notes'] as const) {
    const error = assignString(data, body, field);
    if (error) return { error };
  }
  for (const field of ['soapUsed', 'shampooUsed'] as const) {
    const error = assignBoolean(data, body, field);
    if (error) return { error };
  }
  const empty = ensureNonEmptyUpdate(data);
  return empty ? { error: empty } : { data: data as Prisma.BathLogUpdateInput };
}

function buildMeasurementData(body: JsonObject): { data?: Prisma.MeasurementUpdateInput; error?: string } {
  const data: JsonObject = {};
  const measurementType = requireEnum(body.measurementType, 'measurementType', ['WEIGHT', 'HEIGHT', 'HEAD_CIRCUMFERENCE', 'TEMPERATURE'] as const);
  if (measurementType.error) return { error: measurementType.error };
  if (measurementType.value) data.type = measurementType.value;
  const date = timeFrom(body, 'date');
  if (date.error) return { error: date.error };
  if (date.value) data.date = date.value;
  const valueError = assignNumber(data, body, 'value');
  if (valueError) return { error: valueError };
  for (const field of ['unit', 'notes'] as const) {
    const error = assignString(data, body, field);
    if (error) return { error };
  }
  const empty = ensureNonEmptyUpdate(data);
  return empty ? { error: empty } : { data: data as Prisma.MeasurementUpdateInput };
}

async function buildMedicineData(
  body: JsonObject,
  familyId: string,
  isSupplement: boolean
): Promise<{ data?: Prisma.MedicineLogUpdateInput; error?: string; status?: number }> {
  const data: JsonObject = {};
  const timeError = assignDate(data, body, 'time', 'time');
  if (timeError) return { error: timeError };
  const amount = parseNumber(body.amount ?? body.doseAmount, body.amount !== undefined ? 'amount' : 'doseAmount');
  if (amount.error) return { error: amount.error };
  if (amount.value !== undefined) data.doseAmount = amount.value ?? 0;
  for (const field of ['unitAbbr', 'notes'] as const) {
    const error = assignString(data, body, field);
    if (error) return { error };
  }

  const nameField = isSupplement ? 'supplementName' : 'medicineName';
  const providedName = body[nameField] ?? (isSupplement ? body.medicineName : undefined);
  const parsedName = parseString(providedName, nameField);
  if (parsedName.error) return { error: parsedName.error };
  if (parsedName.value) {
    const medicine = await prisma.medicine.findFirst({
      where: { familyId, name: { equals: parsedName.value }, isSupplement, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!medicine) {
      return {
        error: `${isSupplement ? 'Supplement' : 'Medicine'} '${parsedName.value}' not found`,
        status: 404,
      };
    }
    data.medicine = { connect: { id: medicine.id } };
  }

  const empty = ensureNonEmptyUpdate(data);
  return empty ? { error: empty } : { data: data as Prisma.MedicineLogUpdateInput };
}

async function findExistingActivity(type: ActivityType, activityId: string, babyId: string, familyId: string): Promise<FoundActivity | null> {
  switch (type) {
    case 'feed': {
      const row = await prisma.feedLog.findFirst({ where: { id: activityId, babyId, familyId, deletedAt: null }, select: { id: true, babyId: true, time: true } });
      return row ? { type, id: row.id, babyId: row.babyId, time: row.time } : null;
    }
    case 'diaper': {
      const row = await prisma.diaperLog.findFirst({ where: { id: activityId, babyId, familyId, deletedAt: null }, select: { id: true, babyId: true, time: true } });
      return row ? { type, id: row.id, babyId: row.babyId, time: row.time } : null;
    }
    case 'sleep': {
      const row = await prisma.sleepLog.findFirst({ where: { id: activityId, babyId, familyId, deletedAt: null }, select: { id: true, babyId: true, startTime: true } });
      return row ? { type, id: row.id, babyId: row.babyId, time: row.startTime } : null;
    }
    case 'note': {
      const row = await prisma.note.findFirst({ where: { id: activityId, babyId, familyId, deletedAt: null }, select: { id: true, babyId: true, time: true } });
      return row ? { type, id: row.id, babyId: row.babyId, time: row.time } : null;
    }
    case 'pump': {
      const row = await prisma.pumpLog.findFirst({ where: { id: activityId, babyId, familyId, deletedAt: null }, select: { id: true, babyId: true, startTime: true } });
      return row ? { type, id: row.id, babyId: row.babyId, time: row.startTime } : null;
    }
    case 'play': {
      const row = await prisma.playLog.findFirst({ where: { id: activityId, babyId, familyId, deletedAt: null }, select: { id: true, babyId: true, startTime: true } });
      return row ? { type, id: row.id, babyId: row.babyId, time: row.startTime } : null;
    }
    case 'bath': {
      const row = await prisma.bathLog.findFirst({ where: { id: activityId, babyId, familyId, deletedAt: null }, select: { id: true, babyId: true, time: true } });
      return row ? { type, id: row.id, babyId: row.babyId, time: row.time } : null;
    }
    case 'measurement': {
      const row = await prisma.measurement.findFirst({ where: { id: activityId, babyId, familyId, deletedAt: null }, select: { id: true, babyId: true, date: true } });
      return row ? { type, id: row.id, babyId: row.babyId, time: row.date } : null;
    }
    case 'medicine':
    case 'supplement': {
      const row = await prisma.medicineLog.findFirst({
        where: { id: activityId, babyId, familyId, deletedAt: null, medicine: { isSupplement: type === 'supplement' } },
        select: { id: true, babyId: true, time: true },
      });
      return row ? { type, id: row.id, babyId: row.babyId, time: row.time } : null;
    }
  }
}

async function findAnyExistingActivity(activityId: string, babyId: string, familyId: string): Promise<FoundActivity | null> {
  for (const type of VALID_TYPES) {
    const found = await findExistingActivity(type, activityId, babyId, familyId);
    if (found) return found;
  }
  return null;
}

async function updateActivity(type: ActivityType, activityId: string, babyId: string, familyId: string, body: JsonObject): Promise<{ result?: MutationSummary; error?: string; status?: number }> {
  const existing = await findExistingActivity(type, activityId, babyId, familyId);
  if (!existing) return { error: `${type} activity not found`, status: 404 };

  switch (type) {
    case 'feed': {
      const built = buildFeedData(body);
      if (built.error) return { error: built.error, status: 400 };
      const row = await prisma.feedLog.update({ where: { id: activityId }, data: built.data! });
      return { result: summary(type, row.id, row.babyId, 'updated', row.time, { type: row.type, amount: row.amount, unitAbbr: row.unitAbbr, notes: row.notes }) };
    }
    case 'diaper': {
      const built = buildDiaperData(body);
      if (built.error) return { error: built.error, status: 400 };
      const row = await prisma.diaperLog.update({ where: { id: activityId }, data: built.data! });
      return { result: summary(type, row.id, row.babyId, 'updated', row.time, { type: row.type, condition: row.condition, color: row.color, blowout: row.blowout, creamApplied: row.creamApplied }) };
    }
    case 'sleep': {
      const built = buildSleepData(body);
      if (built.error) return { error: built.error, status: 400 };
      const row = await prisma.sleepLog.update({ where: { id: activityId }, data: built.data! });
      return { result: summary(type, row.id, row.babyId, 'updated', row.startTime, { type: row.type, startTime: row.startTime.toISOString(), endTime: toIso(row.endTime), duration: row.duration, location: row.location, quality: row.quality }) };
    }
    case 'note': {
      const built = buildNoteData(body);
      if (built.error) return { error: built.error, status: 400 };
      const row = await prisma.note.update({ where: { id: activityId }, data: built.data! });
      return { result: summary(type, row.id, row.babyId, 'updated', row.time, { content: row.content, category: row.category }) };
    }
    case 'pump': {
      const built = buildPumpData(body);
      if (built.error) return { error: built.error, status: 400 };
      const row = await prisma.pumpLog.update({ where: { id: activityId }, data: built.data! });
      return { result: summary(type, row.id, row.babyId, 'updated', row.startTime, { startTime: row.startTime.toISOString(), endTime: toIso(row.endTime), duration: row.duration, totalAmount: row.totalAmount, unitAbbr: row.unitAbbr, pumpAction: row.pumpAction }) };
    }
    case 'play': {
      const built = buildPlayData(body);
      if (built.error) return { error: built.error, status: 400 };
      const row = await prisma.playLog.update({ where: { id: activityId }, data: built.data! });
      return { result: summary(type, row.id, row.babyId, 'updated', row.startTime, { type: row.type, startTime: row.startTime.toISOString(), endTime: toIso(row.endTime), duration: row.duration, notes: row.notes, activities: row.activities }) };
    }
    case 'bath': {
      const built = buildBathData(body);
      if (built.error) return { error: built.error, status: 400 };
      const row = await prisma.bathLog.update({ where: { id: activityId }, data: built.data! });
      return { result: summary(type, row.id, row.babyId, 'updated', row.time, { bathType: row.bathType, soapUsed: row.soapUsed, shampooUsed: row.shampooUsed, notes: row.notes }) };
    }
    case 'measurement': {
      const built = buildMeasurementData(body);
      if (built.error) return { error: built.error, status: 400 };
      const row = await prisma.measurement.update({ where: { id: activityId }, data: built.data! });
      return { result: summary(type, row.id, row.babyId, 'updated', row.date, { type: row.type, value: row.value, unit: row.unit, notes: row.notes }) };
    }
    case 'medicine':
    case 'supplement': {
      const built = await buildMedicineData(body, familyId, type === 'supplement');
      if (built.error) return { error: built.error, status: built.status ?? 400 };
      const row = await prisma.medicineLog.update({
        where: { id: activityId },
        data: built.data!,
        include: { medicine: { select: { name: true, isSupplement: true } } },
      });
      return { result: summary(type, row.id, row.babyId, 'updated', row.time, { medicineName: row.medicine.name, doseAmount: row.doseAmount, unitAbbr: row.unitAbbr, notes: row.notes }) };
    }
  }
}

async function deleteActivity(existing: FoundActivity): Promise<void> {
  switch (existing.type) {
    case 'feed':
      await prisma.feedLog.delete({ where: { id: existing.id } });
      return;
    case 'diaper':
      await prisma.diaperLog.delete({ where: { id: existing.id } });
      return;
    case 'sleep':
      await prisma.sleepLog.delete({ where: { id: existing.id } });
      return;
    case 'note':
      await prisma.note.delete({ where: { id: existing.id } });
      return;
    case 'pump':
      await prisma.pumpLog.delete({ where: { id: existing.id } });
      return;
    case 'play':
      await prisma.playLog.delete({ where: { id: existing.id } });
      return;
    case 'bath':
      await prisma.bathLog.delete({ where: { id: existing.id } });
      return;
    case 'measurement':
      await prisma.measurement.delete({ where: { id: existing.id } });
      return;
    case 'medicine':
    case 'supplement':
      await prisma.medicineLog.delete({ where: { id: existing.id } });
      return;
  }
}

async function readJsonBody(req: NextRequest): Promise<{ body?: JsonObject; error?: string }> {
  try {
    const value = await req.json();
    if (!isJsonObject(value)) return { error: 'Request body must be a JSON object' };
    return { body: value };
  } catch {
    return { error: 'Request body must be valid JSON' };
  }
}

async function handlePut(req: NextRequest, ctx: ApiKeyContext, routeContext?: RouteContext) {
  const rl = checkRateLimit(ctx.keyId, 'PUT');
  if (!rl.allowed) return rl.response!;

  const params = await routeContext?.params;
  const babyId = params?.babyId;
  const activityId = params?.activityId;
  if (!babyId || !activityId) return hookError('INVALID_ROUTE', 'babyId and activityId are required', 400, rl.headers);

  const access = await validateBabyAccess(babyId, ctx);
  if (!access.valid) return access.error!;

  const parsed = await readJsonBody(req);
  if (parsed.error) return hookError('INVALID_JSON', parsed.error, 400, rl.headers);
  const body = parsed.body!;
  const type = parseActivityType(body.type);
  if (!type) return hookError('INVALID_ACTIVITY_TYPE', `type is required and must be one of: ${VALID_TYPES.join(', ')}`, 400, rl.headers);

  const fieldError = rejectUnknownFields(type, body);
  if (fieldError) return hookError('INVALID_FIELD', fieldError, 400, rl.headers);

  try {
    const updated = await updateActivity(type, activityId, babyId, ctx.familyId, body);
    if (updated.error) return hookError(updated.status === 404 ? 'ACTIVITY_NOT_FOUND' : 'INVALID_UPDATE', updated.error, updated.status ?? 400, rl.headers);
    return hookSuccess(updated.result!, { familyId: ctx.familyId, babyId }, rl.headers);
  } catch (error) {
    console.error('Error updating activity via hooks API:', error);
    return hookError('INTERNAL_ERROR', 'Failed to update activity', 500, rl.headers);
  }
}

async function handleDelete(req: NextRequest, ctx: ApiKeyContext, routeContext?: RouteContext) {
  const rl = checkRateLimit(ctx.keyId, 'DELETE');
  if (!rl.allowed) return rl.response!;

  const params = await routeContext?.params;
  const babyId = params?.babyId;
  const activityId = params?.activityId;
  if (!babyId || !activityId) return hookError('INVALID_ROUTE', 'babyId and activityId are required', 400, rl.headers);

  const access = await validateBabyAccess(babyId, ctx);
  if (!access.valid) return access.error!;

  try {
    const url = new URL(req.url);
    const requestedType = parseActivityType(url.searchParams.get('type'));
    const existing = requestedType
      ? await findExistingActivity(requestedType, activityId, babyId, ctx.familyId)
      : await findAnyExistingActivity(activityId, babyId, ctx.familyId);

    if (!existing) {
      return hookError('ACTIVITY_NOT_FOUND', 'Activity not found', 404, rl.headers);
    }

    await deleteActivity(existing);
    return hookSuccess(summary(existing.type, existing.id, existing.babyId, 'deleted', existing.time), { familyId: ctx.familyId, babyId }, rl.headers);
  } catch (error) {
    console.error('Error deleting activity via hooks API:', error);
    return hookError('INTERNAL_ERROR', 'Failed to delete activity', 500, rl.headers);
  }
}

export const PUT = withApiKeyAuth(handlePut, 'write');
export const DELETE = withApiKeyAuth(handleDelete, 'write');

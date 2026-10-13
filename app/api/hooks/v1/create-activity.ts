// Creates one activity from a webhook payload. Shared by POST /activities and
// POST /activities/batch, so it validates and writes but never builds an HTTP
// response: callers map the HookResult onto hookSuccess/hookError.

import prisma from '../../db';
import { notifyActivityCreated, resetTimerNotificationState } from '@/src/lib/notifications/activityHook';
import { startBreastfeedSession, updateBreastfeedSession, endBreastfeedSession } from '../../utils/activeBreastFeed';
import { BATH_TYPES, BOTTLE_TYPES, DIAPER_COLORS, DIAPER_CONDITIONS, FEED_SIDES, PUMP_ACTIONS, SLEEP_QUALITIES, normalizeEnumValue } from './field-values';
import { FOOD_FIELDS, formatFoodDetails, getDefaultSolidsUnit, loadFoodCatalog, parseEnjoyment, parseFoodAmount, parseFoodItemInputs, planFoodUnit, resolveFoodItems, resolveItemUnits } from './food';
import { buildFoodLogFoodFields, deriveMealAmountFromItems } from '@/src/utils/foodLogUtils';
import { findExistingFoodLog } from '@/scripts/convert-solids-feeds-runner';
import { resolveCatalogFoodName } from '@/scripts/convert-solids-feeds-core';
import { ACTIVITY_TYPES as VALID_TYPES, ActivityType } from './pagination';

export type HookResult =
  | { ok: true; data: Record<string, any> }
  | { ok: false; code: string; message: string; status: number };

const ok = (data: Record<string, any>): HookResult => ({ ok: true, data });
const fail = (code: string, message: string, status: number): HookResult => ({ ok: false, code, message, status });

export interface CreateActivityTarget {
  familyId: string;
  babyId: string;
}

export interface CreateActivityOptions {
  // Push notifications and timer-notification resets. Off for batch imports,
  // which carry historical entries.
  notify: boolean;
  // Breastfeed/sleep/pump timer actions (start, end, ...). Off for batch.
  allowTimers: boolean;
}

const skipNotify: typeof notifyActivityCreated = async () => {};
const skipTimerReset: typeof resetTimerNotificationState = async () => {};

// Fields each POST handler actually consumes, plus the shared fields
// (type/time/caretakerName, and action where the type supports one).
// Anything outside this list is rejected by rejectUnknownFields below
// instead of being silently accepted and dropped.
const TYPE_FIELDS: Record<ActivityType, readonly string[]> = {
  feed: ['type', 'time', 'caretakerName', 'feedType', 'amount', 'unitAbbr', 'side', 'food', 'notes', 'bottleType', 'action', 'duration'],
  diaper: ['type', 'time', 'caretakerName', 'diaperType', 'condition', 'color', 'blowout', 'creamApplied', 'notes'],
  sleep: ['type', 'time', 'caretakerName', 'sleepType', 'action', 'duration', 'location', 'quality', 'notes'],
  note: ['type', 'time', 'caretakerName', 'content', 'category'],
  pump: ['type', 'time', 'caretakerName', 'action', 'duration', 'leftAmount', 'rightAmount', 'totalAmount', 'unitAbbr', 'pumpAction'],
  play: ['type', 'time', 'caretakerName', 'playType', 'duration', 'notes', 'activities'],
  bath: ['type', 'time', 'caretakerName', 'bathType', 'soapUsed', 'shampooUsed', 'notes'],
  measurement: ['type', 'time', 'caretakerName', 'measurementType', 'value', 'unit'],
  medicine: ['type', 'time', 'caretakerName', 'medicineName', 'amount', 'unitAbbr', 'notes'],
  supplement: ['type', 'time', 'caretakerName', 'supplementName', 'medicineName', 'amount', 'unitAbbr', 'notes'],
  food: ['type', 'time', 'caretakerName', ...FOOD_FIELDS],
};

function rejectUnknownFields(type: ActivityType, body: Record<string, unknown>): string | null {
  const allowed = new Set([...TYPE_FIELDS[type], 'externalId']);
  const forbidden = Object.keys(body).filter((key) => !allowed.has(key));
  if (!forbidden.length) return null;
  return `Unsupported field(s) for ${type}: ${forbidden.join(', ')}`;
}

// Distinguishes undefined/null (no value supplied) from an explicit numeric
// value, including 0, so callers can tell "not sent" from "sent as zero".
function parseAmount(value: unknown, field: string): { value?: number | null; error?: string } {
  if (value === undefined || value === null) return { value: null };
  const num = typeof value === 'number' ? value : (typeof value === 'string' && value.trim() ? Number(value) : NaN);
  if (!Number.isFinite(num)) return { error: `${field} must be a finite number` };
  return { value: num };
}

// A field that is present must be a real boolean; omission is left to the
// caller (each type has its own documented default for a missing value).
function requireBooleanIfPresent(value: unknown, field: string): { error?: string } {
  if (value === undefined) return {};
  if (typeof value !== 'boolean') return { error: `${field} must be a boolean` };
  return {};
}

// Free-text fields are optional, so absent/null is fine, but a non-string
// value must be rejected here rather than reaching Prisma as an unhandled 500.
function requireStringIfPresent(value: unknown, field: string): { error?: string } {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'string') return { error: `${field} must be a string` };
  return {};
}

// Pump sides + total: totalAmount is a writable input (not just derived),
// an explicit value for it always wins over the sum of sides, and an
// explicit 0 on either side is stored as 0 rather than erased to null.
function computePumpAmounts(
  leftAmount: unknown,
  rightAmount: unknown,
  totalAmount: unknown
): { left: number | null; right: number | null; total: number | null; error?: string } {
  const leftParsed = parseAmount(leftAmount, 'leftAmount');
  if (leftParsed.error) return { left: null, right: null, total: null, error: leftParsed.error };
  const rightParsed = parseAmount(rightAmount, 'rightAmount');
  if (rightParsed.error) return { left: null, right: null, total: null, error: rightParsed.error };
  const totalParsed = parseAmount(totalAmount, 'totalAmount');
  if (totalParsed.error) return { left: null, right: null, total: null, error: totalParsed.error };

  const left = leftParsed.value ?? null;
  const right = rightParsed.value ?? null;
  let total: number | null;
  if (totalParsed.value !== null && totalParsed.value !== undefined) {
    total = totalParsed.value;
  } else if (left !== null || right !== null) {
    total = (left || 0) + (right || 0);
  } else {
    total = null;
  }
  return { left, right, total };
}

// ── Helper: normalize an optional enum-like field, case-insensitively, to its
// canonical casing. Absent/null/empty is left alone; a value that doesn't
// match any allowed entry is an error naming the valid set. ──
function normalizeRequiredEnumIfPresent(
  value: unknown,
  field: string,
  allowed: readonly string[]
): { value: string | null; error?: string } {
  if (value === undefined || value === null || value === '') return { value: null };
  if (typeof value !== 'string') return { value: null, error: `${field} must be a string` };
  const normalized = normalizeEnumValue(value, allowed);
  if (!normalized) return { value: null, error: `${field} must be one of: ${allowed.join(', ')}` };
  return { value: normalized };
}

// ── Helper: resolve unitAbbr against the Unit table (case-insensitive, canonical casing) ──
async function resolveUnitAbbr(unitAbbr: unknown): Promise<{ value: string | null; error?: string }> {
  if (unitAbbr === undefined || unitAbbr === null || unitAbbr === '') return { value: null };
  if (typeof unitAbbr !== 'string') return { value: null, error: 'unitAbbr must be a string' };
  const units = await prisma.unit.findMany({ select: { unitAbbr: true } });
  const abbrs = units.map((u) => u.unitAbbr);
  const normalized = normalizeEnumValue(unitAbbr, abbrs);
  if (!normalized) {
    return { value: null, error: `unitAbbr must be one of: ${abbrs.join(', ') || 'no units configured'}` };
  }
  return { value: normalized };
}

// ── Helper: resolve caretaker by name ──
async function resolveCaretaker(name: string | undefined, familyId: string): Promise<{ id: string | null; notFound: boolean }> {
  if (!name) return { id: null, notFound: false };
  const ct = await prisma.caretaker.findFirst({
    where: {
      familyId,
      name: { equals: name },
      deletedAt: null,
    },
    select: { id: true },
  });
  return ct ? { id: ct.id, notFound: false } : { id: null, notFound: true };
}

// ── Helper: create a food log (type "food", and legacy feedType SOLIDS) ──
// Mirrors the app's meal form + /api/food-log so webhook food logs are
// indistinguishable from app-created ones (see ../../../food.ts). With
// `dedupe`, an existing log of this baby at the same time with the same foods
// is returned instead (duplicate: true), as the startup conversion does.
async function createFoodActivity(
  body: Record<string, any>,
  time: Date,
  { familyId, babyId, caretakerId }: { familyId: string; babyId: string; caretakerId: string | null },
  dedupe = false
): Promise<HookResult> {
  const { notes } = body;
  const parsedFoods = parseFoodItemInputs(body);
  if (parsedFoods.error) return fail('INVALID_FOOD', parsedFoods.error, 400);
  if (!parsedFoods.items) return fail('FOOD_REQUIRED', 'foodName, foodId, or foods[] is required for food type', 400);
  const foodAmount = parseFoodAmount(body.amount);
  if (foodAmount.error) return fail('INVALID_AMOUNT', foodAmount.error, 400);
  const enjoyment = parseEnjoyment(body.enjoyment);
  if (enjoyment.error) return fail('INVALID_ENJOYMENT', enjoyment.error, 400);
  const foodNotesCheck = requireStringIfPresent(notes, 'notes');
  if (foodNotesCheck.error) return fail('INVALID_NOTES', foodNotesCheck.error, 400);
  const foodUnitResult = await resolveUnitAbbr(body.unitAbbr);
  if (foodUnitResult.error) return fail('INVALID_UNIT', foodUnitResult.error, 400);
  const unitPlan = planFoodUnit(foodAmount.value, foodUnitResult.value);
  if (unitPlan.error) return fail('INVALID_UNIT', unitPlan.error, 400);
  const itemUnits = await resolveItemUnits(parsedFoods.items, familyId);
  if (itemUnits.error) return fail('INVALID_UNIT', itemUnits.error, 400);

  const existing = dedupe
    ? await findExistingFoodLog(prisma, { familyId, babyId, time, names: parsedFoods.items.map((item) => item.name ?? '') })
    : null;
  // Catalog foods are created only after every other field validated
  const resolvedFoods = existing ? null : await resolveFoodItems(itemUnits.items!, familyId);
  if (resolvedFoods?.error) return fail('FOOD_NOT_FOUND', resolvedFoods.error, 404);
  // Per-food amounts (#271) define the row total, as in /api/food-log
  const itemAmount = resolvedFoods ? deriveMealAmountFromItems(resolvedFoods.items!) : null;

  const result = existing ?? await prisma.foodLog.create({
    data: {
      time,
      ...buildFoodLogFoodFields(resolvedFoods!.items!),
      amount: itemAmount ? itemAmount.amount : foodAmount.value ?? null,
      unitAbbr: itemAmount ? itemAmount.unitAbbr : unitPlan.useDefault ? await getDefaultSolidsUnit(familyId) : unitPlan.unitAbbr ?? null,
      enjoyment: enjoyment.value ?? null,
      notes: notes && notes.trim() ? notes.trim() : null,
      babyId,
      caretakerId,
      familyId,
    },
  });
  const foodCatalog = await loadFoodCatalog(familyId, [result]);
  return ok({ activityType: 'food', id: result.id, time: result.time.toISOString(), details: formatFoodDetails(result, foodCatalog), ...(existing ? { duplicate: true } : {}) });
}

// ── GET handler ──

async function createActivity(body: any, { familyId, babyId }: CreateActivityTarget, options: CreateActivityOptions): Promise<HookResult> {
  const notify = options.notify ? notifyActivityCreated : skipNotify;
  const resetTimer = options.notify ? resetTimerNotificationState : skipTimerReset;

  const { type, time: timeStr, caretakerName } = body;
  if (!type || !VALID_TYPES.includes(type)) {
    return fail('INVALID_ACTIVITY_TYPE', `Unknown activity type: '${type}'. Valid types: ${VALID_TYPES.join(', ')}`, 400);
  }

  const fieldError = rejectUnknownFields(type as ActivityType, body);
  if (fieldError) {
    return fail('INVALID_FIELD', fieldError, 400);
  }

  if (!options.allowTimers && body.action !== undefined && body.action !== 'log') {
    return fail('INVALID_ACTION', 'Timer actions are not supported here. Send completed entries (action "log").', 400);
  }

  const time = timeStr ? new Date(timeStr) : new Date();
  if (isNaN(time.getTime())) {
    return fail('INVALID_TIME', 'Invalid time format. Use ISO 8601.', 400);
  }

  const caretakerResult = await resolveCaretaker(caretakerName, familyId);
  if (caretakerResult.notFound) {
    const available = await prisma.caretaker.findMany({
      where: { familyId, deletedAt: null },
      select: { name: true },
    });
    const names = available.map((c) => c.name).join(', ');
    return fail('CARETAKER_NOT_FOUND', `Caretaker '${caretakerName}' not found. Available: ${names || 'none'}`, 400);
  }
  const caretakerId = caretakerResult.id;

  try {
    let result: any;

    switch (type as ActivityType) {
      case 'feed': {
        let { feedType, amount, unitAbbr, side, food, notes, bottleType, action, duration } = body;
        // Map friendly names to DB enum + bottleType
        const FEED_ALIASES: Record<string, { feedType: string; bottleType?: string }> = {
          'BREAST': { feedType: 'BREAST' },
          'breast': { feedType: 'BREAST' },
          'BOTTLE': { feedType: 'BOTTLE' },
          'bottle': { feedType: 'BOTTLE' },
          'SOLIDS': { feedType: 'SOLIDS' },
          'solids': { feedType: 'SOLIDS' },
          'formula': { feedType: 'BOTTLE', bottleType: 'formula' },
          'breast milk': { feedType: 'BOTTLE', bottleType: 'breast milk' },
          'milk': { feedType: 'BOTTLE', bottleType: 'milk' },
          'other': { feedType: 'BOTTLE', bottleType: 'other' },
        };
        const alias = feedType ? (FEED_ALIASES[feedType] ?? FEED_ALIASES[String(feedType).toLowerCase()]) : undefined;
        if (!alias) {
          return fail('INVALID_FEED_TYPE', 'feedType must be BREAST, BOTTLE, SOLIDS, formula, breast milk, milk, or other', 400);
        }
        feedType = alias.feedType;
        if (alias.bottleType && !bottleType) bottleType = alias.bottleType;

        // Timer actions (BREAST only) — backed by the same ActiveBreastFeed
        // session as the in-app timer, so both surfaces stay in sync
        const TIMER_ACTIONS = ['start', 'switch', 'pause', 'resume', 'end'];
        if (action && !TIMER_ACTIONS.includes(action) && action !== 'log') {
          return fail('INVALID_ACTION', 'action must be start, switch, pause, resume, end, or log', 400);
        }
        if (action && action !== 'log' && feedType !== 'BREAST') {
          return fail('INVALID_ACTION', `Timer actions are only supported for feedType BREAST, got '${feedType}'`, 400);
        }

        if (feedType === 'BREAST' && action && action !== 'log') {
          if (action === 'start') {
            const startSide = side ? normalizeEnumValue(side, FEED_SIDES) : null;
            if (!startSide) {
              return fail('SIDE_REQUIRED', 'side (LEFT or RIGHT) is required for action "start"', 400);
            }
            side = startSide;
            const existing = await prisma.activeBreastFeed.findUnique({ where: { babyId } });
            if (existing) {
              return fail('FEED_ALREADY_ACTIVE', 'An active breastfeed session already exists for this baby', 409);
            }
            let session;
            try {
              session = await startBreastfeedSession({ babyId, side, familyId, caretakerId });
            } catch (e: any) {
              // Concurrent starts race on the babyId unique constraint
              if (e?.code === 'P2002') {
                return fail('FEED_ALREADY_ACTIVE', 'An active breastfeed session already exists for this baby', 409);
              }
              throw e;
            }
            return ok({ activityType: 'feed', id: session.id, time: session.sessionStartTime.toISOString(), details: { type: 'BREAST', action: 'start', activeSide: session.activeSide, isActive: true } });
          }

          const session = await prisma.activeBreastFeed.findUnique({ where: { babyId } });
          if (!session || session.familyId !== familyId) {
            return fail('NO_ACTIVE_FEED', 'No active breastfeed session found for this baby', 400);
          }

          if (action === 'end') {
            const { feedLogs, leftDuration, rightDuration } = await endBreastfeedSession(session, { familyId, caretakerId });
            return ok({
              activityType: 'feed',
              time: session.sessionStartTime.toISOString(),
              details: { type: 'BREAST', action: 'end', leftDuration, rightDuration, isActive: false, feedLogs },
            });
          }

          // switch / pause / resume
          if ((action === 'resume' || action === 'switch') && side) {
            const normalizedSide = normalizeEnumValue(side, FEED_SIDES);
            if (!normalizedSide) {
              return fail('INVALID_SIDE', 'side must be LEFT or RIGHT', 400);
            }
            side = normalizedSide;
          }
          const updated = await updateBreastfeedSession(session, action, action === 'resume' ? side : undefined);
          return ok({
            activityType: 'feed',
            id: updated!.id,
            time: updated!.sessionStartTime.toISOString(),
            details: { type: 'BREAST', action, activeSide: updated!.activeSide, isPaused: updated!.isPaused, leftDuration: updated!.leftDuration, rightDuration: updated!.rightDuration, isActive: true },
          });
        }

        // Legacy SOLIDS feeds are stored as food logs (the startup conversion
        // would otherwise turn the feed into one and delete it). Same mapping as
        // the conversion: the food text is one food ('Solids' when blank), and a
        // non-positive amount is dropped with its unit. side/bottleType/duration
        // don't apply to solids and are ignored, as the conversion drops them.
        if (feedType === 'SOLIDS') {
          const solidsAmount = parseAmount(amount, 'amount');
          if (solidsAmount.error) return fail('INVALID_AMOUNT', solidsAmount.error, 400);
          const eaten = solidsAmount.value != null && solidsAmount.value > 0;
          return createFoodActivity(
            { foodName: resolveCatalogFoodName({ food }).name, notes, ...(eaten ? { amount: solidsAmount.value, unitAbbr } : {}) },
            time, { familyId, babyId, caretakerId }, true
          );
        }

        // action === 'log' or omitted: create a completed feed entry.
        // For BREAST an optional duration (minutes, like sleep/pump) produces
        // a timed entry: startTime = time, endTime = time + duration.
        let timedFields: any = {};
        if (feedType === 'BREAST' && duration !== undefined && duration !== null) {
          if (typeof duration !== 'number' || duration <= 0) {
            return fail('INVALID_DURATION', 'duration must be a positive number of minutes', 400);
          }
          timedFields = {
            startTime: time,
            endTime: new Date(time.getTime() + duration * 60000),
            feedDuration: Math.round(duration * 60), // stored in seconds
          };
        }

        const feedAmount = parseAmount(amount, 'amount');
        if (feedAmount.error) {
          return fail('INVALID_AMOUNT', feedAmount.error, 400);
        }

        const bottleTypeResult = normalizeRequiredEnumIfPresent(bottleType, 'bottleType', BOTTLE_TYPES);
        if (bottleTypeResult.error) return fail('INVALID_BOTTLE_TYPE', bottleTypeResult.error, 400);
        bottleType = bottleTypeResult.value;
        const sideResult = normalizeRequiredEnumIfPresent(side, 'side', FEED_SIDES);
        if (sideResult.error) return fail('INVALID_SIDE', sideResult.error, 400);
        side = sideResult.value;
        const unitResult = await resolveUnitAbbr(unitAbbr);
        if (unitResult.error) {
          return fail('INVALID_UNIT', unitResult.error, 400);
        }
        unitAbbr = unitResult.value;

        result = await prisma.feedLog.create({
          data: { time, type: feedType, amount: feedAmount.value, unitAbbr: unitAbbr || null, side: side || null, food: food || null, notes: notes || null, bottleType: bottleType || null, ...timedFields, babyId, caretakerId, familyId },
        });
        notify(babyId, 'feed', { caretakerId }, { type: feedType, amount: result.amount, unitAbbr, food, side }).catch(console.error);
        resetTimer(babyId, 'feed').catch(console.error);
        return ok({ activityType: 'feed', id: result.id, time: result.time.toISOString(), details: { type: feedType, amount: result.amount, unitAbbr, bottleType, side, food, ...(result.feedDuration ? { duration, feedDuration: result.feedDuration } : {}) } });
      }

      case 'diaper': {
        const { diaperType, condition, color, blowout, creamApplied, notes } = body;
        if (!diaperType || !['WET', 'DIRTY', 'BOTH', 'DRY'].includes(diaperType)) {
          return fail('INVALID_DIAPER_TYPE', 'diaperType must be WET, DIRTY, BOTH, or DRY', 400);
        }
        const blowoutCheck = requireBooleanIfPresent(blowout, 'blowout');
        if (blowoutCheck.error) return fail('INVALID_FIELD', blowoutCheck.error, 400);
        const creamCheck = requireBooleanIfPresent(creamApplied, 'creamApplied');
        if (creamCheck.error) return fail('INVALID_FIELD', creamCheck.error, 400);
        const diaperNotesCheck = requireStringIfPresent(notes, 'notes');
        if (diaperNotesCheck.error) return fail('INVALID_NOTES', diaperNotesCheck.error, 400);
        const conditionResult = normalizeRequiredEnumIfPresent(condition, 'condition', DIAPER_CONDITIONS);
        if (conditionResult.error) return fail('INVALID_CONDITION', conditionResult.error, 400);
        const colorResult = normalizeRequiredEnumIfPresent(color, 'color', DIAPER_COLORS);
        if (colorResult.error) return fail('INVALID_COLOR', colorResult.error, 400);

        result = await prisma.diaperLog.create({
          data: { time, type: diaperType, condition: conditionResult.value, color: colorResult.value, blowout: blowout === true, creamApplied: creamApplied === true, notes: notes || null, babyId, caretakerId, familyId },
        });
        notify(babyId, 'diaper', { caretakerId }, { type: diaperType }).catch(console.error);
        resetTimer(babyId, 'diaper').catch(console.error);
        return ok({ activityType: 'diaper', id: result.id, time: result.time.toISOString(), details: { type: diaperType, condition: conditionResult.value, color: colorResult.value, blowout: result.blowout, creamApplied: result.creamApplied, notes: result.notes } });
      }

      case 'sleep': {
        const { sleepType, action, duration: sleepDuration, location, notes } = body;
        let { quality } = body;
        if (!action || !['start', 'end', 'log'].includes(action)) {
          return fail('INVALID_ACTION', 'action must be start, end, or log', 400);
        }
        if (sleepType && !['NAP', 'NIGHT_SLEEP'].includes(sleepType)) {
          return fail('INVALID_SLEEP_TYPE', 'sleepType must be NAP or NIGHT_SLEEP', 400);
        }
        if (action !== 'end' && !sleepType) {
          return fail('INVALID_SLEEP_TYPE', 'sleepType is required for start and log actions', 400);
        }
        const qualityResult = normalizeRequiredEnumIfPresent(quality, 'quality', SLEEP_QUALITIES);
        if (qualityResult.error) return fail('INVALID_QUALITY', qualityResult.error, 400);
        quality = qualityResult.value;
        const sleepNotesCheck = requireStringIfPresent(notes, 'notes');
        if (sleepNotesCheck.error) return fail('INVALID_NOTES', sleepNotesCheck.error, 400);

        if (action === 'start') {
          result = await prisma.sleepLog.create({
            data: { startTime: time, type: sleepType, location: location || null, quality: quality || null, notes: notes || null, babyId, caretakerId, familyId },
          });
          notify(babyId, 'sleep', { caretakerId }, { type: sleepType }).catch(console.error);
          return ok({ activityType: 'sleep', id: result.id, time: result.startTime.toISOString(), details: { type: sleepType, action: 'start', isActive: true, notes: result.notes } });
        }

        if (action === 'end') {
          // Find the most recent active sleep for this baby
          const activeSleep = await prisma.sleepLog.findFirst({
            where: { babyId, endTime: null, deletedAt: null },
            orderBy: { startTime: 'desc' },
          });
          if (!activeSleep) {
            return fail('NO_ACTIVE_SLEEP', 'No active sleep session found to end', 400);
          }
          const dur = Math.round((time.getTime() - activeSleep.startTime.getTime()) / 60000);
          result = await prisma.sleepLog.update({
            where: { id: activeSleep.id },
            data: { endTime: time, duration: dur, quality: quality || activeSleep.quality, notes: notes !== undefined ? (notes || null) : activeSleep.notes, ...(sleepType && { type: sleepType }) },
          });
          notify(babyId, 'wake', { caretakerId }, { duration: dur }).catch(console.error);
          return ok({ activityType: 'sleep', id: result.id, time: result.startTime.toISOString(), details: { type: result.type, action: 'end', duration: dur, isActive: false, notes: result.notes } });
        }

        // action === 'log'
        if (!sleepDuration || typeof sleepDuration !== 'number') {
          return fail('DURATION_REQUIRED', 'duration (in minutes) is required for action "log"', 400);
        }
        const endTime = new Date(time.getTime() + sleepDuration * 60000);
        const startTime = time;
        result = await prisma.sleepLog.create({
          data: { startTime, endTime, duration: sleepDuration, type: sleepType, location: location || null, quality: quality || null, notes: notes || null, babyId, caretakerId, familyId },
        });
        notify(babyId, 'sleep', { caretakerId }, { type: sleepType }).catch(console.error);
        return ok({ activityType: 'sleep', id: result.id, time: result.startTime.toISOString(), details: { type: sleepType, action: 'log', duration: sleepDuration, isActive: false, notes: result.notes } });
      }

      case 'note': {
        const { content, category } = body;
        if (!content || typeof content !== 'string') {
          return fail('CONTENT_REQUIRED', 'content is required for note type', 400);
        }
        result = await prisma.note.create({
          data: { time, content, category: category || null, babyId, caretakerId, familyId },
        });
        notify(babyId, 'note', { caretakerId }, { content }).catch(console.error);
        return ok({ activityType: 'note', id: result.id, time: result.time.toISOString(), details: { content, category } });
      }

      case 'pump': {
        const { action, duration: pumpDuration, leftAmount, rightAmount, totalAmount, pumpAction } = body;
        let { unitAbbr } = body;
        if (!action || !['start', 'end', 'log'].includes(action)) {
          return fail('INVALID_ACTION', 'action must be start, end, or log', 400);
        }
        const pumpUnitResult = await resolveUnitAbbr(unitAbbr);
        if (pumpUnitResult.error) return fail('INVALID_UNIT', pumpUnitResult.error, 400);
        unitAbbr = pumpUnitResult.value;
        const pumpActionResult = normalizeRequiredEnumIfPresent(pumpAction, 'pumpAction', PUMP_ACTIONS);
        if (pumpActionResult.error) return fail('INVALID_PUMP_ACTION', pumpActionResult.error, 400);
        const resolvedPumpAction = pumpActionResult.value ?? 'STORED';

        if (action === 'start') {
          result = await prisma.pumpLog.create({
            data: { startTime: time, babyId, caretakerId, familyId },
          });
          return ok({ activityType: 'pump', id: result.id, time: result.startTime.toISOString(), details: { action: 'start', isActive: true } });
        }

        if (action === 'end') {
          const activePump = await prisma.pumpLog.findFirst({
            where: { babyId, endTime: null, deletedAt: null },
            orderBy: { startTime: 'desc' },
          });
          if (!activePump) {
            return fail('NO_ACTIVE_PUMP', 'No active pump session found to end', 400);
          }
          const dur = Math.round((time.getTime() - activePump.startTime.getTime()) / 60000);
          const endAmounts = computePumpAmounts(leftAmount, rightAmount, totalAmount);
          if (endAmounts.error) {
            return fail('INVALID_AMOUNT', endAmounts.error, 400);
          }
          result = await prisma.pumpLog.update({
            where: { id: activePump.id },
            data: { endTime: time, duration: dur, leftAmount: endAmounts.left, rightAmount: endAmounts.right, totalAmount: endAmounts.total, unitAbbr: unitAbbr || null, pumpAction: resolvedPumpAction },
          });
          notify(babyId, 'pump', { caretakerId }, { totalAmount: endAmounts.total, unitAbbr }).catch(console.error);
          return ok({ activityType: 'pump', id: result.id, time: result.startTime.toISOString(), details: { action: 'end', duration: dur, isActive: false } });
        }

        // action === 'log'
        const logAmounts = computePumpAmounts(leftAmount, rightAmount, totalAmount);
        if (logAmounts.error) {
          return fail('INVALID_AMOUNT', logAmounts.error, 400);
        }
        const endTime = pumpDuration ? new Date(time.getTime() + pumpDuration * 60000) : time;
        result = await prisma.pumpLog.create({
          data: { startTime: time, endTime, duration: pumpDuration || null, leftAmount: logAmounts.left, rightAmount: logAmounts.right, totalAmount: logAmounts.total, unitAbbr: unitAbbr || null, pumpAction: resolvedPumpAction, babyId, caretakerId, familyId },
        });
        notify(babyId, 'pump', { caretakerId }, { totalAmount: logAmounts.total, unitAbbr }).catch(console.error);
        return ok({ activityType: 'pump', id: result.id, time: result.startTime.toISOString(), details: { action: 'log', duration: pumpDuration } });
      }

      case 'bath': {
        const { soapUsed, shampooUsed, notes } = body;
        let { bathType } = body;
        const soapCheck = requireBooleanIfPresent(soapUsed, 'soapUsed');
        if (soapCheck.error) return fail('INVALID_FIELD', soapCheck.error, 400);
        const shampooCheck = requireBooleanIfPresent(shampooUsed, 'shampooUsed');
        if (shampooCheck.error) return fail('INVALID_FIELD', shampooCheck.error, 400);
        // Known bath types are normalized to their canonical casing; unknown
        // values are passed through verbatim — the app allows custom types.
        if (typeof bathType === 'string' && bathType) bathType = normalizeEnumValue(bathType, BATH_TYPES) ?? bathType;

        result = await prisma.bathLog.create({
          data: { time, bathType: bathType || null, soapUsed: soapUsed !== false, shampooUsed: shampooUsed !== false, notes: notes || null, babyId, caretakerId, familyId },
        });
        notify(babyId, 'bath', { caretakerId }).catch(console.error);
        return ok({ activityType: 'bath', id: result.id, time: result.time.toISOString(), details: { bathType: result.bathType, soapUsed: result.soapUsed, shampooUsed: result.shampooUsed } });
      }

      case 'measurement': {
        const { measurementType, value, unit } = body;
        if (!measurementType || !['WEIGHT', 'HEIGHT', 'HEAD_CIRCUMFERENCE', 'TEMPERATURE'].includes(measurementType)) {
          return fail('INVALID_MEASUREMENT_TYPE', 'measurementType must be WEIGHT, HEIGHT, HEAD_CIRCUMFERENCE, or TEMPERATURE', 400);
        }
        const parsedValue = parseAmount(value, 'value');
        if (parsedValue.error) {
          return fail('INVALID_VALUE', parsedValue.error, 400);
        }
        if (parsedValue.value === null || parsedValue.value === undefined) {
          return fail('VALUE_REQUIRED', 'value is required for measurement type', 400);
        }
        result = await prisma.measurement.create({
          data: { date: time, type: measurementType, value: parsedValue.value, unit: unit || '', babyId, caretakerId, familyId },
        });
        return ok({ activityType: 'measurement', id: result.id, time: result.date.toISOString(), details: { type: measurementType, value: result.value, unit: result.unit } });
      }

      case 'medicine': {
        const { medicineName, amount, notes } = body;
        let { unitAbbr } = body;
        if (!medicineName) {
          return fail('MEDICINE_NAME_REQUIRED', 'medicineName is required', 400);
        }
        // doseAmount is a non-nullable Float on MedicineLog: an omitted or
        // null amount must be rejected rather than silently fabricating a
        // recorded dose of zero.
        const doseAmount = parseAmount(amount, 'amount');
        if (doseAmount.error) {
          return fail('INVALID_AMOUNT', doseAmount.error, 400);
        }
        if (doseAmount.value === null || doseAmount.value === undefined) {
          return fail('INVALID_AMOUNT', 'amount is required for medicine type', 400);
        }
        const medicineUnitResult = await resolveUnitAbbr(unitAbbr);
        if (medicineUnitResult.error) return fail('INVALID_UNIT', medicineUnitResult.error, 400);
        unitAbbr = medicineUnitResult.value;
        const medicine = await prisma.medicine.findFirst({
          where: {
            familyId,
            name: { equals: medicineName },
            isSupplement: false,
            deletedAt: null,
          },
        });
        if (!medicine) {
          const available = await prisma.medicine.findMany({
            where: { familyId, deletedAt: null, active: true, isSupplement: false },
            select: { name: true },
          });
          const names = available.map((m) => m.name).join(', ');
          return fail('MEDICINE_NOT_FOUND', `Medicine '${medicineName}' not found. Available: ${names || 'none'}`, 404);
        }
        result = await prisma.medicineLog.create({
          data: { time, doseAmount: doseAmount.value, unitAbbr: unitAbbr || medicine.unitAbbr || null, notes: notes || null, medicineId: medicine.id, babyId, caretakerId, familyId },
        });
        notify(babyId, 'medicine', { caretakerId }, { medicineId: medicine.id, medicineName: medicine.name }).catch(console.error);
        resetTimer(babyId, 'medicine').catch(console.error);
        return ok({ activityType: 'medicine', id: result.id, time: result.time.toISOString(), details: { medicineName: medicine.name, doseAmount: result.doseAmount, unitAbbr: result.unitAbbr, notes: result.notes } });
      }

      case 'supplement': {
        const { supplementName, medicineName: altName, amount, notes } = body;
        let { unitAbbr } = body;
        const name = supplementName || altName;
        if (!name) {
          return fail('SUPPLEMENT_NAME_REQUIRED', 'supplementName is required', 400);
        }
        // doseAmount is a non-nullable Float on MedicineLog: an omitted or
        // null amount must be rejected rather than silently fabricating a
        // recorded dose of zero.
        const supplementDoseAmount = parseAmount(amount, 'amount');
        if (supplementDoseAmount.error) {
          return fail('INVALID_AMOUNT', supplementDoseAmount.error, 400);
        }
        if (supplementDoseAmount.value === null || supplementDoseAmount.value === undefined) {
          return fail('INVALID_AMOUNT', 'amount is required for supplement type', 400);
        }
        const supplementUnitResult = await resolveUnitAbbr(unitAbbr);
        if (supplementUnitResult.error) return fail('INVALID_UNIT', supplementUnitResult.error, 400);
        unitAbbr = supplementUnitResult.value;
        const supplement = await prisma.medicine.findFirst({
          where: {
            familyId,
            name: { equals: name },
            isSupplement: true,
            deletedAt: null,
          },
        });
        if (!supplement) {
          const available = await prisma.medicine.findMany({
            where: { familyId, deletedAt: null, active: true, isSupplement: true },
            select: { name: true },
          });
          const names = available.map((m) => m.name).join(', ');
          return fail('SUPPLEMENT_NOT_FOUND', `Supplement '${name}' not found. Available: ${names || 'none'}`, 404);
        }
        result = await prisma.medicineLog.create({
          data: { time, doseAmount: supplementDoseAmount.value, unitAbbr: unitAbbr || supplement.unitAbbr || null, notes: notes || null, medicineId: supplement.id, babyId, caretakerId, familyId },
        });
        notify(babyId, 'supplement', { caretakerId }, { medicineId: supplement.id, medicineName: supplement.name }).catch(console.error);
        resetTimer(babyId, 'medicine').catch(console.error);
        return ok({ activityType: 'supplement', id: result.id, time: result.time.toISOString(), details: { supplementName: supplement.name, doseAmount: result.doseAmount, unitAbbr: result.unitAbbr, notes: result.notes } });
      }

      case 'play': {
        const { playType, duration: playDuration, notes, activities } = body;
        if (!playType || !['TUMMY_TIME', 'INDOOR_PLAY', 'OUTDOOR_PLAY', 'WALK', 'CUSTOM'].includes(playType)) {
          return fail('INVALID_PLAY_TYPE', 'playType must be TUMMY_TIME, INDOOR_PLAY, OUTDOOR_PLAY, WALK, or CUSTOM', 400);
        }
        const endTime = playDuration ? new Date(time.getTime() + playDuration * 60000) : null;
        result = await prisma.playLog.create({
          data: { startTime: time, endTime, duration: playDuration || null, type: playType, notes: notes || null, activities: activities || null, babyId, caretakerId, familyId },
        });
        notify(babyId, 'play', { caretakerId }, { type: playType, activities }).catch(console.error);
        return ok({ activityType: 'play', id: result.id, time: result.startTime.toISOString(), details: { type: playType, duration: playDuration } });
      }

      case 'food':
        return createFoodActivity(body, time, { familyId, babyId, caretakerId });

      default:
        return fail('INVALID_ACTIVITY_TYPE', `Unhandled activity type: ${type}`, 400);
    }
  } catch (error: any) {
    console.error('Error creating activity via webhook:', error);
    return fail('INTERNAL_ERROR', 'Failed to create activity', 500);
  }
}

const EXTERNAL_ID_PROVIDER = 'webhook';
const MAX_EXTERNAL_ID_LENGTH = 255;
// A claim this old with no target was left by a request that crashed mid-create
const STALE_CLAIM_MS = 60_000;

type ExternalIdKey = { familyId: string; providerId: string; sourceEntityType: string; sourceRecordId: string };

// Claims an externalId before creating the activity, so concurrent requests with
// the same id race on the ExternalImportRecord unique key instead of both
// creating. The claim starts with an empty targetRecordId until the create lands.
async function claimExternalId(key: ExternalIdKey, babyId: string): Promise<{ claimId: string } | { result: HookResult }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const claim = await prisma.externalImportRecord.create({
        data: { ...key, sourceChildId: babyId, targetEntityType: key.sourceEntityType, targetRecordId: '' },
      });
      return { claimId: claim.id };
    } catch (error: any) {
      if (error?.code !== 'P2002') throw error;
    }
    const existing = await prisma.externalImportRecord.findUnique({ where: { familyId_providerId_sourceEntityType_sourceRecordId: key } });
    if (!existing) continue;
    if (existing.targetRecordId) {
      return { result: ok({ activityType: existing.targetEntityType, id: existing.targetRecordId, duplicate: true }) };
    }
    if (Date.now() - existing.importedAt.getTime() < STALE_CLAIM_MS) break;
    await prisma.externalImportRecord.deleteMany({ where: { id: existing.id, targetRecordId: '' } });
  }
  return { result: fail('EXTERNAL_ID_IN_PROGRESS', 'Another request with this externalId is still being processed', 409) };
}

/**
 * Creates one activity. With `externalId`, the activity is recorded in
 * ExternalImportRecord (provider "webhook", unique per family, request type and
 * externalId); sending the same externalId again returns the original activity's
 * id with `duplicate: true` instead of creating another.
 */
export async function createHookActivity(body: any, target: CreateActivityTarget, options: CreateActivityOptions): Promise<HookResult> {
  const { externalId } = body;
  if (externalId === undefined || !VALID_TYPES.includes(body.type)) return createActivity(body, target, options);
  if (typeof externalId !== 'string' || !externalId.trim() || externalId.length > MAX_EXTERNAL_ID_LENGTH) {
    return fail('INVALID_EXTERNAL_ID', `externalId must be a non-empty string of at most ${MAX_EXTERNAL_ID_LENGTH} characters`, 400);
  }
  if (body.action !== undefined && body.action !== 'log') {
    return fail('INVALID_EXTERNAL_ID', 'externalId only applies to completed entries (no action, or action "log")', 400);
  }

  const key = { familyId: target.familyId, providerId: EXTERNAL_ID_PROVIDER, sourceEntityType: body.type, sourceRecordId: externalId };
  const claim = await claimExternalId(key, target.babyId);
  if ('result' in claim) return claim.result;

  const release = () => prisma.externalImportRecord.delete({ where: { id: claim.claimId } });
  let result: HookResult;
  try {
    result = await createActivity(body, target, options);
  } catch (error) {
    await release();
    throw error;
  }
  if (!result.ok || !result.data.id) {
    await release();
    return result;
  }
  await prisma.externalImportRecord.update({
    where: { id: claim.claimId },
    data: { targetEntityType: result.data.activityType, targetRecordId: result.data.id },
  });
  return result;
}

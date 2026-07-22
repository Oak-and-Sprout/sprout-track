import { NextRequest } from 'next/server';
import prisma from '../../../../../db';
import { withApiKeyAuth, ApiKeyContext, validateBabyAccess } from '../../../auth';
import { checkRateLimit } from '../../../rate-limiter';
import { hookSuccess, hookError } from '../../../response';
import { notifyActivityCreated, resetTimerNotificationState } from '@/src/lib/notifications/activityHook';
import { startBreastfeedSession, updateBreastfeedSession, endBreastfeedSession } from '../../../../../utils/activeBreastFeed';
import { BATH_TYPES, BOTTLE_TYPES, DIAPER_COLORS, DIAPER_CONDITIONS, FEED_SIDES, PUMP_ACTIONS, SLEEP_QUALITIES, normalizeEnumValue } from '../../../field-values';

const VALID_TYPES = ['sleep', 'feed', 'diaper', 'note', 'pump', 'play', 'bath', 'measurement', 'medicine', 'supplement'] as const;
type ActivityType = typeof VALID_TYPES[number];

// Fields each POST handler actually consumes, plus the shared fields
// (type/time/caretakerName, and action where the type supports one).
// Anything outside this list is rejected by rejectUnknownFields below
// instead of being silently accepted and dropped.
const TYPE_FIELDS: Record<ActivityType, readonly string[]> = {
  feed: ['type', 'time', 'caretakerName', 'feedType', 'amount', 'unitAbbr', 'side', 'food', 'notes', 'bottleType', 'action', 'duration'],
  diaper: ['type', 'time', 'caretakerName', 'diaperType', 'condition', 'color', 'blowout', 'creamApplied'],
  sleep: ['type', 'time', 'caretakerName', 'sleepType', 'action', 'duration', 'location', 'quality'],
  note: ['type', 'time', 'caretakerName', 'content', 'category'],
  pump: ['type', 'time', 'caretakerName', 'action', 'duration', 'leftAmount', 'rightAmount', 'totalAmount', 'unitAbbr', 'pumpAction'],
  play: ['type', 'time', 'caretakerName', 'playType', 'duration', 'notes', 'activities'],
  bath: ['type', 'time', 'caretakerName', 'bathType', 'soapUsed', 'shampooUsed', 'notes'],
  measurement: ['type', 'time', 'caretakerName', 'measurementType', 'value', 'unit'],
  medicine: ['type', 'time', 'caretakerName', 'medicineName', 'amount', 'unitAbbr', 'notes'],
  supplement: ['type', 'time', 'caretakerName', 'supplementName', 'medicineName', 'amount', 'unitAbbr', 'notes'],
};

function rejectUnknownFields(type: ActivityType, body: Record<string, unknown>): string | null {
  const allowed = new Set(TYPE_FIELDS[type]);
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

// ── GET handler ──
async function handleGet(req: NextRequest, ctx: ApiKeyContext, routeContext: any) {
  const rl = checkRateLimit(ctx.keyId, 'GET');
  if (!rl.allowed) return rl.response!;

  const params = await routeContext.params;
  const babyId = params.babyId;
  const access = await validateBabyAccess(babyId, ctx);
  if (!access.valid) return access.error!;

  const url = new URL(req.url);
  const typeFilter = url.searchParams.get('type') as ActivityType | null;
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '10', 10) || 10, 1), 50);
  const sinceParam = url.searchParams.get('since');
  const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 24 * 60 * 60 * 1000);

  if (typeFilter && !VALID_TYPES.includes(typeFilter)) {
    return hookError('INVALID_ACTIVITY_TYPE', `Unknown activity type: '${typeFilter}'. Valid types: ${VALID_TYPES.join(', ')}`, 400, rl.headers);
  }

  const types = typeFilter ? [typeFilter] : [...VALID_TYPES];
  const activities: any[] = [];

  const queries: Promise<void>[] = [];

  if (types.includes('feed')) {
    queries.push(
      prisma.feedLog.findMany({
        where: { babyId, deletedAt: null, time: { gte: since } },
        orderBy: { time: 'desc' },
        take: limit,
        include: { caretaker: { select: { name: true } }, unit: { select: { unitAbbr: true } } },
      }).then((rows) => {
        rows.forEach((r) => activities.push({
          activityType: 'feed',
          id: r.id,
          time: r.time.toISOString(),
          details: { type: r.type, amount: r.amount, unitAbbr: r.unit?.unitAbbr || r.unitAbbr, bottleType: r.bottleType, side: r.side, food: r.food, notes: r.notes, startTime: r.startTime?.toISOString() || null, endTime: r.endTime?.toISOString() || null, feedDuration: r.feedDuration },
          caretakerName: r.caretaker?.name || null,
        }));
      })
    );
  }

  if (types.includes('diaper')) {
    queries.push(
      prisma.diaperLog.findMany({
        where: { babyId, deletedAt: null, time: { gte: since } },
        orderBy: { time: 'desc' },
        take: limit,
        include: { caretaker: { select: { name: true } } },
      }).then((rows) => {
        rows.forEach((r) => activities.push({
          activityType: 'diaper',
          id: r.id,
          time: r.time.toISOString(),
          details: { type: r.type, condition: r.condition, color: r.color, blowout: r.blowout, creamApplied: r.creamApplied },
          caretakerName: r.caretaker?.name || null,
        }));
      })
    );
  }

  if (types.includes('sleep')) {
    queries.push(
      prisma.sleepLog.findMany({
        where: { babyId, deletedAt: null, startTime: { gte: since } },
        orderBy: { startTime: 'desc' },
        take: limit,
        include: { caretaker: { select: { name: true } } },
      }).then((rows) => {
        rows.forEach((r) => activities.push({
          activityType: 'sleep',
          id: r.id,
          time: r.startTime.toISOString(),
          details: { type: r.type, startTime: r.startTime.toISOString(), endTime: r.endTime?.toISOString() || null, duration: r.duration, location: r.location, quality: r.quality, isActive: !r.endTime },
          caretakerName: r.caretaker?.name || null,
        }));
      })
    );
  }

  if (types.includes('note')) {
    queries.push(
      prisma.note.findMany({
        where: { babyId, deletedAt: null, time: { gte: since } },
        orderBy: { time: 'desc' },
        take: limit,
        include: { caretaker: { select: { name: true } } },
      }).then((rows) => {
        rows.forEach((r) => activities.push({
          activityType: 'note',
          id: r.id,
          time: r.time.toISOString(),
          details: { content: r.content, category: r.category },
          caretakerName: r.caretaker?.name || null,
        }));
      })
    );
  }

  if (types.includes('pump')) {
    queries.push(
      prisma.pumpLog.findMany({
        where: { babyId, deletedAt: null, startTime: { gte: since } },
        orderBy: { startTime: 'desc' },
        take: limit,
        include: { caretaker: { select: { name: true } } },
      }).then((rows) => {
        rows.forEach((r) => activities.push({
          activityType: 'pump',
          id: r.id,
          time: r.startTime.toISOString(),
          details: { startTime: r.startTime.toISOString(), endTime: r.endTime?.toISOString() || null, duration: r.duration, leftAmount: r.leftAmount, rightAmount: r.rightAmount, totalAmount: r.totalAmount, unitAbbr: r.unitAbbr, pumpAction: r.pumpAction },
          caretakerName: r.caretaker?.name || null,
        }));
      })
    );
  }

  if (types.includes('bath')) {
    queries.push(
      prisma.bathLog.findMany({
        where: { babyId, deletedAt: null, time: { gte: since } },
        orderBy: { time: 'desc' },
        take: limit,
        include: { caretaker: { select: { name: true } } },
      }).then((rows) => {
        rows.forEach((r) => activities.push({
          activityType: 'bath',
          id: r.id,
          time: r.time.toISOString(),
          details: { bathType: r.bathType, soapUsed: r.soapUsed, shampooUsed: r.shampooUsed, notes: r.notes },
          caretakerName: r.caretaker?.name || null,
        }));
      })
    );
  }

  if (types.includes('measurement')) {
    queries.push(
      prisma.measurement.findMany({
        where: { babyId, deletedAt: null, date: { gte: since } },
        orderBy: { date: 'desc' },
        take: limit,
        include: { caretaker: { select: { name: true } } },
      }).then((rows) => {
        rows.forEach((r) => activities.push({
          activityType: 'measurement',
          id: r.id,
          time: r.date.toISOString(),
          details: { type: r.type, value: r.value, unit: r.unit },
          caretakerName: r.caretaker?.name || null,
        }));
      })
    );
  }

  if (types.includes('medicine')) {
    queries.push(
      prisma.medicineLog.findMany({
        where: { babyId, deletedAt: null, time: { gte: since }, medicine: { isSupplement: false } },
        orderBy: { time: 'desc' },
        take: limit,
        include: { caretaker: { select: { name: true } }, medicine: { select: { name: true } } },
      }).then((rows) => {
        rows.forEach((r) => activities.push({
          activityType: 'medicine',
          id: r.id,
          time: r.time.toISOString(),
          details: { medicineName: r.medicine?.name, doseAmount: r.doseAmount, unitAbbr: r.unitAbbr, notes: r.notes },
          caretakerName: r.caretaker?.name || null,
        }));
      })
    );
  }

  if (types.includes('supplement')) {
    queries.push(
      prisma.medicineLog.findMany({
        where: { babyId, deletedAt: null, time: { gte: since }, medicine: { isSupplement: true } },
        orderBy: { time: 'desc' },
        take: limit,
        include: { caretaker: { select: { name: true } }, medicine: { select: { name: true } } },
      }).then((rows) => {
        rows.forEach((r) => activities.push({
          activityType: 'supplement',
          id: r.id,
          time: r.time.toISOString(),
          details: { supplementName: r.medicine?.name, doseAmount: r.doseAmount, unitAbbr: r.unitAbbr, notes: r.notes },
          caretakerName: r.caretaker?.name || null,
        }));
      })
    );
  }

  if (types.includes('play')) {
    queries.push(
      prisma.playLog.findMany({
        where: { babyId, deletedAt: null, startTime: { gte: since } },
        orderBy: { startTime: 'desc' },
        take: limit,
        include: { caretaker: { select: { name: true } } },
      }).then((rows) => {
        rows.forEach((r) => activities.push({
          activityType: 'play',
          id: r.id,
          time: r.startTime.toISOString(),
          details: { type: r.type, startTime: r.startTime.toISOString(), endTime: r.endTime?.toISOString() || null, duration: r.duration, notes: r.notes },
          caretakerName: r.caretaker?.name || null,
        }));
      })
    );
  }

  await Promise.all(queries);

  // Sort by time descending and take the limit
  activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  const trimmed = activities.slice(0, limit);

  return hookSuccess(
    { activities: trimmed, count: trimmed.length, hasMore: activities.length > limit },
    { familyId: ctx.familyId, babyId },
    rl.headers
  );
}

// ── POST handler ──
async function handlePost(req: NextRequest, ctx: ApiKeyContext, routeContext: any) {
  const rl = checkRateLimit(ctx.keyId, 'POST');
  if (!rl.allowed) return rl.response!;

  const params = await routeContext.params;
  const babyId = params.babyId;
  const access = await validateBabyAccess(babyId, ctx);
  if (!access.valid) return access.error!;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return hookError('INVALID_JSON', 'Request body must be valid JSON', 400, rl.headers);
  }

  const { type, time: timeStr, caretakerName } = body;
  if (!type || !VALID_TYPES.includes(type)) {
    return hookError('INVALID_ACTIVITY_TYPE', `Unknown activity type: '${type}'. Valid types: ${VALID_TYPES.join(', ')}`, 400, rl.headers);
  }

  const fieldError = rejectUnknownFields(type as ActivityType, body);
  if (fieldError) {
    return hookError('INVALID_FIELD', fieldError, 400, rl.headers);
  }

  const time = timeStr ? new Date(timeStr) : new Date();
  if (isNaN(time.getTime())) {
    return hookError('INVALID_TIME', 'Invalid time format. Use ISO 8601.', 400, rl.headers);
  }

  const familyId = ctx.familyId;
  const caretakerResult = await resolveCaretaker(caretakerName, familyId);
  if (caretakerResult.notFound) {
    const available = await prisma.caretaker.findMany({
      where: { familyId, deletedAt: null },
      select: { name: true },
    });
    const names = available.map((c) => c.name).join(', ');
    return hookError('CARETAKER_NOT_FOUND', `Caretaker '${caretakerName}' not found. Available: ${names || 'none'}`, 400, rl.headers);
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
          return hookError('INVALID_FEED_TYPE', 'feedType must be BREAST, BOTTLE, SOLIDS, formula, breast milk, milk, or other', 400, rl.headers);
        }
        feedType = alias.feedType;
        if (alias.bottleType && !bottleType) bottleType = alias.bottleType;

        // Timer actions (BREAST only) — backed by the same ActiveBreastFeed
        // session as the in-app timer, so both surfaces stay in sync
        const TIMER_ACTIONS = ['start', 'switch', 'pause', 'resume', 'end'];
        if (action && !TIMER_ACTIONS.includes(action) && action !== 'log') {
          return hookError('INVALID_ACTION', 'action must be start, switch, pause, resume, end, or log', 400, rl.headers);
        }
        if (action && action !== 'log' && feedType !== 'BREAST') {
          return hookError('INVALID_ACTION', `Timer actions are only supported for feedType BREAST, got '${feedType}'`, 400, rl.headers);
        }

        if (feedType === 'BREAST' && action && action !== 'log') {
          if (action === 'start') {
            const startSide = side ? normalizeEnumValue(side, FEED_SIDES) : null;
            if (!startSide) {
              return hookError('SIDE_REQUIRED', 'side (LEFT or RIGHT) is required for action "start"', 400, rl.headers);
            }
            side = startSide;
            const existing = await prisma.activeBreastFeed.findUnique({ where: { babyId } });
            if (existing) {
              return hookError('FEED_ALREADY_ACTIVE', 'An active breastfeed session already exists for this baby', 409, rl.headers);
            }
            let session;
            try {
              session = await startBreastfeedSession({ babyId, side, familyId, caretakerId });
            } catch (e: any) {
              // Concurrent starts race on the babyId unique constraint
              if (e?.code === 'P2002') {
                return hookError('FEED_ALREADY_ACTIVE', 'An active breastfeed session already exists for this baby', 409, rl.headers);
              }
              throw e;
            }
            return hookSuccess({ activityType: 'feed', id: session.id, time: session.sessionStartTime.toISOString(), details: { type: 'BREAST', action: 'start', activeSide: session.activeSide, isActive: true } }, { familyId, babyId }, rl.headers);
          }

          const session = await prisma.activeBreastFeed.findUnique({ where: { babyId } });
          if (!session || session.familyId !== familyId) {
            return hookError('NO_ACTIVE_FEED', 'No active breastfeed session found for this baby', 400, rl.headers);
          }

          if (action === 'end') {
            const { feedLogs, leftDuration, rightDuration } = await endBreastfeedSession(session, { familyId, caretakerId });
            return hookSuccess({
              activityType: 'feed',
              time: session.sessionStartTime.toISOString(),
              details: { type: 'BREAST', action: 'end', leftDuration, rightDuration, isActive: false, feedLogs },
            }, { familyId, babyId }, rl.headers);
          }

          // switch / pause / resume
          if ((action === 'resume' || action === 'switch') && side) {
            const normalizedSide = normalizeEnumValue(side, FEED_SIDES);
            if (!normalizedSide) {
              return hookError('INVALID_SIDE', 'side must be LEFT or RIGHT', 400, rl.headers);
            }
            side = normalizedSide;
          }
          const updated = await updateBreastfeedSession(session, action, action === 'resume' ? side : undefined);
          return hookSuccess({
            activityType: 'feed',
            id: updated!.id,
            time: updated!.sessionStartTime.toISOString(),
            details: { type: 'BREAST', action, activeSide: updated!.activeSide, isPaused: updated!.isPaused, leftDuration: updated!.leftDuration, rightDuration: updated!.rightDuration, isActive: true },
          }, { familyId, babyId }, rl.headers);
        }

        // action === 'log' or omitted: create a completed feed entry.
        // For BREAST an optional duration (minutes, like sleep/pump) produces
        // a timed entry: startTime = time, endTime = time + duration.
        let timedFields: any = {};
        if (feedType === 'BREAST' && duration !== undefined && duration !== null) {
          if (typeof duration !== 'number' || duration <= 0) {
            return hookError('INVALID_DURATION', 'duration must be a positive number of minutes', 400, rl.headers);
          }
          timedFields = {
            startTime: time,
            endTime: new Date(time.getTime() + duration * 60000),
            feedDuration: Math.round(duration * 60), // stored in seconds
          };
        }

        const feedAmount = parseAmount(amount, 'amount');
        if (feedAmount.error) {
          return hookError('INVALID_AMOUNT', feedAmount.error, 400, rl.headers);
        }

        const bottleTypeResult = normalizeRequiredEnumIfPresent(bottleType, 'bottleType', BOTTLE_TYPES);
        if (bottleTypeResult.error) return hookError('INVALID_BOTTLE_TYPE', bottleTypeResult.error, 400, rl.headers);
        bottleType = bottleTypeResult.value;
        const sideResult = normalizeRequiredEnumIfPresent(side, 'side', FEED_SIDES);
        if (sideResult.error) return hookError('INVALID_SIDE', sideResult.error, 400, rl.headers);
        side = sideResult.value;
        const unitResult = await resolveUnitAbbr(unitAbbr);
        if (unitResult.error) {
          return hookError('INVALID_UNIT', unitResult.error, 400, rl.headers);
        }
        unitAbbr = unitResult.value;

        result = await prisma.feedLog.create({
          data: { time, type: feedType, amount: feedAmount.value, unitAbbr: unitAbbr || null, side: side || null, food: food || null, notes: notes || null, bottleType: bottleType || null, ...timedFields, babyId, caretakerId, familyId },
        });
        notifyActivityCreated(babyId, 'feed', { caretakerId }, { type: feedType, amount: result.amount, unitAbbr, food, side }).catch(console.error);
        resetTimerNotificationState(babyId, 'feed').catch(console.error);
        return hookSuccess({ activityType: 'feed', id: result.id, time: result.time.toISOString(), details: { type: feedType, amount: result.amount, unitAbbr, bottleType, side, food, ...(result.feedDuration ? { duration, feedDuration: result.feedDuration } : {}) } }, { familyId, babyId }, rl.headers);
      }

      case 'diaper': {
        const { diaperType, condition, color, blowout, creamApplied } = body;
        if (!diaperType || !['WET', 'DIRTY', 'BOTH'].includes(diaperType)) {
          return hookError('INVALID_DIAPER_TYPE', 'diaperType must be WET, DIRTY, or BOTH', 400, rl.headers);
        }
        const blowoutCheck = requireBooleanIfPresent(blowout, 'blowout');
        if (blowoutCheck.error) return hookError('INVALID_FIELD', blowoutCheck.error, 400, rl.headers);
        const creamCheck = requireBooleanIfPresent(creamApplied, 'creamApplied');
        if (creamCheck.error) return hookError('INVALID_FIELD', creamCheck.error, 400, rl.headers);
        const conditionResult = normalizeRequiredEnumIfPresent(condition, 'condition', DIAPER_CONDITIONS);
        if (conditionResult.error) return hookError('INVALID_CONDITION', conditionResult.error, 400, rl.headers);
        const colorResult = normalizeRequiredEnumIfPresent(color, 'color', DIAPER_COLORS);
        if (colorResult.error) return hookError('INVALID_COLOR', colorResult.error, 400, rl.headers);

        result = await prisma.diaperLog.create({
          data: { time, type: diaperType, condition: conditionResult.value, color: colorResult.value, blowout: blowout === true, creamApplied: creamApplied === true, babyId, caretakerId, familyId },
        });
        notifyActivityCreated(babyId, 'diaper', { caretakerId }, { type: diaperType }).catch(console.error);
        resetTimerNotificationState(babyId, 'diaper').catch(console.error);
        return hookSuccess({ activityType: 'diaper', id: result.id, time: result.time.toISOString(), details: { type: diaperType, condition: conditionResult.value, color: colorResult.value, blowout: result.blowout, creamApplied: result.creamApplied } }, { familyId, babyId }, rl.headers);
      }

      case 'sleep': {
        const { sleepType, action, duration: sleepDuration, location } = body;
        let { quality } = body;
        if (!action || !['start', 'end', 'log'].includes(action)) {
          return hookError('INVALID_ACTION', 'action must be start, end, or log', 400, rl.headers);
        }
        if (sleepType && !['NAP', 'NIGHT_SLEEP'].includes(sleepType)) {
          return hookError('INVALID_SLEEP_TYPE', 'sleepType must be NAP or NIGHT_SLEEP', 400, rl.headers);
        }
        if (action !== 'end' && !sleepType) {
          return hookError('INVALID_SLEEP_TYPE', 'sleepType is required for start and log actions', 400, rl.headers);
        }
        const qualityResult = normalizeRequiredEnumIfPresent(quality, 'quality', SLEEP_QUALITIES);
        if (qualityResult.error) return hookError('INVALID_QUALITY', qualityResult.error, 400, rl.headers);
        quality = qualityResult.value;

        if (action === 'start') {
          result = await prisma.sleepLog.create({
            data: { startTime: time, type: sleepType, location: location || null, quality: quality || null, babyId, caretakerId, familyId },
          });
          notifyActivityCreated(babyId, 'sleep', { caretakerId }, { type: sleepType }).catch(console.error);
          return hookSuccess({ activityType: 'sleep', id: result.id, time: result.startTime.toISOString(), details: { type: sleepType, action: 'start', isActive: true } }, { familyId, babyId }, rl.headers);
        }

        if (action === 'end') {
          // Find the most recent active sleep for this baby
          const activeSleep = await prisma.sleepLog.findFirst({
            where: { babyId, endTime: null, deletedAt: null },
            orderBy: { startTime: 'desc' },
          });
          if (!activeSleep) {
            return hookError('NO_ACTIVE_SLEEP', 'No active sleep session found to end', 400, rl.headers);
          }
          const dur = Math.round((time.getTime() - activeSleep.startTime.getTime()) / 60000);
          result = await prisma.sleepLog.update({
            where: { id: activeSleep.id },
            data: { endTime: time, duration: dur, quality: quality || activeSleep.quality, ...(sleepType && { type: sleepType }) },
          });
          notifyActivityCreated(babyId, 'wake', { caretakerId }, { duration: dur }).catch(console.error);
          return hookSuccess({ activityType: 'sleep', id: result.id, time: result.startTime.toISOString(), details: { type: result.type, action: 'end', duration: dur, isActive: false } }, { familyId, babyId }, rl.headers);
        }

        // action === 'log'
        if (!sleepDuration || typeof sleepDuration !== 'number') {
          return hookError('DURATION_REQUIRED', 'duration (in minutes) is required for action "log"', 400, rl.headers);
        }
        const endTime = new Date(time.getTime() + sleepDuration * 60000);
        const startTime = time;
        result = await prisma.sleepLog.create({
          data: { startTime, endTime, duration: sleepDuration, type: sleepType, location: location || null, quality: quality || null, babyId, caretakerId, familyId },
        });
        notifyActivityCreated(babyId, 'sleep', { caretakerId }, { type: sleepType }).catch(console.error);
        return hookSuccess({ activityType: 'sleep', id: result.id, time: result.startTime.toISOString(), details: { type: sleepType, action: 'log', duration: sleepDuration, isActive: false } }, { familyId, babyId }, rl.headers);
      }

      case 'note': {
        const { content, category } = body;
        if (!content || typeof content !== 'string') {
          return hookError('CONTENT_REQUIRED', 'content is required for note type', 400, rl.headers);
        }
        result = await prisma.note.create({
          data: { time, content, category: category || null, babyId, caretakerId, familyId },
        });
        notifyActivityCreated(babyId, 'note', { caretakerId }, { content }).catch(console.error);
        return hookSuccess({ activityType: 'note', id: result.id, time: result.time.toISOString(), details: { content, category } }, { familyId, babyId }, rl.headers);
      }

      case 'pump': {
        const { action, duration: pumpDuration, leftAmount, rightAmount, totalAmount, pumpAction } = body;
        let { unitAbbr } = body;
        if (!action || !['start', 'end', 'log'].includes(action)) {
          return hookError('INVALID_ACTION', 'action must be start, end, or log', 400, rl.headers);
        }
        const pumpUnitResult = await resolveUnitAbbr(unitAbbr);
        if (pumpUnitResult.error) return hookError('INVALID_UNIT', pumpUnitResult.error, 400, rl.headers);
        unitAbbr = pumpUnitResult.value;
        const pumpActionResult = normalizeRequiredEnumIfPresent(pumpAction, 'pumpAction', PUMP_ACTIONS);
        if (pumpActionResult.error) return hookError('INVALID_PUMP_ACTION', pumpActionResult.error, 400, rl.headers);
        const resolvedPumpAction = pumpActionResult.value ?? 'STORED';

        if (action === 'start') {
          result = await prisma.pumpLog.create({
            data: { startTime: time, babyId, caretakerId, familyId },
          });
          return hookSuccess({ activityType: 'pump', id: result.id, time: result.startTime.toISOString(), details: { action: 'start', isActive: true } }, { familyId, babyId }, rl.headers);
        }

        if (action === 'end') {
          const activePump = await prisma.pumpLog.findFirst({
            where: { babyId, endTime: null, deletedAt: null },
            orderBy: { startTime: 'desc' },
          });
          if (!activePump) {
            return hookError('NO_ACTIVE_PUMP', 'No active pump session found to end', 400, rl.headers);
          }
          const dur = Math.round((time.getTime() - activePump.startTime.getTime()) / 60000);
          const endAmounts = computePumpAmounts(leftAmount, rightAmount, totalAmount);
          if (endAmounts.error) {
            return hookError('INVALID_AMOUNT', endAmounts.error, 400, rl.headers);
          }
          result = await prisma.pumpLog.update({
            where: { id: activePump.id },
            data: { endTime: time, duration: dur, leftAmount: endAmounts.left, rightAmount: endAmounts.right, totalAmount: endAmounts.total, unitAbbr: unitAbbr || null, pumpAction: resolvedPumpAction },
          });
          notifyActivityCreated(babyId, 'pump', { caretakerId }, { totalAmount: endAmounts.total, unitAbbr }).catch(console.error);
          return hookSuccess({ activityType: 'pump', id: result.id, time: result.startTime.toISOString(), details: { action: 'end', duration: dur, isActive: false } }, { familyId, babyId }, rl.headers);
        }

        // action === 'log'
        const logAmounts = computePumpAmounts(leftAmount, rightAmount, totalAmount);
        if (logAmounts.error) {
          return hookError('INVALID_AMOUNT', logAmounts.error, 400, rl.headers);
        }
        const endTime = pumpDuration ? new Date(time.getTime() + pumpDuration * 60000) : time;
        result = await prisma.pumpLog.create({
          data: { startTime: time, endTime, duration: pumpDuration || null, leftAmount: logAmounts.left, rightAmount: logAmounts.right, totalAmount: logAmounts.total, unitAbbr: unitAbbr || null, pumpAction: resolvedPumpAction, babyId, caretakerId, familyId },
        });
        notifyActivityCreated(babyId, 'pump', { caretakerId }, { totalAmount: logAmounts.total, unitAbbr }).catch(console.error);
        return hookSuccess({ activityType: 'pump', id: result.id, time: result.startTime.toISOString(), details: { action: 'log', duration: pumpDuration } }, { familyId, babyId }, rl.headers);
      }

      case 'bath': {
        const { soapUsed, shampooUsed, notes } = body;
        let { bathType } = body;
        const soapCheck = requireBooleanIfPresent(soapUsed, 'soapUsed');
        if (soapCheck.error) return hookError('INVALID_FIELD', soapCheck.error, 400, rl.headers);
        const shampooCheck = requireBooleanIfPresent(shampooUsed, 'shampooUsed');
        if (shampooCheck.error) return hookError('INVALID_FIELD', shampooCheck.error, 400, rl.headers);
        // Known bath types are normalized to their canonical casing; unknown
        // values are passed through verbatim — the app allows custom types.
        if (typeof bathType === 'string' && bathType) bathType = normalizeEnumValue(bathType, BATH_TYPES) ?? bathType;

        result = await prisma.bathLog.create({
          data: { time, bathType: bathType || null, soapUsed: soapUsed !== false, shampooUsed: shampooUsed !== false, notes: notes || null, babyId, caretakerId, familyId },
        });
        notifyActivityCreated(babyId, 'bath', { caretakerId }).catch(console.error);
        return hookSuccess({ activityType: 'bath', id: result.id, time: result.time.toISOString(), details: { bathType: result.bathType, soapUsed: result.soapUsed, shampooUsed: result.shampooUsed } }, { familyId, babyId }, rl.headers);
      }

      case 'measurement': {
        const { measurementType, value, unit } = body;
        if (!measurementType || !['WEIGHT', 'HEIGHT', 'HEAD_CIRCUMFERENCE', 'TEMPERATURE'].includes(measurementType)) {
          return hookError('INVALID_MEASUREMENT_TYPE', 'measurementType must be WEIGHT, HEIGHT, HEAD_CIRCUMFERENCE, or TEMPERATURE', 400, rl.headers);
        }
        const parsedValue = parseAmount(value, 'value');
        if (parsedValue.error) {
          return hookError('INVALID_VALUE', parsedValue.error, 400, rl.headers);
        }
        if (parsedValue.value === null || parsedValue.value === undefined) {
          return hookError('VALUE_REQUIRED', 'value is required for measurement type', 400, rl.headers);
        }
        result = await prisma.measurement.create({
          data: { date: time, type: measurementType, value: parsedValue.value, unit: unit || '', babyId, caretakerId, familyId },
        });
        return hookSuccess({ activityType: 'measurement', id: result.id, time: result.date.toISOString(), details: { type: measurementType, value: result.value, unit: result.unit } }, { familyId, babyId }, rl.headers);
      }

      case 'medicine': {
        const { medicineName, amount, notes } = body;
        let { unitAbbr } = body;
        if (!medicineName) {
          return hookError('MEDICINE_NAME_REQUIRED', 'medicineName is required', 400, rl.headers);
        }
        // doseAmount is a non-nullable Float on MedicineLog: an omitted or
        // null amount must be rejected rather than silently fabricating a
        // recorded dose of zero.
        const doseAmount = parseAmount(amount, 'amount');
        if (doseAmount.error) {
          return hookError('INVALID_AMOUNT', doseAmount.error, 400, rl.headers);
        }
        if (doseAmount.value === null || doseAmount.value === undefined) {
          return hookError('INVALID_AMOUNT', 'amount is required for medicine type', 400, rl.headers);
        }
        const medicineUnitResult = await resolveUnitAbbr(unitAbbr);
        if (medicineUnitResult.error) return hookError('INVALID_UNIT', medicineUnitResult.error, 400, rl.headers);
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
          return hookError('MEDICINE_NOT_FOUND', `Medicine '${medicineName}' not found. Available: ${names || 'none'}`, 404, rl.headers);
        }
        result = await prisma.medicineLog.create({
          data: { time, doseAmount: doseAmount.value, unitAbbr: unitAbbr || medicine.unitAbbr || null, notes: notes || null, medicineId: medicine.id, babyId, caretakerId, familyId },
        });
        notifyActivityCreated(babyId, 'medicine', { caretakerId }, { medicineId: medicine.id, medicineName: medicine.name }).catch(console.error);
        resetTimerNotificationState(babyId, 'medicine').catch(console.error);
        return hookSuccess({ activityType: 'medicine', id: result.id, time: result.time.toISOString(), details: { medicineName: medicine.name, doseAmount: result.doseAmount, unitAbbr: result.unitAbbr, notes: result.notes } }, { familyId, babyId }, rl.headers);
      }

      case 'supplement': {
        const { supplementName, medicineName: altName, amount, notes } = body;
        let { unitAbbr } = body;
        const name = supplementName || altName;
        if (!name) {
          return hookError('SUPPLEMENT_NAME_REQUIRED', 'supplementName is required', 400, rl.headers);
        }
        // doseAmount is a non-nullable Float on MedicineLog: an omitted or
        // null amount must be rejected rather than silently fabricating a
        // recorded dose of zero.
        const supplementDoseAmount = parseAmount(amount, 'amount');
        if (supplementDoseAmount.error) {
          return hookError('INVALID_AMOUNT', supplementDoseAmount.error, 400, rl.headers);
        }
        if (supplementDoseAmount.value === null || supplementDoseAmount.value === undefined) {
          return hookError('INVALID_AMOUNT', 'amount is required for supplement type', 400, rl.headers);
        }
        const supplementUnitResult = await resolveUnitAbbr(unitAbbr);
        if (supplementUnitResult.error) return hookError('INVALID_UNIT', supplementUnitResult.error, 400, rl.headers);
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
          return hookError('SUPPLEMENT_NOT_FOUND', `Supplement '${name}' not found. Available: ${names || 'none'}`, 404, rl.headers);
        }
        result = await prisma.medicineLog.create({
          data: { time, doseAmount: supplementDoseAmount.value, unitAbbr: unitAbbr || supplement.unitAbbr || null, notes: notes || null, medicineId: supplement.id, babyId, caretakerId, familyId },
        });
        notifyActivityCreated(babyId, 'supplement', { caretakerId }, { medicineId: supplement.id, medicineName: supplement.name }).catch(console.error);
        resetTimerNotificationState(babyId, 'medicine').catch(console.error);
        return hookSuccess({ activityType: 'supplement', id: result.id, time: result.time.toISOString(), details: { supplementName: supplement.name, doseAmount: result.doseAmount, unitAbbr: result.unitAbbr, notes: result.notes } }, { familyId, babyId }, rl.headers);
      }

      case 'play': {
        const { playType, duration: playDuration, notes, activities } = body;
        if (!playType || !['TUMMY_TIME', 'INDOOR_PLAY', 'OUTDOOR_PLAY', 'WALK', 'CUSTOM'].includes(playType)) {
          return hookError('INVALID_PLAY_TYPE', 'playType must be TUMMY_TIME, INDOOR_PLAY, OUTDOOR_PLAY, WALK, or CUSTOM', 400, rl.headers);
        }
        const endTime = playDuration ? new Date(time.getTime() + playDuration * 60000) : null;
        result = await prisma.playLog.create({
          data: { startTime: time, endTime, duration: playDuration || null, type: playType, notes: notes || null, activities: activities || null, babyId, caretakerId, familyId },
        });
        notifyActivityCreated(babyId, 'play', { caretakerId }, { type: playType, activities }).catch(console.error);
        return hookSuccess({ activityType: 'play', id: result.id, time: result.startTime.toISOString(), details: { type: playType, duration: playDuration } }, { familyId, babyId }, rl.headers);
      }

      default:
        return hookError('INVALID_ACTIVITY_TYPE', `Unhandled activity type: ${type}`, 400, rl.headers);
    }
  } catch (error: any) {
    console.error('Error creating activity via webhook:', error);
    return hookError('INTERNAL_ERROR', 'Failed to create activity', 500, rl.headers);
  }
}

export const GET = withApiKeyAuth(handleGet, 'read');
export const POST = withApiKeyAuth(handlePost, 'write');

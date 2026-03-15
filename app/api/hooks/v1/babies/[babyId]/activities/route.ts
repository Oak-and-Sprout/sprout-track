import { NextRequest } from 'next/server';
import prisma from '../../../../../db';
import { withApiKeyAuth, ApiKeyContext, validateBabyAccess } from '../../../auth';
import { checkRateLimit } from '../../../rate-limiter';
import { hookSuccess, hookError } from '../../../response';

const VALID_TYPES = ['sleep', 'feed', 'diaper', 'note', 'pump', 'play', 'bath', 'measurement', 'medicine'] as const;
type ActivityType = typeof VALID_TYPES[number];

// ── Helper: resolve caretaker by name ──
async function resolveCaretaker(name: string | undefined, familyId: string): Promise<string | null> {
  if (!name) return null;
  const ct = await prisma.caretaker.findFirst({
    where: {
      familyId,
      name: { equals: name },
      deletedAt: null,
    },
    select: { id: true },
  });
  return ct?.id || null;
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
          details: { type: r.type, amount: r.amount, unitAbbr: r.unit?.unitAbbr || r.unitAbbr, bottleType: r.bottleType, side: r.side, food: r.food, notes: r.notes },
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
          details: { type: r.type, condition: r.condition, color: r.color, blowout: r.blowout },
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
          details: { soapUsed: r.soapUsed, shampooUsed: r.shampooUsed, notes: r.notes },
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
      }).then((rows) => {
        rows.forEach((r) => activities.push({
          activityType: 'measurement',
          id: r.id,
          time: r.date.toISOString(),
          details: { type: r.type, value: r.value, unit: r.unit },
          caretakerName: null,
        }));
      })
    );
  }

  if (types.includes('medicine')) {
    queries.push(
      prisma.medicineLog.findMany({
        where: { babyId, deletedAt: null, time: { gte: since } },
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

  const time = timeStr ? new Date(timeStr) : new Date();
  if (isNaN(time.getTime())) {
    return hookError('INVALID_TIME', 'Invalid time format. Use ISO 8601.', 400, rl.headers);
  }

  const caretakerId = await resolveCaretaker(caretakerName, ctx.familyId);
  const familyId = ctx.familyId;

  try {
    let result: any;

    switch (type as ActivityType) {
      case 'feed': {
        let { feedType, amount, unitAbbr, side, food, notes, bottleType } = body;
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
        const alias = feedType ? FEED_ALIASES[feedType] : undefined;
        if (!alias) {
          return hookError('INVALID_FEED_TYPE', 'feedType must be BREAST, BOTTLE, SOLIDS, formula, breast milk, milk, or other', 400, rl.headers);
        }
        feedType = alias.feedType;
        if (alias.bottleType && !bottleType) bottleType = alias.bottleType;

        result = await prisma.feedLog.create({
          data: { time, type: feedType, amount: amount ? parseFloat(amount) : null, unitAbbr: unitAbbr || null, side: side || null, food: food || null, notes: notes || null, bottleType: bottleType || null, babyId, caretakerId, familyId },
        });
        return hookSuccess({ activityType: 'feed', id: result.id, time: result.time.toISOString(), details: { type: feedType, amount, unitAbbr, bottleType, side, food } }, { familyId, babyId }, rl.headers);
      }

      case 'diaper': {
        const { diaperType, condition, color, blowout } = body;
        if (!diaperType || !['WET', 'DIRTY', 'BOTH'].includes(diaperType)) {
          return hookError('INVALID_DIAPER_TYPE', 'diaperType must be WET, DIRTY, or BOTH', 400, rl.headers);
        }
        result = await prisma.diaperLog.create({
          data: { time, type: diaperType, condition: condition || null, color: color || null, blowout: blowout === true, babyId, caretakerId, familyId },
        });
        return hookSuccess({ activityType: 'diaper', id: result.id, time: result.time.toISOString(), details: { type: diaperType, condition, color, blowout } }, { familyId, babyId }, rl.headers);
      }

      case 'sleep': {
        const { sleepType, action, duration: sleepDuration, location, quality } = body;
        if (!sleepType || !['NAP', 'NIGHT_SLEEP'].includes(sleepType)) {
          return hookError('INVALID_SLEEP_TYPE', 'sleepType must be NAP or NIGHT_SLEEP', 400, rl.headers);
        }
        if (!action || !['start', 'end', 'log'].includes(action)) {
          return hookError('INVALID_ACTION', 'action must be start, end, or log', 400, rl.headers);
        }

        if (action === 'start') {
          result = await prisma.sleepLog.create({
            data: { startTime: time, type: sleepType, location: location || null, quality: quality || null, babyId, caretakerId, familyId },
          });
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
            data: { endTime: time, duration: dur, quality: quality || activeSleep.quality },
          });
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
        return hookSuccess({ activityType: 'note', id: result.id, time: result.time.toISOString(), details: { content, category } }, { familyId, babyId }, rl.headers);
      }

      case 'pump': {
        const { action, duration: pumpDuration, leftAmount, rightAmount, unitAbbr, pumpAction } = body;
        if (!action || !['start', 'end', 'log'].includes(action)) {
          return hookError('INVALID_ACTION', 'action must be start, end, or log', 400, rl.headers);
        }

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
          const left = leftAmount ? parseFloat(leftAmount) : null;
          const right = rightAmount ? parseFloat(rightAmount) : null;
          const total = (left || 0) + (right || 0) || null;
          result = await prisma.pumpLog.update({
            where: { id: activePump.id },
            data: { endTime: time, duration: dur, leftAmount: left, rightAmount: right, totalAmount: total, unitAbbr: unitAbbr || null, pumpAction: pumpAction || 'STORED' },
          });
          return hookSuccess({ activityType: 'pump', id: result.id, time: result.startTime.toISOString(), details: { action: 'end', duration: dur, isActive: false } }, { familyId, babyId }, rl.headers);
        }

        // action === 'log'
        const left = leftAmount ? parseFloat(leftAmount) : null;
        const right = rightAmount ? parseFloat(rightAmount) : null;
        const total = (left || 0) + (right || 0) || null;
        const endTime = pumpDuration ? new Date(time.getTime() + pumpDuration * 60000) : time;
        result = await prisma.pumpLog.create({
          data: { startTime: time, endTime, duration: pumpDuration || null, leftAmount: left, rightAmount: right, totalAmount: total, unitAbbr: unitAbbr || null, pumpAction: pumpAction || 'STORED', babyId, caretakerId, familyId },
        });
        return hookSuccess({ activityType: 'pump', id: result.id, time: result.startTime.toISOString(), details: { action: 'log', duration: pumpDuration } }, { familyId, babyId }, rl.headers);
      }

      case 'bath': {
        const { soapUsed, shampooUsed, notes } = body;
        result = await prisma.bathLog.create({
          data: { time, soapUsed: soapUsed !== false, shampooUsed: shampooUsed !== false, notes: notes || null, babyId, caretakerId, familyId },
        });
        return hookSuccess({ activityType: 'bath', id: result.id, time: result.time.toISOString(), details: { soapUsed: result.soapUsed, shampooUsed: result.shampooUsed } }, { familyId, babyId }, rl.headers);
      }

      case 'measurement': {
        const { measurementType, value, unit } = body;
        if (!measurementType || !['WEIGHT', 'HEIGHT', 'HEAD_CIRCUMFERENCE', 'TEMPERATURE'].includes(measurementType)) {
          return hookError('INVALID_MEASUREMENT_TYPE', 'measurementType must be WEIGHT, HEIGHT, HEAD_CIRCUMFERENCE, or TEMPERATURE', 400, rl.headers);
        }
        if (value === undefined || value === null) {
          return hookError('VALUE_REQUIRED', 'value is required for measurement type', 400, rl.headers);
        }
        result = await prisma.measurement.create({
          data: { date: time, type: measurementType, value: parseFloat(value), unit: unit || '', babyId, familyId },
        });
        return hookSuccess({ activityType: 'measurement', id: result.id, time: result.date.toISOString(), details: { type: measurementType, value: result.value, unit: result.unit } }, { familyId, babyId }, rl.headers);
      }

      case 'medicine': {
        const { medicineName, amount, unitAbbr, notes } = body;
        if (!medicineName) {
          return hookError('MEDICINE_NAME_REQUIRED', 'medicineName is required', 400, rl.headers);
        }
        // Look up medicine by name (case-insensitive)
        const medicine = await prisma.medicine.findFirst({
          where: {
            familyId,
            name: { equals: medicineName },
            deletedAt: null,
          },
        });
        if (!medicine) {
          const available = await prisma.medicine.findMany({
            where: { familyId, deletedAt: null, active: true },
            select: { name: true },
          });
          const names = available.map((m) => m.name).join(', ');
          return hookError('MEDICINE_NOT_FOUND', `Medicine '${medicineName}' not found. Available: ${names || 'none'}`, 404, rl.headers);
        }
        result = await prisma.medicineLog.create({
          data: { time, doseAmount: amount ? parseFloat(amount) : 0, unitAbbr: unitAbbr || medicine.unitAbbr || null, medicineId: medicine.id, babyId, caretakerId, familyId },
        });
        return hookSuccess({ activityType: 'medicine', id: result.id, time: result.time.toISOString(), details: { medicineName: medicine.name, doseAmount: result.doseAmount, unitAbbr: result.unitAbbr } }, { familyId, babyId }, rl.headers);
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

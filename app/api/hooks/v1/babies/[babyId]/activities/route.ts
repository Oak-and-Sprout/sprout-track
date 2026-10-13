import { NextRequest } from 'next/server';
import prisma from '../../../../../db';
import { withApiKeyAuth, ApiKeyContext, validateBabyAccess } from '../../../auth';
import { checkRateLimit } from '../../../rate-limiter';
import { hookSuccess, hookError } from '../../../response';
import { formatFoodDetails, loadFoodCatalog } from '../../../food';
import { ACTIVITY_TYPES as VALID_TYPES, ActivityType, buildOrderBy, buildRangeWhere, paginate, parsePageParams } from '../../../pagination';
import { createHookActivity } from '../../../create-activity';

async function handleGet(req: NextRequest, ctx: ApiKeyContext, routeContext: any) {
  const rl = await checkRateLimit(ctx.keyId, 'GET');
  if (!rl.allowed) return rl.response!;

  const params = await routeContext.params;
  const babyId = params.babyId;
  const access = await validateBabyAccess(babyId, ctx);
  if (!access.valid) return access.error!;

  const url = new URL(req.url);
  const typeFilter = url.searchParams.get('type') as ActivityType | null;
  if (typeFilter && !VALID_TYPES.includes(typeFilter)) {
    return hookError('INVALID_ACTIVITY_TYPE', `Unknown activity type: '${typeFilter}'. Valid types: ${VALID_TYPES.join(', ')}`, 400, rl.headers);
  }

  const pageParams = parsePageParams(url.searchParams);
  if (!pageParams.ok) return hookError(pageParams.code, pageParams.message, 400, rl.headers);
  const { limit, window } = pageParams;
  // Each table returns its first limit + 1 rows in page order; see pagination.ts
  const page = (type: ActivityType, field: string, where: Record<string, unknown>) => ({
    where: { ...where, ...buildRangeWhere(type, field, window) },
    orderBy: buildOrderBy(field, window.order),
    take: limit + 1,
  });

  const types = typeFilter ? [typeFilter] : [...VALID_TYPES];
  const activities: any[] = [];

  const queries: Promise<void>[] = [];

  if (types.includes('feed')) {
    queries.push(
      prisma.feedLog.findMany({
        ...page('feed', 'time', { babyId, deletedAt: null }),
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
        ...page('diaper', 'time', { babyId, deletedAt: null }),
        include: { caretaker: { select: { name: true } } },
      }).then((rows) => {
        rows.forEach((r) => activities.push({
          activityType: 'diaper',
          id: r.id,
          time: r.time.toISOString(),
          details: { type: r.type, condition: r.condition, color: r.color, blowout: r.blowout, creamApplied: r.creamApplied, notes: r.notes },
          caretakerName: r.caretaker?.name || null,
        }));
      })
    );
  }

  if (types.includes('sleep')) {
    queries.push(
      prisma.sleepLog.findMany({
        ...page('sleep', 'startTime', { babyId, deletedAt: null }),
        include: { caretaker: { select: { name: true } } },
      }).then((rows) => {
        rows.forEach((r) => activities.push({
          activityType: 'sleep',
          id: r.id,
          time: r.startTime.toISOString(),
          details: { type: r.type, startTime: r.startTime.toISOString(), endTime: r.endTime?.toISOString() || null, duration: r.duration, location: r.location, quality: r.quality, notes: r.notes, isActive: !r.endTime },
          caretakerName: r.caretaker?.name || null,
        }));
      })
    );
  }

  if (types.includes('note')) {
    queries.push(
      prisma.note.findMany({
        ...page('note', 'time', { babyId, deletedAt: null }),
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
        ...page('pump', 'startTime', { babyId, deletedAt: null }),
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
        ...page('bath', 'time', { babyId, deletedAt: null }),
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
        ...page('measurement', 'date', { babyId, deletedAt: null }),
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
        ...page('medicine', 'time', { babyId, deletedAt: null, medicine: { isSupplement: false } }),
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
        ...page('supplement', 'time', { babyId, deletedAt: null, medicine: { isSupplement: true } }),
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
        ...page('play', 'startTime', { babyId, deletedAt: null }),
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

  if (types.includes('food')) {
    queries.push(
      prisma.foodLog.findMany({
        ...page('food', 'time', { babyId, familyId: ctx.familyId, deletedAt: null }),
        include: { caretaker: { select: { name: true } } },
      }).then(async (rows) => {
        const catalog = await loadFoodCatalog(ctx.familyId, rows);
        rows.forEach((r) => activities.push({
          activityType: 'food',
          id: r.id,
          time: r.time.toISOString(),
          details: formatFoodDetails(r, catalog),
          caretakerName: r.caretaker?.name || null,
        }));
      })
    );
  }

  await Promise.all(queries);

  const { page: trimmed, hasMore, nextCursor } = paginate(activities, limit, window.order);

  return hookSuccess(
    { activities: trimmed, count: trimmed.length, hasMore, nextCursor },
    { familyId: ctx.familyId, babyId },
    rl.headers
  );
}

// ── POST handler ──
async function handlePost(req: NextRequest, ctx: ApiKeyContext, routeContext: any) {
  const rl = await checkRateLimit(ctx.keyId, 'POST');
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

  const result = await createHookActivity(body, { familyId: ctx.familyId, babyId }, { notify: true, allowTimers: true });
  return result.ok
    ? hookSuccess(result.data, { familyId: ctx.familyId, babyId }, rl.headers)
    : hookError(result.code, result.message, result.status, rl.headers);
}

export const GET = withApiKeyAuth(handleGet, 'read');
export const POST = withApiKeyAuth(handlePost, 'write');

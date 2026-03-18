import { NextRequest } from 'next/server';
import prisma from '../../../../../db';
import { withApiKeyAuth, ApiKeyContext, validateBabyAccess } from '../../../auth';
import { checkRateLimit } from '../../../rate-limiter';
import { hookSuccess, hookError } from '../../../response';

const VALID_TYPES = ['medicines', 'supplements', 'sleep-locations', 'play-categories', 'feed-types'] as const;
type RefType = typeof VALID_TYPES[number];

const DEFAULT_SLEEP_LOCATIONS = ['Bassinet', 'Stroller', 'Crib', 'Car Seat', 'Parents Room', 'Contact', 'Other'];

const FEED_TYPES = [
  { value: 'BREAST', description: 'Breastfeeding' },
  { value: 'BOTTLE', description: 'Bottle (specify bottleType separately)' },
  { value: 'SOLIDS', description: 'Solid food' },
  { value: 'formula', description: 'Formula bottle (auto-sets BOTTLE + formula)' },
  { value: 'breast milk', description: 'Pumped breast milk bottle' },
  { value: 'milk', description: 'Milk bottle' },
  { value: 'other', description: 'Other bottle type' },
];

async function getMedicines(familyId: string, isSupplement: boolean = false) {
  const medicines = await prisma.medicine.findMany({
    where: { familyId, deletedAt: null, active: true, isSupplement },
    select: { id: true, name: true, typicalDoseSize: true, unitAbbr: true, isSupplement: true },
    orderBy: { name: 'asc' },
  });
  return medicines;
}

async function getSleepLocations(babyId: string) {
  const customLocations = await prisma.sleepLog.findMany({
    where: { babyId, deletedAt: null, location: { not: null } },
    select: { location: true },
    distinct: ['location'],
  });
  const custom = customLocations.map((l) => l.location).filter(Boolean) as string[];
  const combined = [...DEFAULT_SLEEP_LOCATIONS, ...custom];
  const seen = new Map<string, string>();
  for (const loc of combined) {
    const key = loc.toLowerCase();
    if (!seen.has(key)) seen.set(key, loc);
  }
  return Array.from(seen.values());
}

async function getPlayCategories(babyId: string, playType?: string) {
  const where: any = { babyId, deletedAt: null, activities: { not: null } };
  if (playType) where.type = playType;

  const rows = await prisma.playLog.findMany({
    where,
    select: { activities: true },
    distinct: ['activities'],
  });
  return rows.map((r) => r.activities).filter(Boolean) as string[];
}

async function handleGet(req: NextRequest, ctx: ApiKeyContext, routeContext: any) {
  const rl = checkRateLimit(ctx.keyId, 'GET');
  if (!rl.allowed) return rl.response!;

  const params = await routeContext.params;
  const babyId = params.babyId;
  const access = await validateBabyAccess(babyId, ctx);
  if (!access.valid) return access.error!;

  const url = new URL(req.url);
  const typeParam = url.searchParams.get('type') as RefType | null;
  const playType = url.searchParams.get('playType') || undefined;

  if (typeParam && !VALID_TYPES.includes(typeParam)) {
    return hookError('INVALID_REF_TYPE', `Unknown reference type: '${typeParam}'. Valid types: ${VALID_TYPES.join(', ')}`, 400, rl.headers);
  }

  const data: any = {};

  if (!typeParam || typeParam === 'medicines') {
    data.medicines = await getMedicines(ctx.familyId, false);
  }
  if (!typeParam || typeParam === 'supplements') {
    data.supplements = await getMedicines(ctx.familyId, true);
  }
  if (!typeParam || typeParam === 'sleep-locations') {
    data.sleepLocations = await getSleepLocations(babyId);
  }
  if (!typeParam || typeParam === 'play-categories') {
    data.playCategories = await getPlayCategories(babyId, playType);
  }
  if (!typeParam || typeParam === 'feed-types') {
    data.feedTypes = FEED_TYPES;
  }

  return hookSuccess(data, { familyId: ctx.familyId, babyId }, rl.headers);
}

export const GET = withApiKeyAuth(handleGet, 'read');

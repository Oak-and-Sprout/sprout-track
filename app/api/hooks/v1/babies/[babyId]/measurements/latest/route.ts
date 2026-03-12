import { NextRequest } from 'next/server';
import prisma from '../../../../../../db';
import { withApiKeyAuth, ApiKeyContext, validateBabyAccess } from '../../../../auth';
import { checkRateLimit } from '../../../../rate-limiter';
import { hookSuccess } from '../../../../response';

const MEASUREMENT_TYPES = ['WEIGHT', 'HEIGHT', 'HEAD_CIRCUMFERENCE', 'TEMPERATURE'] as const;

async function handleGet(req: NextRequest, ctx: ApiKeyContext, routeContext: any) {
  const rl = checkRateLimit(ctx.keyId, 'GET');
  if (!rl.allowed) return rl.response!;

  const params = await routeContext.params;
  const babyId = params.babyId;
  const access = await validateBabyAccess(babyId, ctx);
  if (!access.valid) return access.error!;

  const measurements: Record<string, any> = {};

  await Promise.all(
    MEASUREMENT_TYPES.map(async (type) => {
      const m = await prisma.measurement.findFirst({
        where: { babyId, type, deletedAt: null },
        orderBy: { date: 'desc' },
      });
      if (m) {
        const daysAgo = Math.floor((Date.now() - m.date.getTime()) / (1000 * 60 * 60 * 24));
        measurements[type] = {
          value: m.value,
          unit: m.unit,
          date: m.date.toISOString().split('T')[0],
          daysAgo,
        };
      } else {
        measurements[type] = null;
      }
    })
  );

  return hookSuccess({ measurements }, { familyId: ctx.familyId, babyId }, rl.headers);
}

export const GET = withApiKeyAuth(handleGet, 'read');

import { NextRequest } from 'next/server';
import prisma from '../../../db';
import { withApiKeyAuth, ApiKeyContext } from '../auth';
import { checkRateLimit } from '../rate-limiter';
import { hookSuccess, hookError } from '../response';

function formatAge(birthDate: Date): { ageInDays: number; ageFormatted: string } {
  const now = new Date();
  const diffMs = now.getTime() - birthDate.getTime();
  const ageInDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const months = Math.floor(ageInDays / 30);
  const days = ageInDays % 30;
  const parts: string[] = [];
  if (months > 0) parts.push(`${months} month${months !== 1 ? 's' : ''}`);
  parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  return { ageInDays, ageFormatted: parts.join(', ') };
}

async function handleGet(req: NextRequest, ctx: ApiKeyContext) {
  const rl = checkRateLimit(ctx.keyId, 'GET');
  if (!rl.allowed) return rl.response!;

  const where: any = { familyId: ctx.familyId, inactive: false };
  if (ctx.restrictedBabyId) {
    where.id = ctx.restrictedBabyId;
  }

  const babies = await prisma.baby.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  });

  const data = {
    babies: babies.map((b) => {
      const age = formatAge(b.birthDate);
      return {
        id: b.id,
        firstName: b.firstName,
        lastName: b.lastName,
        birthDate: b.birthDate.toISOString().split('T')[0],
        ...age,
        gender: b.gender,
        feedWarningTime: b.feedWarningTime,
        diaperWarningTime: b.diaperWarningTime,
      };
    }),
  };

  return hookSuccess(data, { familyId: ctx.familyId }, rl.headers);
}

export const GET = withApiKeyAuth(handleGet, 'read');

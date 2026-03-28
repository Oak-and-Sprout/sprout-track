import { NextRequest } from 'next/server';
import prisma from '../../../../../db';
import { withApiKeyAuth, ApiKeyContext, validateBabyAccess } from '../../../auth';
import { checkRateLimit } from '../../../rate-limiter';
import { hookSuccess, hookError } from '../../../response';

function minutesAgo(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 60000);
}

function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function startOfTodayInTimezone(timezone?: string): Date {
  if (timezone) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const parts = formatter.formatToParts(new Date());
    const year = parseInt(parts.find(p => p.type === 'year')!.value);
    const month = parseInt(parts.find(p => p.type === 'month')!.value) - 1;
    const day = parseInt(parts.find(p => p.type === 'day')!.value);
    // Compute the offset between the target timezone and UTC right now
    const now = new Date();
    const tzStr = now.toLocaleString('en-US', { timeZone: timezone });
    const utcStr = now.toLocaleString('en-US', { timeZone: 'UTC' });
    const offsetMs = new Date(utcStr).getTime() - new Date(tzStr).getTime();
    // Midnight in the target timezone expressed as UTC
    return new Date(Date.UTC(year, month, day) + offsetMs);
  }
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function localDateString(today: Date, timezone?: string): string {
  if (timezone) {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
    return formatter.format(new Date());
  }
  return today.toISOString().split('T')[0];
}

async function handleGet(req: NextRequest, ctx: ApiKeyContext, routeContext: any) {
  const rl = checkRateLimit(ctx.keyId, 'GET');
  if (!rl.allowed) return rl.response!;

  const timezone = req.nextUrl.searchParams.get('timezone') || undefined;
  if (timezone && !isValidTimezone(timezone)) {
    return hookError('INVALID_TIMEZONE', `Invalid timezone: "${timezone}". Use an IANA timezone like "America/New_York".`, 400, rl.headers);
  }

  const params = await routeContext.params;
  const babyId = params.babyId;
  const access = await validateBabyAccess(babyId, ctx);
  if (!access.valid) return access.error!;

  const baby = await prisma.baby.findUnique({
    where: { id: babyId },
    select: { id: true, firstName: true, birthDate: true, feedWarningTime: true, diaperWarningTime: true },
  });

  const today = startOfTodayInTimezone(timezone);

  // Fetch last activities in parallel
  const [lastFeed, lastDiaper, lastSleep, lastBath, lastMedicine, lastSupplement, lastPump] = await Promise.all([
    prisma.feedLog.findFirst({ where: { babyId, deletedAt: null }, orderBy: { time: 'desc' }, include: { caretaker: { select: { name: true } }, unit: { select: { unitAbbr: true } } } }),
    prisma.diaperLog.findFirst({ where: { babyId, deletedAt: null }, orderBy: { time: 'desc' }, include: { caretaker: { select: { name: true } } } }),
    prisma.sleepLog.findFirst({ where: { babyId, deletedAt: null }, orderBy: { startTime: 'desc' }, include: { caretaker: { select: { name: true } } } }),
    prisma.bathLog.findFirst({ where: { babyId, deletedAt: null }, orderBy: { time: 'desc' } }),
    prisma.medicineLog.findFirst({ where: { babyId, deletedAt: null, medicine: { isSupplement: false } }, orderBy: { time: 'desc' }, include: { medicine: { select: { name: true } } } }),
    prisma.medicineLog.findFirst({ where: { babyId, deletedAt: null, medicine: { isSupplement: true } }, orderBy: { time: 'desc' }, include: { medicine: { select: { name: true } } } }),
    prisma.pumpLog.findFirst({ where: { babyId, deletedAt: null }, orderBy: { startTime: 'desc' } }),
  ]);

  // Fetch daily counts in parallel
  const [feedCount, diapers, sleepLogs, bathCount, medicineCount, supplementCount] = await Promise.all([
    prisma.feedLog.count({ where: { babyId, deletedAt: null, time: { gte: today } } }),
    prisma.diaperLog.findMany({ where: { babyId, deletedAt: null, time: { gte: today } }, select: { type: true } }),
    prisma.sleepLog.findMany({
      where: {
        babyId,
        deletedAt: null,
        OR: [
          { startTime: { gte: today } },
          { endTime: { gte: today }, startTime: { lt: today } },
        ],
      },
      select: { duration: true, type: true, startTime: true, endTime: true },
    }),
    prisma.bathLog.count({ where: { babyId, deletedAt: null, time: { gte: today } } }),
    prisma.medicineLog.count({ where: { babyId, deletedAt: null, time: { gte: today }, medicine: { isSupplement: false } } }),
    prisma.medicineLog.count({ where: { babyId, deletedAt: null, time: { gte: today }, medicine: { isSupplement: true } } }),
  ]);

  const diapersByType: Record<string, number> = {};
  diapers.forEach((d) => {
    diapersByType[d.type] = (diapersByType[d.type] || 0) + 1;
  });

  const sleepMinutes = sleepLogs.reduce((sum, s) => {
    if (!s.duration) return sum;
    if (s.startTime < today && s.endTime) {
      return sum + Math.floor((s.endTime.getTime() - today.getTime()) / 60000);
    }
    return sum + s.duration;
  }, 0);
  const naps = sleepLogs.filter((s) => s.type === 'NAP').length;

  // Warnings
  const feedTime = lastFeed?.time;
  const diaperTime = lastDiaper?.time;

  function parseWarningMinutes(warnTime: string | null | undefined): number | null {
    if (!warnTime) return null;
    const parts = warnTime.split(':');
    if (parts.length < 2) return null;
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  const feedWarnMins = parseWarningMinutes(baby?.feedWarningTime);
  const diaperWarnMins = parseWarningMinutes(baby?.diaperWarningTime);

  const feedMinsAgo = feedTime ? minutesAgo(feedTime) : null;
  const diaperMinsAgo = diaperTime ? minutesAgo(diaperTime) : null;

  const feedOverdue = feedWarnMins !== null && feedMinsAgo !== null && feedMinsAgo > feedWarnMins;
  const diaperOverdue = diaperWarnMins !== null && diaperMinsAgo !== null && diaperMinsAgo > diaperWarnMins;

  const ageInDays = baby ? Math.floor((Date.now() - baby.birthDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

  const lastActivities: any = {
    feed: lastFeed ? {
      id: lastFeed.id,
      time: lastFeed.time.toISOString(),
      minutesAgo: minutesAgo(lastFeed.time),
      type: lastFeed.type,
      amount: lastFeed.amount,
      unitAbbr: lastFeed.unit?.unitAbbr || null,
      bottleType: lastFeed.bottleType,
      caretakerName: lastFeed.caretaker?.name || null,
    } : null,
    diaper: lastDiaper ? {
      id: lastDiaper.id,
      time: lastDiaper.time.toISOString(),
      minutesAgo: minutesAgo(lastDiaper.time),
      type: lastDiaper.type,
      caretakerName: lastDiaper.caretaker?.name || null,
    } : null,
    sleep: lastSleep ? {
      id: lastSleep.id,
      startTime: lastSleep.startTime.toISOString(),
      endTime: lastSleep.endTime?.toISOString() || null,
      minutesAgo: minutesAgo(lastSleep.endTime || lastSleep.startTime),
      duration: lastSleep.duration,
      type: lastSleep.type,
      isActive: !lastSleep.endTime,
    } : null,
    bath: lastBath ? {
      time: lastBath.time.toISOString(),
      minutesAgo: minutesAgo(lastBath.time),
    } : null,
    medicine: lastMedicine ? {
      time: lastMedicine.time.toISOString(),
      minutesAgo: minutesAgo(lastMedicine.time),
      medicineName: lastMedicine.medicine?.name || null,
    } : null,
    supplement: lastSupplement ? {
      time: lastSupplement.time.toISOString(),
      minutesAgo: minutesAgo(lastSupplement.time),
      supplementName: lastSupplement.medicine?.name || null,
    } : null,
    pump: lastPump ? {
      startTime: lastPump.startTime.toISOString(),
      endTime: lastPump.endTime?.toISOString() || null,
      minutesAgo: minutesAgo(lastPump.endTime || lastPump.startTime),
      duration: lastPump.duration,
      isActive: !lastPump.endTime,
    } : null,
  };

  const data = {
    baby: {
      id: baby!.id,
      firstName: baby!.firstName,
      ageInDays,
    },
    lastActivities,
    dailyCounts: {
      date: localDateString(today, timezone),
      feeds: feedCount,
      diapers: diapers.length,
      diapersByType,
      sleepMinutes,
      naps,
      baths: bathCount,
      medicines: medicineCount,
      supplements: supplementCount,
    },
    warnings: {
      feedOverdue,
      feedMinutesSinceWarning: feedOverdue && feedWarnMins !== null && feedMinsAgo !== null ? feedMinsAgo - feedWarnMins : null,
      diaperOverdue,
      diaperMinutesSinceWarning: diaperOverdue && diaperWarnMins !== null && diaperMinsAgo !== null ? diaperMinsAgo - diaperWarnMins : null,
    },
  };

  return hookSuccess(data, { familyId: ctx.familyId, babyId }, rl.headers);
}

export const GET = withApiKeyAuth(handleGet, 'read');

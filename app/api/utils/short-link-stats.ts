export interface StatsFilters {
  rangeStart: Date | null; // null = all time
  deviceType: string | null;
  country: string | null;
  referrer: string | null;
  page: number; // 1-based, default 1
  pageSize: number; // default 25, max 100
}

export function parseStatsFilters(searchParams: URLSearchParams, now: Date): StatsFilters {
  const daysParam = searchParams.get('days') ?? '30';
  let rangeStart: Date | null;

  if (daysParam === 'all') {
    rangeStart = null;
  } else {
    const days = parseInt(daysParam, 10);
    if (isNaN(days) || days <= 0) {
      // Fall back to 30 days on garbage
      rangeStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      rangeStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }
  }

  let page = parseInt(searchParams.get('page') ?? '1', 10);
  if (isNaN(page) || page < 1) {
    page = 1;
  }

  let pageSize = parseInt(searchParams.get('pageSize') ?? '25', 10);
  if (isNaN(pageSize) || pageSize < 1) {
    pageSize = 25;
  } else if (pageSize > 100) {
    pageSize = 100;
  }

  const deviceType = searchParams.get('deviceType') ?? null;
  const country = searchParams.get('country') ?? null;
  const referrer = searchParams.get('referrer') ?? null;

  return {
    rangeStart,
    deviceType,
    country,
    referrer,
    page,
    pageSize,
  };
}

export function buildClickWhere(shortLinkId: string, f: StatsFilters): Record<string, unknown> {
  const where: Record<string, unknown> = {
    shortLinkId,
  };

  if (f.rangeStart !== null) {
    where.timestamp = { gte: f.rangeStart };
  }

  if (f.deviceType !== null) {
    where.deviceType = f.deviceType;
  }

  if (f.country !== null) {
    where.country = f.country;
  }

  if (f.referrer !== null) {
    where.referrerDomain = f.referrer;
  }

  return where;
}

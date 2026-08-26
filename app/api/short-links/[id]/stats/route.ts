import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/api/db';
import { withSysAdminAuth, ApiResponse } from '@/app/api/utils/auth';
import { shortLinkSaasGate, toShortLinkRow, ShortLinkRow } from '@/app/api/utils/short-links';
import { parseStatsFilters, buildClickWhere } from '@/app/api/utils/short-link-stats';
import { aggregateClicks, ClickAggregates, DayPoint } from '@/src/utils/short-link-utils';

export interface RecentClickRow {
  timestamp: string;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  country: string | null;
  region: string | null;
  referrerDomain: string | null;
  queryString: string | null;
}

export interface ShortLinkStatsData {
  link: ShortLinkRow;
  series: DayPoint[];
  totals: { clicks: number; uniques: number };
  breakdowns: ClickAggregates['breakdowns'];
  recent: { rows: RecentClickRow[]; total: number; page: number; pageSize: number };
}

function idFromPath(req: NextRequest): string | null {
  const parts = new URL(req.url).pathname.split('/').filter(Boolean);
  // ['api', 'short-links', '<id>', 'stats']
  return parts[2] ?? null;
}

async function getHandler(req: NextRequest): Promise<NextResponse<ApiResponse<ShortLinkStatsData>>> {
  const gate = shortLinkSaasGate();
  if (gate) return gate;

  try {
    const id = idFromPath(req);
    if (!id) return NextResponse.json({ success: false, error: 'Short link not found' }, { status: 404 });

    const link = await prisma.shortLink.findUnique({ where: { id } });
    if (!link) return NextResponse.json({ success: false, error: 'Short link not found' }, { status: 404 });

    const now = new Date();
    const filters = parseStatsFilters(req.nextUrl.searchParams, now);
    const where = buildClickWhere(id, filters);

    const [rows, total, recentRows, clicks7d] = await Promise.all([
      prisma.shortLinkClick.findMany({
        where,
        select: {
          timestamp: true, visitorHash: true, deviceType: true, browser: true,
          os: true, country: true, referrerDomain: true,
        },
        orderBy: { timestamp: 'asc' },
      }),
      prisma.shortLinkClick.count({ where }),
      prisma.shortLinkClick.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      prisma.shortLinkClick.count({
        where: { shortLinkId: id, timestamp: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } },
      }),
    ]);

    const rangeStart =
      filters.rangeStart ?? (rows.length > 0 ? rows[0].timestamp : now);
    const aggregates = aggregateClicks(rows, rangeStart, now);

    return NextResponse.json({
      success: true,
      data: {
        link: toShortLinkRow(link, clicks7d),
        series: aggregates.series,
        totals: aggregates.totals,
        breakdowns: aggregates.breakdowns,
        recent: {
          rows: recentRows.map((r) => ({
            timestamp: r.timestamp.toISOString(),
            deviceType: r.deviceType,
            browser: r.browser,
            os: r.os,
            country: r.country,
            region: r.region,
            referrerDomain: r.referrerDomain,
            queryString: r.queryString,
          })),
          total,
          page: filters.page,
          pageSize: filters.pageSize,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching short link stats:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch short link stats' }, { status: 500 });
  }
}

export const GET = withSysAdminAuth(getHandler);

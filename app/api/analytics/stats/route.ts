import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/api/db';
import { withSysAdminAuth, ApiResponse } from '@/app/api/utils/auth';
import { analyticsSaasGate, parseAnalyticsFilters, buildPageviewWhere } from '@/app/api/utils/analytics';
import {
  aggregatePageviews, computeFunnel, ANALYTICS_FUNNEL_STAGES,
  type PageviewDayPoint, type PageviewAggregates, type FunnelStageResult,
} from '@/src/utils/analytics-utils';

export interface RecentPageviewRow {
  timestamp: string; path: string; deviceType: string | null; browser: string | null;
  os: string | null; country: string | null; region: string | null;
  referrerDomain: string | null; queryString: string | null;
}

export interface AnalyticsStatsData {
  series: PageviewDayPoint[];
  totals: { views: number; uniques: number };
  breakdowns: PageviewAggregates['breakdowns'];
  funnel: FunnelStageResult[];
  recent: { rows: RecentPageviewRow[]; total: number; page: number; pageSize: number };
  path: string | null;
}

async function getHandler(req: NextRequest): Promise<NextResponse<ApiResponse<AnalyticsStatsData>>> {
  const gate = analyticsSaasGate();
  if (gate) return gate;

  try {
    const now = new Date();
    const filters = parseAnalyticsFilters(req.nextUrl.searchParams, now);
    const where = buildPageviewWhere(filters);
    // Funnel always spans the whole range regardless of an active path drill-down.
    const funnelWhere = buildPageviewWhere({ ...filters, path: null });

    const [rows, total, recentRows, funnelRows] = await Promise.all([
      prisma.pageview.findMany({
        where,
        select: {
          timestamp: true, visitorHash: true, deviceType: true, browser: true,
          os: true, country: true, referrerDomain: true, path: true,
        },
        orderBy: { timestamp: 'asc' },
      }),
      prisma.pageview.count({ where }),
      prisma.pageview.findMany({
        where, orderBy: { timestamp: 'desc' },
        skip: (filters.page - 1) * filters.pageSize, take: filters.pageSize,
      }),
      prisma.pageview.findMany({ where: funnelWhere, select: { path: true, visitorHash: true } }),
    ]);

    const rangeStart = filters.rangeStart ?? (rows.length > 0 ? rows[0].timestamp : now);
    const aggregates = aggregatePageviews(rows, rangeStart, now);

    return NextResponse.json({
      success: true,
      data: {
        series: aggregates.series,
        totals: aggregates.totals,
        breakdowns: aggregates.breakdowns,
        funnel: computeFunnel(funnelRows, ANALYTICS_FUNNEL_STAGES),
        recent: {
          rows: recentRows.map((r) => ({
            timestamp: r.timestamp.toISOString(), path: r.path, deviceType: r.deviceType,
            browser: r.browser, os: r.os, country: r.country, region: r.region,
            referrerDomain: r.referrerDomain, queryString: r.queryString,
          })),
          total, page: filters.page, pageSize: filters.pageSize,
        },
        path: filters.path,
      },
    });
  } catch (error) {
    console.error('Error fetching analytics stats:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch analytics stats' }, { status: 500 });
  }
}

export const GET = withSysAdminAuth(getHandler);

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/api/db';
import { withSysAdminAuth, ApiResponse } from '@/app/api/utils/auth';
import { analyticsSaasGate, parseAnalyticsFilters, buildPageviewWhere } from '@/app/api/utils/analytics';
import { buildPageviewsCsv } from '@/src/utils/analytics-utils';

async function getHandler(req: NextRequest): Promise<NextResponse<ApiResponse<string>>> {
  const gate = analyticsSaasGate();
  if (gate) return gate;

  try {
    const filters = parseAnalyticsFilters(req.nextUrl.searchParams, new Date());
    const rows = await prisma.pageview.findMany({
      where: buildPageviewWhere(filters), orderBy: { timestamp: 'desc' },
    });
    const csv = buildPageviewsCsv(rows.map((r) => ({
      timestamp: r.timestamp.toISOString(), path: r.path, deviceType: r.deviceType,
      browser: r.browser, os: r.os, country: r.country, region: r.region,
      referrerDomain: r.referrerDomain, queryString: r.queryString,
    })));
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="site-pageviews.csv"',
      },
    }) as unknown as NextResponse<ApiResponse<string>>;
  } catch (error) {
    console.error('Error exporting pageviews:', error);
    return NextResponse.json({ success: false, error: 'Failed to export pageviews' }, { status: 500 });
  }
}

export const GET = withSysAdminAuth(getHandler);

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/api/db';
import { withSysAdminAuth, ApiResponse } from '@/app/api/utils/auth';
import { shortLinkSaasGate } from '@/app/api/utils/short-links';
import { parseStatsFilters, buildClickWhere } from '@/app/api/utils/short-link-stats';
import { buildClicksCsv } from '@/src/utils/short-link-utils';

function idFromPath(req: NextRequest): string | null {
  const parts = new URL(req.url).pathname.split('/').filter(Boolean);
  // ['api', 'short-links', '<id>', 'export']
  return parts[2] ?? null;
}

async function getHandler(req: NextRequest): Promise<NextResponse<ApiResponse<string>>> {
  const gate = shortLinkSaasGate();
  if (gate) return gate;

  try {
    const id = idFromPath(req);
    if (!id) return NextResponse.json({ success: false, error: 'Short link not found' }, { status: 404 });

    const link = await prisma.shortLink.findUnique({ where: { id } });
    if (!link) return NextResponse.json({ success: false, error: 'Short link not found' }, { status: 404 });

    const filters = parseStatsFilters(req.nextUrl.searchParams, new Date());
    const rows = await prisma.shortLinkClick.findMany({
      where: buildClickWhere(id, filters),
      orderBy: { timestamp: 'desc' },
    });

    const csv = buildClicksCsv(
      rows.map((r) => ({
        timestamp: r.timestamp.toISOString(),
        deviceType: r.deviceType,
        browser: r.browser,
        os: r.os,
        country: r.country,
        region: r.region,
        referrerDomain: r.referrerDomain,
        queryString: r.queryString,
      }))
    );

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${link.slug}-clicks.csv"`,
      },
    }) as unknown as NextResponse<ApiResponse<string>>;
  } catch (error) {
    console.error('Error exporting short link clicks:', error);
    return NextResponse.json({ success: false, error: 'Failed to export clicks' }, { status: 500 });
  }
}

export const GET = withSysAdminAuth(getHandler);

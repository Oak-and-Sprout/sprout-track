import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/api/db';
import { withSysAdminAuth, ApiResponse } from '@/app/api/utils/auth';
import {
  shortLinkSaasGate,
  generateSlug,
  parseShortLinkInput,
  toShortLinkRow,
  ShortLinkRow,
} from '@/app/api/utils/short-links';

async function getHandler(req: NextRequest): Promise<NextResponse<ApiResponse<ShortLinkRow[]>>> {
  const gate = shortLinkSaasGate();
  if (gate) return gate;

  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [links, recent] = await Promise.all([
      prisma.shortLink.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.shortLinkClick.groupBy({
        by: ['shortLinkId'],
        where: { timestamp: { gte: since } },
        _count: { _all: true },
      }),
    ]);
    const recentById = new Map(recent.map((r) => [r.shortLinkId, r._count._all]));
    return NextResponse.json({
      success: true,
      data: links.map((l) => toShortLinkRow(l, recentById.get(l.id) ?? 0)),
    });
  } catch (error) {
    console.error('Error fetching short links:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch short links' }, { status: 500 });
  }
}

async function postHandler(req: NextRequest): Promise<NextResponse<ApiResponse<ShortLinkRow>>> {
  const gate = shortLinkSaasGate();
  if (gate) return gate;

  try {
    const input = parseShortLinkInput(await req.json());

    let created = null;
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      const slug = generateSlug();
      try {
        created = await prisma.shortLink.create({ data: { slug, ...input } });
      } catch (e: unknown) {
        // P2002 = unique constraint (slug collision) — retry with a new slug
        if ((e as { code?: string }).code !== 'P2002') throw e;
      }
    }
    if (!created) {
      return NextResponse.json({ success: false, error: 'Failed to generate a unique slug' }, { status: 500 });
    }
    return NextResponse.json({ success: true, data: toShortLinkRow(created, 0) });
  } catch (error) {
    console.error('Error creating short link:', error);
    const message = error instanceof Error ? error.message : 'Failed to create short link';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export const GET = withSysAdminAuth(getHandler);
export const POST = withSysAdminAuth(postHandler);

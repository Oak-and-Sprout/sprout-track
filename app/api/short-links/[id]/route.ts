import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/api/db';
import { withSysAdminAuth, ApiResponse } from '@/app/api/utils/auth';
import {
  shortLinkSaasGate,
  parseShortLinkInput,
  toShortLinkRow,
  ShortLinkRow,
} from '@/app/api/utils/short-links';

function idFromPath(req: NextRequest): string | null {
  const parts = new URL(req.url).pathname.split('/').filter(Boolean);
  // ['api', 'short-links', '<id>']
  return parts[2] ?? null;
}

async function putHandler(req: NextRequest): Promise<NextResponse<ApiResponse<ShortLinkRow>>> {
  const gate = shortLinkSaasGate();
  if (gate) return gate;

  try {
    const id = idFromPath(req);
    if (!id) return NextResponse.json({ success: false, error: 'Short link not found' }, { status: 404 });

    const existing = await prisma.shortLink.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ success: false, error: 'Short link not found' }, { status: 404 });

    const body = (await req.json()) as Record<string, unknown>;
    // Validate the merged shape so partial updates get full validation
    const input = parseShortLinkInput({
      url: body.url ?? existing.url,
      name: body.name ?? existing.name,
      description: body.description ?? existing.description ?? '',
      tag: body.tag ?? existing.tag ?? '',
    });
    const enabled = typeof body.enabled === 'boolean' ? body.enabled : existing.enabled;

    const updated = await prisma.shortLink.update({ where: { id }, data: { ...input, enabled } });

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const clicks7d = await prisma.shortLinkClick.count({
      where: { shortLinkId: id, timestamp: { gte: since } },
    });
    return NextResponse.json({ success: true, data: toShortLinkRow(updated, clicks7d) });
  } catch (error) {
    console.error('Error updating short link:', error);
    const message = error instanceof Error ? error.message : 'Failed to update short link';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

async function deleteHandler(req: NextRequest): Promise<NextResponse<ApiResponse<{ id: string }>>> {
  const gate = shortLinkSaasGate();
  if (gate) return gate;

  try {
    const id = idFromPath(req);
    if (!id) return NextResponse.json({ success: false, error: 'Short link not found' }, { status: 404 });

    const existing = await prisma.shortLink.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ success: false, error: 'Short link not found' }, { status: 404 });

    await prisma.shortLink.delete({ where: { id } }); // clicks cascade
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Error deleting short link:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete short link' }, { status: 500 });
  }
}

export const PUT = withSysAdminAuth(putHandler);
export const DELETE = withSysAdminAuth(deleteHandler);

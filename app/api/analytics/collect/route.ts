import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/api/db';
import { analyticsSaasGate } from '@/app/api/utils/analytics';
import { normalizePath } from '@/src/utils/analytics-utils';
import {
  parseUserAgent, getClientIp, getCountry, computeVisitorHash, utcDayString, extractReferrerDomain,
} from '@/src/utils/short-link-utils';

export const PRUNE_CUTOFF_DAYS = 365;
export function shouldPrune(rand: number): boolean { return rand < 1 / 500; }
export function pruneCutoffDate(now: Date): Date {
  return new Date(now.getTime() - PRUNE_CUTOFF_DAYS * 86400000);
}

const clip = (v: string | null, max: number) => (v ? v.slice(0, max) : null);
const NO_CONTENT = new NextResponse(null, { status: 204 });

export async function POST(req: NextRequest): Promise<NextResponse> {
  const gate = analyticsSaasGate();
  if (gate) return gate;

  try {
    let body: { path?: unknown; referrer?: unknown; query?: unknown } = {};
    try { body = await req.json(); } catch { body = {}; }

    const path = typeof body.path === 'string' ? normalizePath(body.path) : null;
    if (!path) return NO_CONTENT; // unknown/garbage path — drop silently

    const ua = req.headers.get('user-agent');
    const parsed = parseUserAgent(ua);
    const ip = getClientIp(req.headers);
    const { country, region } = getCountry(req.headers);
    const secret = process.env.JWT_SECRET;
    const visitorHash = ip && ua && secret
      ? computeVisitorHash(ip, ua, utcDayString(new Date()), secret) : null;
    const referrer = typeof body.referrer === 'string' ? body.referrer : null;
    const query = typeof body.query === 'string' ? body.query : null;

    await prisma.pageview.create({
      data: {
        path,
        deviceType: parsed.deviceType,
        browser: parsed.browser,
        os: parsed.os,
        referrerDomain: clip(extractReferrerDomain(referrer), 255),
        country: clip(country, 8),
        region: clip(region, 32),
        visitorHash,
        queryString: clip(query ? query.replace(/^\?/, '') : null, 1024),
      },
    });

    if (shouldPrune(Math.random())) {
      try {
        await prisma.pageview.deleteMany({ where: { timestamp: { lt: pruneCutoffDate(new Date()) } } });
      } catch (pruneErr) {
        console.error('Pageview prune failed:', pruneErr);
      }
    }
  } catch (err) {
    console.error('Pageview collect failed:', err);
  }
  return NO_CONTENT;
}

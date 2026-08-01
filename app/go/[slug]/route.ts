import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/api/db';
import {
  mergeQueryParams,
  parseUserAgent,
  computeVisitorHash,
  utcDayString,
  extractReferrerDomain,
  getClientIp,
  getCountry,
} from '@/src/utils/short-link-utils';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const home = new URL('/', req.url);

  try {
    const deploymentMode = process.env.DEPLOYMENT_MODE || 'selfhosted';
    if (deploymentMode !== 'saas') return NextResponse.redirect(home, 302);

    const { slug } = await params;
    if (!/^[0-9a-f]{8}$/.test(slug)) return NextResponse.redirect(home, 302);

    const link = await prisma.shortLink.findUnique({ where: { slug } });
    if (!link || !link.enabled) return NextResponse.redirect(home, 302);

    const destination = mergeQueryParams(link.url, req.nextUrl.search);

    // Click capture must never break the redirect.
    try {
      const ua = req.headers.get('user-agent');
      const parsed = parseUserAgent(ua);
      const ip = getClientIp(req.headers);
      const { country, region } = getCountry(req.headers);
      const secret = process.env.JWT_SECRET;
      const visitorHash =
        ip && ua && secret ? computeVisitorHash(ip, ua, utcDayString(new Date()), secret) : null;

      await prisma.$transaction([
        prisma.shortLinkClick.create({
          data: {
            shortLinkId: link.id,
            deviceType: parsed.deviceType,
            browser: parsed.browser,
            os: parsed.os,
            referrerDomain: extractReferrerDomain(req.headers.get('referer')),
            country,
            region,
            visitorHash,
            queryString: req.nextUrl.search ? req.nextUrl.search.slice(1) : null,
          },
        }),
        prisma.shortLink.update({
          where: { id: link.id },
          data: { clickCount: { increment: 1 } },
        }),
      ]);
    } catch (logError) {
      console.error('Short link click logging failed:', logError);
    }

    return NextResponse.redirect(destination, 302);
  } catch (error) {
    console.error('Short link redirect failed:', error);
    return NextResponse.redirect(home, 302);
  }
}

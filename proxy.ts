import { NextRequest, NextResponse } from 'next/server';

/**
 * Gates the SaaS marketing routes at the proxy layer so the pages themselves can be
 * fully prerendered (crawlable HTML, real metadata). Self-hosted deployments
 * redirect to the root dispatcher instead of seeing marketing content.
 * DEPLOYMENT_MODE is read at request time, so one Docker image serves both
 * modes correctly.
 */
export function proxy(req: NextRequest): NextResponse {
  if (process.env.DEPLOYMENT_MODE !== 'saas') {
    return NextResponse.redirect(new URL('/', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/features', '/pricing', '/terms', '/privacy'],
};

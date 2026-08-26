import { NextResponse } from 'next/server';
import { ApiResponse } from './auth';

export function analyticsSaasGate(): NextResponse<ApiResponse<never>> | null {
  const deploymentMode = process.env.DEPLOYMENT_MODE || 'selfhosted';
  if (deploymentMode !== 'saas') {
    return NextResponse.json(
      { success: false, error: 'Analytics are disabled in self-hosted mode' },
      { status: 404 }
    ) as NextResponse<ApiResponse<never>>;
  }
  return null;
}

export interface AnalyticsFilters {
  rangeStart: Date | null;
  path: string | null;
  page: number;
  pageSize: number;
}

export function parseAnalyticsFilters(searchParams: URLSearchParams, now: Date): AnalyticsFilters {
  const daysParam = searchParams.get('days') ?? '30';
  let rangeStart: Date | null;
  if (daysParam === 'all') {
    rangeStart = null;
  } else {
    const days = parseInt(daysParam, 10);
    rangeStart = new Date(now.getTime() - (isNaN(days) || days <= 0 ? 30 : days) * 86400000);
  }

  let page = parseInt(searchParams.get('page') ?? '1', 10);
  if (isNaN(page) || page < 1) page = 1;

  let pageSize = parseInt(searchParams.get('pageSize') ?? '25', 10);
  if (isNaN(pageSize) || pageSize < 1) pageSize = 25;
  else if (pageSize > 100) pageSize = 100;

  const path = searchParams.get('path') ?? null;
  return { rangeStart, path, page, pageSize };
}

export function buildPageviewWhere(f: AnalyticsFilters): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (f.rangeStart !== null) where.timestamp = { gte: f.rangeStart };
  if (f.path !== null) where.path = f.path;
  return where;
}

import { NextRequest, NextResponse } from 'next/server';
import { ApiResponse } from '../types';
import prisma from '../db';
import { LandingStats, resolveLandingStats } from '@/src/utils/landing-stats';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
let cache: { data: LandingStats; fetchedAt: number } | null = null;

/**
 * GET /api/landing-stats — public, no auth.
 * Live proof stats for the landing hero: active family count + GitHub stars.
 * Cached in-process for an hour; falls back to static values on any failure.
 */
export async function GET(
  req: NextRequest
): Promise<NextResponse<ApiResponse<LandingStats>>> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({ success: true, data: cache.data });
  }

  let families: number | null = null;
  let stars: number | null = null;

  try {
    families = await prisma.family.count({ where: { isActive: true } });
  } catch (error) {
    console.error('landing-stats: family count failed', error);
  }

  try {
    const res = await fetch(
      'https://api.github.com/repos/Oak-and-Sprout/sprout-track',
      {
        headers: { Accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (res.ok) {
      const repo = await res.json();
      if (typeof repo.stargazers_count === 'number') {
        stars = repo.stargazers_count;
      }
    }
  } catch (error) {
    console.error('landing-stats: GitHub fetch failed', error);
  }

  const data = resolveLandingStats(families, stars);
  cache = { data, fetchedAt: Date.now() };
  return NextResponse.json({ success: true, data });
}

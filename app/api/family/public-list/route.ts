import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse, FamilyResponse } from '../../types';

// Only the fields the family-selection UI actually consumes (id for React keys, name
// and slug for display/navigation). This endpoint is unauthenticated, so it must not
// expose anything beyond what the picker needs.
type PublicFamily = Pick<FamilyResponse, 'id' | 'name' | 'slug'>;

// This endpoint doesn't require authentication as it's used for the initial family selection.
// In SaaS mode it is disabled: it would expose every tenant's family name and slug across the
// whole platform to any unauthenticated caller. Self-hosted deployments (single household) still use it.
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<PublicFamily[]>>> {
  if (process.env.DEPLOYMENT_MODE === 'saas') {
    return NextResponse.json({
      success: false,
      error: 'This endpoint is not available in SaaS mode',
    }, { status: 403 });
  }

  try {
    const families = await prisma.family.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: families,
    });
  } catch (error) {
    console.error('Error fetching families:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch families',
    }, { status: 500 });
  }
}

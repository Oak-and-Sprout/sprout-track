import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse, FamilyResponse } from '../../types';

// This endpoint doesn't require authentication as it's used for the initial family selection
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<FamilyResponse[]>>> {
  try {
    const families = await prisma.family.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        updatedAt: true,
        isActive: true,
      },
    });

    // Convert dates to strings for JSON response
    const familyResponses: FamilyResponse[] = families.map((family) => ({
      id: family.id,
      name: family.name,
      slug: family.slug,
      isActive: family.isActive,
      createdAt: new Date(family.createdAt).toISOString(),
      updatedAt: new Date(family.updatedAt).toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: familyResponses,
    });
  } catch (error) {
    console.error('Error fetching families:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch families',
    }, { status: 500 });
  }
}

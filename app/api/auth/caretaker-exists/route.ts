import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse } from '../../types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const familySlug = searchParams.get('familySlug');
    
    // Validate family slug if provided
    let familyId = null;
    if (familySlug) {
      const family = await prisma.family.findFirst({
        where: {
          slug: familySlug,
          isActive: true,
        },
      });

      if (!family) {
        return NextResponse.json<ApiResponse<null>>(
          {
            success: false,
            error: 'Invalid family',
          },
          { status: 404 }
        );
      }
      
      familyId = family.id;
    }
    
    // Count active caretakers (excluding system caretaker)
    const caretakerCount = await prisma.caretaker.count({
      where: {
        deletedAt: null,
        loginId: { not: '00' }, // Exclude system caretaker
        // If family is specified, only count caretakers in that family
        ...(familyId ? { familyId } : {}),
      },
    });

    // Get authType from settings if familyId is available
    let authType = null;
    if (familyId) {
      const settings = await prisma.settings.findFirst({
        where: { familyId },
        select: { authType: true }
      });

      // Auto-detect authType if not set
      authType = settings?.authType || (caretakerCount > 0 ? 'CARETAKER' : 'SYSTEM');
    }

    return NextResponse.json<ApiResponse<{ exists: boolean; authType?: string }>>({
      success: true,
      data: {
        exists: caretakerCount > 0,
        authType: authType || undefined
      },
    });
  } catch (error) {
    console.error('Error checking caretakers:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to check caretakers',
      },
      { status: 500 }
    );
  }
}

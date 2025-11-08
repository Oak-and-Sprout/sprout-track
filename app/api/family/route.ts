import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse, FamilyResponse } from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';
import { checkWritePermission } from '../utils/writeProtection';

// GET - Get current user's family data
async function getHandler(req: NextRequest, authContext: AuthResult): Promise<NextResponse<ApiResponse<FamilyResponse>>> {
  try {
    const { familyId } = authContext;
    
    if (!familyId) {
      return NextResponse.json({
        success: false,
        error: 'User is not associated with a family',
      }, { status: 403 });
    }

    const family = await prisma.family.findUnique({
      where: { id: familyId }
    });

    if (!family) {
      return NextResponse.json({
        success: false,
        error: 'Family not found',
      }, { status: 404 });
    }

    const response: FamilyResponse = {
      id: family.id,
      name: family.name,
      slug: family.slug,
      isActive: family.isActive,
      createdAt: family.createdAt.toISOString(),
      updatedAt: family.updatedAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error fetching family:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch family',
    }, { status: 500 });
  }
}

// PUT - Update family data
async function putHandler(req: NextRequest, authContext: AuthResult): Promise<NextResponse<ApiResponse<FamilyResponse>>> {
  // Check write permissions for expired accounts
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) {
    return writeCheck.response!;
  }

  try {
    const { familyId } = authContext;
    
    if (!familyId) {
      return NextResponse.json({
        success: false,
        error: 'User is not associated with a family',
      }, { status: 403 });
    }

    const body = await req.json();
    const { name, slug } = body;

    // Validate required fields
    if (!name || !slug) {
      return NextResponse.json({
        success: false,
        error: 'Name and slug are required',
      }, { status: 400 });
    }

    // Check if family exists
    const existingFamily = await prisma.family.findUnique({
      where: { id: familyId }
    });

    if (!existingFamily) {
      return NextResponse.json({
        success: false,
        error: 'Family not found',
      }, { status: 404 });
    }

    // If slug is being updated, check if it already exists (excluding current family)
    if (slug !== existingFamily.slug) {
      const slugExists = await prisma.family.findFirst({
        where: { 
          slug: slug,
          id: { not: familyId }
        }
      });

      if (slugExists) {
        return NextResponse.json({
          success: false,
          error: 'Slug already exists',
        }, { status: 400 });
      }
    }

    // Update both family and settings records in a transaction
    const [family, settings] = await prisma.$transaction([
      prisma.family.update({
        where: { id: familyId },
        data: { name, slug }
      }),
      prisma.settings.updateMany({
        where: { familyId: familyId },
        data: { familyName: name }
      })
    ]);

    const response: FamilyResponse = {
      id: family.id,
      name: family.name,
      slug: family.slug,
      isActive: family.isActive,
      createdAt: family.createdAt.toISOString(),
      updatedAt: family.updatedAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error updating family:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update family',
    }, { status: 500 });
  }
}

// Export handlers with authentication
export const GET = withAuthContext(getHandler);
export const PUT = withAuthContext(putHandler); 
import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../db';
import { ApiResponse, CaretakerResponse } from '../../../types';
import { withSysAdminAuth } from '../../../utils/auth';
import { toCaretakerResponse } from '../../../utils/caretaker';

/**
 * Parse the family id from the URL path.
 * Expected pattern: /api/family/{id}/caretakers
 * The auth wrapper only forwards `req` (not the Next.js route `params` context),
 * so the id is read from the URL — matching the pattern used by other authenticated
 * dynamic routes in this codebase.
 */
function parseFamilyId(req: NextRequest): string | null {
  const segments = new URL(req.url).pathname.split('/');
  const familyIdx = segments.indexOf('family');
  if (familyIdx === -1 || familyIdx + 1 >= segments.length) return null;
  return segments[familyIdx + 1] || null;
}

// GET - Get all caretakers for a specific family.
// System administrators only: this returns caretakers across any family for the
// family-manager console, so it must not be reachable without sysadmin auth.
async function handleGet(
  req: NextRequest
): Promise<NextResponse<ApiResponse<CaretakerResponse[]>>> {
  try {
    const familyId = parseFamilyId(req);

    if (!familyId) {
      return NextResponse.json({
        success: false,
        error: 'Family ID is required',
      }, { status: 400 });
    }

    // Check if family exists
    const family = await prisma.family.findUnique({
      where: { id: familyId }
    });

    if (!family) {
      return NextResponse.json({
        success: false,
        error: 'Family not found',
      }, { status: 404 });
    }

    // Get all caretakers for this family
    const caretakers = await prisma.caretaker.findMany({
      where: {
        familyId: familyId,
        deletedAt: null
      },
      orderBy: [
        { loginId: 'asc' }
      ]
    });

    // toCaretakerResponse strips securityPin, so PINs are never sent to the client
    const caretakerResponses: CaretakerResponse[] = caretakers.map(toCaretakerResponse);

    return NextResponse.json({
      success: true,
      data: caretakerResponses,
    });
  } catch (error) {
    console.error('Error fetching caretakers for family:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch caretakers',
    }, { status: 500 });
  }
}

export const GET = withSysAdminAuth(handleGet);

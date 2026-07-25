import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse } from '../../types';
import { withAuthContext, AuthResult } from '../../utils/auth';

/**
 * POST /api/settings/verify-pin
 *
 * Verifies a submitted PIN against the family's current security PIN, server-side.
 * This exists so the client never needs the actual PIN to confirm it (e.g. the
 * "verify current PIN" step of the change-PIN flow). Scoped to the authenticated
 * user's family; only ever returns a boolean.
 */
async function handler(
  req: NextRequest,
  authContext: AuthResult
): Promise<NextResponse<ApiResponse<{ valid: boolean }>>> {
  try {
    const { familyId: userFamilyId, isSetupAuth, isSysAdmin, isAccountAuth } = authContext;

    let targetFamilyId = userFamilyId;
    if (!userFamilyId && (isSetupAuth || isSysAdmin || isAccountAuth)) {
      const { searchParams } = new URL(req.url);
      const queryFamilyId = searchParams.get('familyId');
      if (queryFamilyId) {
        targetFamilyId = queryFamilyId;
      }
    }

    if (!targetFamilyId) {
      return NextResponse.json<ApiResponse<{ valid: boolean }>>(
        { success: false, error: 'User is not associated with a family.' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const pin = typeof body?.pin === 'string' ? body.pin : '';

    if (!pin) {
      return NextResponse.json<ApiResponse<{ valid: boolean }>>({
        success: true,
        data: { valid: false },
      });
    }

    const settings = await prisma.settings.findFirst({
      where: { familyId: targetFamilyId },
      select: { securityPin: true },
    });

    const valid = !!settings && settings.securityPin === pin;

    return NextResponse.json<ApiResponse<{ valid: boolean }>>({
      success: true,
      data: { valid },
    });
  } catch (error) {
    console.error('Error verifying PIN:', error);
    return NextResponse.json<ApiResponse<{ valid: boolean }>>(
      { success: false, error: 'Failed to verify PIN' },
      { status: 500 }
    );
  }
}

export const POST = withAuthContext(handler);

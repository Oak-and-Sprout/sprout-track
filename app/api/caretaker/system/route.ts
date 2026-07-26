import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse, CaretakerResponse } from '../../types';
import { withAuthContext, AuthResult } from '../../utils/auth';
import { toCaretakerResponse } from '../../utils/caretaker';
import { resolveFamilyScope } from '../../utils/family-scope';

async function getSystemCaretaker(req: NextRequest, authContext: AuthResult) {
  try {
    const { searchParams } = new URL(req.url);
    const queryFamilyId = searchParams.get('familyId');

    const scope = resolveFamilyScope(authContext, queryFamilyId);
    if (!scope.ok) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: scope.error }, { status: scope.status });
    }
    const targetFamilyId = scope.familyId;

    // Find the system caretaker (loginId '00') for this family
    const systemCaretaker = await prisma.caretaker.findFirst({
      where: { 
        loginId: '00',
        familyId: targetFamilyId,
        deletedAt: null,
      },
    });

    if (!systemCaretaker) {
      return NextResponse.json<ApiResponse<CaretakerResponse>>(
        { success: false, error: 'System caretaker not found for this family.' },
        { status: 404 }
      );
    }

    const response: CaretakerResponse = toCaretakerResponse(systemCaretaker);

    return NextResponse.json<ApiResponse<CaretakerResponse>>({ success: true, data: response });
  } catch (error) {
    console.error('Error fetching system caretaker:', error);
    return NextResponse.json<ApiResponse<CaretakerResponse>>(
      {
        success: false,
        error: 'Failed to fetch system caretaker',
      },
      { status: 500 }
    );
  }
}

export const GET = withAuthContext(getSystemCaretaker as (req: NextRequest, authContext: AuthResult) => Promise<NextResponse<ApiResponse<any>>>);
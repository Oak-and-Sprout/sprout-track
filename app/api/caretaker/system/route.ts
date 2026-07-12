import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse, CaretakerResponse } from '../../types';
import { withAuthContext, AuthResult } from '../../utils/auth';
import { toCaretakerResponse } from '../../utils/caretaker';

async function getSystemCaretaker(req: NextRequest, authContext: AuthResult) {
  try {
    const { familyId: userFamilyId, isSetupAuth, isSysAdmin, isAccountAuth } = authContext;
    
    // Determine target family ID - prefer auth context, but allow query parameter for setup auth, account auth, and sysadmin
    let targetFamilyId = userFamilyId;
    if (!userFamilyId && (isSetupAuth || isSysAdmin || isAccountAuth)) {
      const { searchParams } = new URL(req.url);
      const queryFamilyId = searchParams.get('familyId');
      if (queryFamilyId) {
        targetFamilyId = queryFamilyId;
      }
    }
    
    if (!targetFamilyId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

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
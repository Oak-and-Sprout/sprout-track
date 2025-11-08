import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse } from '../types';
import { Settings } from '@prisma/client';
import { withAuthContext, AuthResult } from '../utils/auth';
import { checkWritePermission } from '../utils/writeProtection';

async function handleGet(req: NextRequest, authContext: AuthResult) {
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

    let settings = await prisma.settings.findFirst({
      where: { familyId: targetFamilyId },
    });
    
    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          familyName: 'My Family', // Default family name
          defaultBottleUnit: 'OZ',
          defaultSolidsUnit: 'TBSP',
          defaultHeightUnit: 'IN',
          defaultWeightUnit: 'LB',
          defaultTempUnit: 'F',
          familyId: targetFamilyId,
        },
      });
    }

    return NextResponse.json<ApiResponse<Settings>>({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json<ApiResponse<Settings>>(
      {
        success: false,
        error: 'Failed to fetch settings',
      },
      { status: 500 }
    );
  }
}

async function handlePut(req: NextRequest, authContext: AuthResult) {
  // Check write permissions for expired accounts
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) {
    return writeCheck.response!;
  }

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

    const body = await req.json();
    
    let existingSettings = await prisma.settings.findFirst({
      where: { familyId: targetFamilyId },
    });
    
    if (!existingSettings) {
      return NextResponse.json<ApiResponse<Settings>>(
        {
          success: false,
          error: 'Settings not found for this family.',
        },
        { status: 404 }
      );
    }

    const data: Partial<Settings> = {};
    const allowedFields: (keyof Settings)[] = [
      'familyName', 'securityPin', 'authType', 'defaultBottleUnit', 'defaultSolidsUnit',
      'defaultHeightUnit', 'defaultWeightUnit', 'defaultTempUnit',
      'enableDebugTimer', 'enableDebugTimezone'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        (data as any)[field] = body[field];
      }
    }
    
    const settings = await prisma.settings.update({
      where: { id: existingSettings.id },
      data,
    });

    // If securityPin was updated, also update system caretaker's pin
    if (body.securityPin !== undefined) {
      try {
        const systemCaretaker = await prisma.caretaker.findFirst({
          where: { 
            loginId: '00',
            familyId: targetFamilyId 
          }
        });

        if (systemCaretaker) {
          await prisma.caretaker.update({
            where: { id: systemCaretaker.id },
            data: { securityPin: body.securityPin }
          });
          console.log('Updated system caretaker security pin to match settings.');
        } else {
          console.log('System caretaker not found, skipping pin sync.');
        }
      } catch (error) {
        console.error('Error updating system caretaker pin (non-fatal):', error);
        // Don't fail the entire request if system caretaker update fails
      }
    }

    return NextResponse.json<ApiResponse<Settings>>({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json<ApiResponse<Settings>>(
      {
        success: false,
        error: 'Failed to update settings',
      },
      { status: 500 }
    );
  }
}

export const GET = withAuthContext(handleGet);
export const PUT = withAuthContext(handlePut);

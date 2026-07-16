import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse } from '../types';
import { Settings } from '@prisma/client';
import { withAuthContext, AuthResult } from '../utils/auth';
import { checkWritePermission } from '../utils/writeProtection';

// The family securityPin (login PIN) must never be returned to the client.
type SettingsResponse = Omit<Settings, 'securityPin'>;
function toSettingsResponse({ securityPin: _securityPin, ...rest }: Settings): SettingsResponse {
  return rest;
}

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
          growthChartStandard: 'CDC',
          enableBreastMilkTracking: true,
          includeSolidsInFeedTimer: true,
          dateFormat: 'MM/DD/YYYY',
          timeFormat: '12h',
          familyId: targetFamilyId,
        },
      });
    }

    return NextResponse.json<ApiResponse<SettingsResponse>>({
      success: true,
      data: toSettingsResponse(settings),
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json<ApiResponse<SettingsResponse>>(
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

    // Fields any authenticated user can update
    const userFields: (keyof Settings)[] = [
      'defaultBottleUnit', 'defaultSolidsUnit',
      'defaultHeightUnit', 'defaultWeightUnit', 'defaultTempUnit',
      'growthChartStandard',
    ];

    // Additional fields only admins can update
    const adminOnlyFields: (keyof Settings)[] = [
      'familyName', 'securityPin', 'authType',
      'enableDebugTimer', 'enableDebugTimezone',
      'enableBreastMilkTracking',
      'includeSolidsInFeedTimer',
      'dateFormat', 'timeFormat',
      'photoQuotaMB',
    ];

    const isAdmin = authContext.caretakerRole === 'ADMIN' ||
                    authContext.caretakerRole === 'OWNER' ||
                    authContext.isSysAdmin;

    const allowedFields = isAdmin
      ? [...userFields, ...adminOnlyFields]
      : userFields;

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        // A blank securityPin means "keep the existing PIN" — never overwrite the
        // family login PIN with an empty value (responses no longer return it).
        if (field === 'securityPin' && (body[field] === '' || body[field] === null)) {
          continue;
        }
        if (field === 'photoQuotaMB') {
          // null clears the family override, falling back to the AppConfig default.
          if (body[field] === null) {
            (data as any)[field] = null;
            continue;
          }
          const quota = parseInt(body[field], 10);
          if (isNaN(quota) || quota < 1) {
            return NextResponse.json<ApiResponse<null>>(
              { success: false, error: 'Photo quota must be a positive number of MB' },
              { status: 400 }
            );
          }
          (data as any)[field] = quota;
          continue;
        }
        if (field === 'growthChartStandard') {
          const validStandards = ['CDC', 'WHO'];
          if (!validStandards.includes(body[field])) {
            return NextResponse.json<ApiResponse<null>>(
              { success: false, error: 'growthChartStandard must be CDC or WHO' },
              { status: 400 }
            );
          }
          (data as any)[field] = body[field];
          continue;
        }
        (data as any)[field] = body[field];
      }
    }

    const settings = await prisma.settings.update({
      where: { id: existingSettings.id },
      data,
    });

    // If a non-empty securityPin was provided, also update system caretaker's pin to match
    if (body.securityPin) {
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

    return NextResponse.json<ApiResponse<SettingsResponse>>({
      success: true,
      data: toSettingsResponse(settings),
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json<ApiResponse<SettingsResponse>>(
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

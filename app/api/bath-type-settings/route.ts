import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse, BathTypeSettings } from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';

async function handleGet(req: NextRequest, authContext: AuthResult): Promise<NextResponse<ApiResponse<BathTypeSettings>>> {
  try {
    const { familyId: userFamilyId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<BathTypeSettings>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    const settings = await prisma.settings.findFirst({
      where: { familyId: userFamilyId },
      orderBy: { updatedAt: 'desc' },
    });

    const defaultResult: BathTypeSettings = { hiddenBathTypes: [] };

    if (!settings) {
      return NextResponse.json({ success: true, data: defaultResult });
    }

    const settingsWithField = settings as unknown as (typeof settings & { bathTypeSettings?: string });

    if (!settingsWithField.bathTypeSettings) {
      return NextResponse.json({ success: true, data: defaultResult });
    }

    try {
      const parsed = JSON.parse(settingsWithField.bathTypeSettings) as BathTypeSettings;
      return NextResponse.json({ success: true, data: parsed });
    } catch {
      return NextResponse.json({ success: true, data: defaultResult });
    }
  } catch (error) {
    console.error('Error retrieving bath type settings:', error);
    return NextResponse.json({ success: true, data: { hiddenBathTypes: [] } });
  }
}

async function handlePost(req: NextRequest, authContext: AuthResult): Promise<NextResponse<ApiResponse<BathTypeSettings>>> {
  try {
    const { familyId: userFamilyId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<BathTypeSettings>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    const body = await req.json();
    const { hiddenBathTypes } = body as BathTypeSettings;

    if (!Array.isArray(hiddenBathTypes)) {
      return NextResponse.json(
        { success: false, error: 'Invalid format: hiddenBathTypes must be an array' },
        { status: 400 }
      );
    }

    let settings = await prisma.settings.findFirst({
      where: { familyId: userFamilyId },
      orderBy: { updatedAt: 'desc' },
    });

    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          familyId: userFamilyId,
          familyName: 'My Family',
          securityPin: '111222',
          defaultBottleUnit: 'OZ',
          defaultSolidsUnit: 'TBSP',
          defaultHeightUnit: 'IN',
          defaultWeightUnit: 'LB',
          defaultTempUnit: 'F',
          bathTypeSettings: JSON.stringify({ hiddenBathTypes }),
        } as any,
      });
    } else {
      await prisma.settings.update({
        where: { id: settings.id },
        data: {
          ...(({ bathTypeSettings: JSON.stringify({ hiddenBathTypes }) }) as any),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: { hiddenBathTypes },
    });
  } catch (error) {
    console.error('Error saving bath type settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save bath type settings' },
      { status: 500 }
    );
  }
}

export const GET = withAuthContext(handleGet);
export const POST = withAuthContext(handlePost);

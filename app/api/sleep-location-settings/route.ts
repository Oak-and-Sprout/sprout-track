import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse, SleepLocationSettings } from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';

async function handleGet(req: NextRequest, authContext: AuthResult): Promise<NextResponse<ApiResponse<SleepLocationSettings>>> {
  try {
    const { familyId: userFamilyId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<SleepLocationSettings>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    const settings = await prisma.settings.findFirst({
      where: { familyId: userFamilyId },
      orderBy: { updatedAt: 'desc' },
    });

    const defaultResult: SleepLocationSettings = { hiddenLocations: [] };

    if (!settings) {
      return NextResponse.json({ success: true, data: defaultResult });
    }

    const settingsWithField = settings as unknown as (typeof settings & { sleepLocationSettings?: string });

    if (!settingsWithField.sleepLocationSettings) {
      return NextResponse.json({ success: true, data: defaultResult });
    }

    try {
      const parsed = JSON.parse(settingsWithField.sleepLocationSettings) as SleepLocationSettings;
      return NextResponse.json({ success: true, data: parsed });
    } catch {
      return NextResponse.json({ success: true, data: defaultResult });
    }
  } catch (error) {
    console.error('Error retrieving sleep location settings:', error);
    return NextResponse.json({ success: true, data: { hiddenLocations: [] } });
  }
}

async function handlePost(req: NextRequest, authContext: AuthResult): Promise<NextResponse<ApiResponse<SleepLocationSettings>>> {
  try {
    const { familyId: userFamilyId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<SleepLocationSettings>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    const body = await req.json();
    const { hiddenLocations } = body as SleepLocationSettings;

    if (!Array.isArray(hiddenLocations)) {
      return NextResponse.json(
        { success: false, error: 'Invalid format: hiddenLocations must be an array' },
        { status: 400 }
      );
    }

    let settings = await prisma.settings.findFirst({
      where: { familyId: userFamilyId },
      orderBy: { updatedAt: 'desc' },
    });

    // Merge with the stored JSON so other fields (e.g. customLocations) survive
    let existing: SleepLocationSettings = { hiddenLocations: [] };
    const existingRaw = (settings as unknown as { sleepLocationSettings?: string } | null)?.sleepLocationSettings;
    if (existingRaw) {
      try {
        existing = JSON.parse(existingRaw) as SleepLocationSettings;
      } catch {
        // keep defaults
      }
    }
    const merged: SleepLocationSettings = { ...existing, hiddenLocations };

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
          sleepLocationSettings: JSON.stringify(merged),
        } as any,
      });
    } else {
      await prisma.settings.update({
        where: { id: settings.id },
        data: {
          ...(({ sleepLocationSettings: JSON.stringify(merged) }) as any),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: merged,
    });
  } catch (error) {
    console.error('Error saving sleep location settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save sleep location settings' },
      { status: 500 }
    );
  }
}

export const GET = withAuthContext(handleGet);
export const POST = withAuthContext(handlePost);

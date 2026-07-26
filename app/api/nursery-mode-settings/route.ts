import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse } from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';
import { normalizeNurserySettings, NurserySettings } from '@/src/utils/nursery/settings';

async function handleGet(req: NextRequest, authContext: AuthResult): Promise<NextResponse<ApiResponse<NurserySettings>>> {
  try {
    const { familyId } = authContext;
    if (!familyId) {
      return NextResponse.json({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    const url = new URL(req.url);
    const caretakerId = url.searchParams.get('caretakerId');

    const settings = await prisma.settings.findFirst({
      where: { familyId },
      orderBy: { updatedAt: 'desc' },
    });

    if (!settings) {
      return NextResponse.json({ success: true, data: normalizeNurserySettings(undefined) });
    }

    const settingsWithNursery = settings as unknown as (typeof settings & { nurseryModeSettings?: string });

    if (!settingsWithNursery.nurseryModeSettings) {
      return NextResponse.json({ success: true, data: normalizeNurserySettings(undefined) });
    }

    let allSettings: Record<string, unknown>;
    try {
      allSettings = JSON.parse(settingsWithNursery.nurseryModeSettings);
    } catch {
      return NextResponse.json({ success: true, data: normalizeNurserySettings(undefined) });
    }

    // Cascade: caretaker-specific → global → defaults
    if (caretakerId && allSettings[caretakerId]) {
      return NextResponse.json({ success: true, data: normalizeNurserySettings(allSettings[caretakerId]) });
    }

    if (allSettings.global) {
      return NextResponse.json({ success: true, data: normalizeNurserySettings(allSettings.global) });
    }

    return NextResponse.json({ success: true, data: normalizeNurserySettings(undefined) });
  } catch (error) {
    console.error('Error retrieving nursery mode settings:', error);
    return NextResponse.json({ success: true, data: normalizeNurserySettings(undefined) });
  }
}

async function handlePost(req: NextRequest, authContext: AuthResult): Promise<NextResponse<ApiResponse<NurserySettings>>> {
  try {
    const { familyId } = authContext;
    if (!familyId) {
      return NextResponse.json({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    const body = await req.json();

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: 'Invalid nursery mode settings format' }, { status: 400 });
    }

    const caretakerId: string | null = typeof body.caretakerId === 'string' ? body.caretakerId : null;
    const normalized = normalizeNurserySettings('settings' in body ? body.settings : body);

    let currentSettings = await prisma.settings.findFirst({
      where: { familyId },
      orderBy: { updatedAt: 'desc' },
    });

    if (!currentSettings) {
      currentSettings = await prisma.settings.create({
        data: {
          familyId,
          familyName: 'My Family',
          securityPin: '111222',
          defaultBottleUnit: 'OZ',
          defaultSolidsUnit: 'TBSP',
          defaultHeightUnit: 'IN',
          defaultWeightUnit: 'LB',
          defaultTempUnit: 'F',
        },
      });
    }

    const settingsWithNursery = currentSettings as unknown as (typeof currentSettings & { nurseryModeSettings?: string });

    let allSettings: Record<string, unknown> = {};
    if (settingsWithNursery.nurseryModeSettings) {
      try {
        allSettings = JSON.parse(settingsWithNursery.nurseryModeSettings);
      } catch {
        allSettings = {};
      }
    }

    const settingsKey = caretakerId || 'global';
    allSettings[settingsKey] = normalized;

    await prisma.settings.update({
      where: { id: currentSettings.id },
      data: {
        ...(({ nurseryModeSettings: JSON.stringify(allSettings) }) as any),
      },
    });

    return NextResponse.json({ success: true, data: normalized });
  } catch (error) {
    console.error('Error saving nursery mode settings:', error);
    return NextResponse.json({ success: false, error: 'Failed to save nursery mode settings' }, { status: 500 });
  }
}

export const GET = withAuthContext(handleGet as any);
export const POST = withAuthContext(handlePost as any);

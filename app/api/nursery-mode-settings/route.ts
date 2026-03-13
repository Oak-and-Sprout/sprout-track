import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse } from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';

interface NurseryModeUserSettings {
  hue: number;
  brightness: number;
  saturation: number;
  visibleTiles: string[];
}

const DEFAULT_SETTINGS: NurseryModeUserSettings = {
  hue: 230,
  brightness: 15,
  saturation: 25,
  visibleTiles: ['feed', 'pump', 'diaper', 'sleep'],
};

async function handleGet(req: NextRequest, authContext: AuthResult): Promise<NextResponse<ApiResponse<NurseryModeUserSettings>>> {
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
      return NextResponse.json({ success: true, data: { ...DEFAULT_SETTINGS } });
    }

    const settingsWithNursery = settings as unknown as (typeof settings & { nurseryModeSettings?: string });

    if (!settingsWithNursery.nurseryModeSettings) {
      return NextResponse.json({ success: true, data: { ...DEFAULT_SETTINGS } });
    }

    let allSettings: Record<string, NurseryModeUserSettings>;
    try {
      allSettings = JSON.parse(settingsWithNursery.nurseryModeSettings);
    } catch {
      return NextResponse.json({ success: true, data: { ...DEFAULT_SETTINGS } });
    }

    // Cascade: caretaker-specific → global → defaults
    if (caretakerId && allSettings[caretakerId]) {
      return NextResponse.json({ success: true, data: { ...DEFAULT_SETTINGS, ...allSettings[caretakerId] } });
    }

    if (allSettings.global) {
      return NextResponse.json({ success: true, data: { ...DEFAULT_SETTINGS, ...allSettings.global } });
    }

    return NextResponse.json({ success: true, data: { ...DEFAULT_SETTINGS } });
  } catch (error) {
    console.error('Error retrieving nursery mode settings:', error);
    return NextResponse.json({ success: true, data: { ...DEFAULT_SETTINGS } });
  }
}

async function handlePost(req: NextRequest, authContext: AuthResult): Promise<NextResponse<ApiResponse<NurseryModeUserSettings>>> {
  try {
    const { familyId } = authContext;
    if (!familyId) {
      return NextResponse.json({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    const body = await req.json();
    const { hue, brightness, saturation, visibleTiles, caretakerId } = body;

    if (typeof hue !== 'number' || typeof brightness !== 'number' || !Array.isArray(visibleTiles)) {
      return NextResponse.json({ success: false, error: 'Invalid nursery mode settings format' }, { status: 400 });
    }

    const effectiveSaturation = typeof saturation === 'number' ? saturation : DEFAULT_SETTINGS.saturation;

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

    let allSettings: Record<string, NurseryModeUserSettings> = {};
    if (settingsWithNursery.nurseryModeSettings) {
      try {
        allSettings = JSON.parse(settingsWithNursery.nurseryModeSettings);
      } catch {
        allSettings = {};
      }
    }

    const settingsKey = caretakerId || 'global';
    const userSettings: NurseryModeUserSettings = { hue, brightness, saturation: effectiveSaturation, visibleTiles };

    allSettings[settingsKey] = userSettings;

    await prisma.settings.update({
      where: { id: currentSettings.id },
      data: {
        ...(({ nurseryModeSettings: JSON.stringify(allSettings) }) as any),
      },
    });

    return NextResponse.json({ success: true, data: userSettings });
  } catch (error) {
    console.error('Error saving nursery mode settings:', error);
    return NextResponse.json({ success: false, error: 'Failed to save nursery mode settings' }, { status: 500 });
  }
}

export const GET = withAuthContext(handleGet as any);
export const POST = withAuthContext(handlePost as any);

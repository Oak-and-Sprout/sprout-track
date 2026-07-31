import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse, SleepLocationSettings } from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';
import { mergeLocationSettings } from '@/src/utils/sleepLocationUtils';

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
    // The body is a partial patch, not a full settings object — a visibility
    // toggle sends only hiddenLocations and a reorder sends only locationOrder.
    const { hiddenLocations, locationOrder } = body as Partial<SleepLocationSettings>;

    const isStringArray = (v: unknown): v is string[] =>
      Array.isArray(v) && v.every((n) => typeof n === 'string');

    if (hiddenLocations === undefined && locationOrder === undefined) {
      return NextResponse.json(
        { success: false, error: 'Provide hiddenLocations, locationOrder, or both' },
        { status: 400 }
      );
    }
    if (hiddenLocations !== undefined && !isStringArray(hiddenLocations)) {
      return NextResponse.json(
        { success: false, error: 'Invalid format: hiddenLocations must be an array of strings' },
        { status: 400 }
      );
    }
    if (locationOrder !== undefined && !isStringArray(locationOrder)) {
      return NextResponse.json(
        { success: false, error: 'Invalid format: locationOrder must be an array of strings' },
        { status: 400 }
      );
    }

    // Read-modify-write inside a transaction so a concurrent save from an open
    // SleepForm gear panel can't be clobbered with stale data — same reasoning
    // as the $transaction in /api/sleep-locations.
    const merged = await prisma.$transaction(async (tx) => {
      const settings = await tx.settings.findFirst({
        where: { familyId: userFamilyId },
        orderBy: { updatedAt: 'desc' },
      });

      let existing: SleepLocationSettings = { hiddenLocations: [] };
      const existingRaw = (settings as unknown as { sleepLocationSettings?: string } | null)?.sleepLocationSettings;
      if (existingRaw) {
        try {
          existing = JSON.parse(existingRaw) as SleepLocationSettings;
        } catch {
          // keep defaults
        }
      }

      // Only fields actually present in the request overwrite stored values, so
      // a locationOrder-only save can't drop customLocations and vice versa.
      const next = mergeLocationSettings(existing, { hiddenLocations, locationOrder });

      if (!settings) {
        await tx.settings.create({
          data: {
            familyId: userFamilyId,
            familyName: 'My Family',
            securityPin: '111222',
            defaultBottleUnit: 'OZ',
            defaultSolidsUnit: 'TBSP',
            defaultHeightUnit: 'IN',
            defaultWeightUnit: 'LB',
            defaultTempUnit: 'F',
            sleepLocationSettings: JSON.stringify(next),
          } as any,
        });
      } else {
        await tx.settings.update({
          where: { id: settings.id },
          data: ({ sleepLocationSettings: JSON.stringify(next) }) as any,
        });
      }

      return next;
    });

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

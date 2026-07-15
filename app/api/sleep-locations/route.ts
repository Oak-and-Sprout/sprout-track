import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import {
  ApiResponse,
  SleepLocationRenameResult,
  SleepLocationSettings,
  SleepLocationSummary,
} from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';
import { checkWritePermission } from '../utils/writeProtection';
import {
  buildSleepLocationSummaries,
  updateSettingsAfterDelete,
  updateSettingsAfterRename,
  validateLocationAdd,
  validateLocationDelete,
  validateLocationRename,
  SleepLocationSettingsShape,
} from '@/src/utils/sleepLocationUtils';

type SettingsRecord = { id: string; sleepLocationSettings?: string | null } | null;

function parseLocationSettings(settings: SettingsRecord): SleepLocationSettingsShape {
  const empty: SleepLocationSettingsShape = { hiddenLocations: [], customLocations: [] };
  if (!settings?.sleepLocationSettings) return empty;
  try {
    const parsed = JSON.parse(settings.sleepLocationSettings) as SleepLocationSettings;
    return {
      hiddenLocations: Array.isArray(parsed.hiddenLocations) ? parsed.hiddenLocations : [],
      customLocations: Array.isArray(parsed.customLocations) ? parsed.customLocations : [],
    };
  } catch {
    return empty;
  }
}

const findSettings = (client: typeof prisma | any, familyId: string) =>
  client.settings.findFirst({
    where: { familyId },
    orderBy: { updatedAt: 'desc' },
  });

/** Persists the settings shape, creating the family's Settings row if needed. */
async function writeLocationSettings(
  tx: any,
  familyId: string,
  settings: SettingsRecord,
  shape: SleepLocationSettingsShape,
) {
  const sleepLocationSettings = JSON.stringify(shape);
  if (settings) {
    await tx.settings.update({
      where: { id: settings.id },
      data: { sleepLocationSettings } as any,
    });
  } else {
    await tx.settings.create({
      data: {
        familyId,
        familyName: 'My Family',
        securityPin: '111222',
        defaultBottleUnit: 'OZ',
        defaultSolidsUnit: 'TBSP',
        defaultHeightUnit: 'IN',
        defaultWeightUnit: 'LB',
        defaultTempUnit: 'F',
        sleepLocationSettings,
      } as any,
    });
  }
}

async function getSummaries(familyId: string): Promise<SleepLocationSummary[]> {
  const grouped = await prisma.sleepLog.groupBy({
    by: ['location'],
    where: {
      familyId,
      deletedAt: null,
      location: { not: null },
    },
    _count: { _all: true },
  });
  const settings = await findSettings(prisma, familyId);
  const { hiddenLocations, customLocations } = parseLocationSettings(settings);
  return buildSleepLocationSummaries(
    grouped.map((g: any) => ({ location: g.location, count: g._count._all })),
    hiddenLocations,
    customLocations,
  );
}

async function handleGet(req: NextRequest, authContext: AuthResult): Promise<NextResponse<ApiResponse<SleepLocationSummary[]>>> {
  try {
    const { familyId: userFamilyId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<SleepLocationSummary[]>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: await getSummaries(userFamilyId) });
  } catch (error) {
    console.error('Error retrieving sleep locations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load sleep locations' },
      { status: 500 }
    );
  }
}

async function handlePost(req: NextRequest, authContext: AuthResult): Promise<NextResponse<ApiResponse<{ name: string }>>> {
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) {
    return writeCheck.response!;
  }

  try {
    const { familyId: userFamilyId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<{ name: string }>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    const body = await req.json();
    const existingNames = (await getSummaries(userFamilyId)).map((l) => l.name);
    const validation = validateLocationAdd(body.name, existingNames);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }
    const { name } = validation;

    await prisma.$transaction(async (tx) => {
      const settings = await findSettings(tx, userFamilyId);
      const shape = parseLocationSettings(settings);
      shape.customLocations = [...shape.customLocations, name];
      await writeLocationSettings(tx, userFamilyId, settings, shape);
    });

    return NextResponse.json({ success: true, data: { name } });
  } catch (error) {
    console.error('Error adding sleep location:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update sleep locations' },
      { status: 500 }
    );
  }
}

async function handlePut(req: NextRequest, authContext: AuthResult): Promise<NextResponse<ApiResponse<SleepLocationRenameResult>>> {
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) {
    return writeCheck.response!;
  }

  try {
    const { familyId: userFamilyId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<SleepLocationRenameResult>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    const body = await req.json();
    const validation = validateLocationRename(body.from, body.to);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }
    const { from, to } = validation;

    const updatedCount = await prisma.$transaction(async (tx) => {
      const updated = await tx.sleepLog.updateMany({
        where: { familyId: userFamilyId, location: from },
        data: { location: to },
      });

      // Re-read settings inside the transaction so a concurrent hide/show
      // save from an open SleepForm can't be clobbered with stale data.
      const settings = await findSettings(tx, userFamilyId);
      if (settings) {
        const shape = parseLocationSettings(settings);
        const next = updateSettingsAfterRename(shape, from, to);
        if (JSON.stringify(next) !== JSON.stringify(shape)) {
          await writeLocationSettings(tx, userFamilyId, settings, next);
        }
      }

      return updated.count;
    });

    return NextResponse.json({ success: true, data: { updatedCount } });
  } catch (error) {
    console.error('Error renaming sleep location:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update sleep locations' },
      { status: 500 }
    );
  }
}

async function handleDelete(req: NextRequest, authContext: AuthResult): Promise<NextResponse<ApiResponse<{ removed: boolean }>>> {
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) {
    return writeCheck.response!;
  }

  try {
    const { familyId: userFamilyId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<{ removed: boolean }>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    const body = await req.json();
    const validation = validateLocationDelete(body.name);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }
    const { name } = validation;

    const inUseError = 'This location is still in use. Merge it into another location instead.';
    await prisma.$transaction(async (tx) => {
      const inUse = await tx.sleepLog.count({
        where: { familyId: userFamilyId, location: name, deletedAt: null },
      });
      if (inUse > 0) {
        throw new Error(inUseError);
      }

      const settings = await findSettings(tx, userFamilyId);
      if (settings) {
        const shape = parseLocationSettings(settings);
        const next = updateSettingsAfterDelete(shape, name);
        if (JSON.stringify(next) !== JSON.stringify(shape)) {
          await writeLocationSettings(tx, userFamilyId, settings, next);
        }
      }
    });

    return NextResponse.json({ success: true, data: { removed: true } });
  } catch (error) {
    if (error instanceof Error && error.message.includes('still in use')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
    console.error('Error deleting sleep location:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update sleep locations' },
      { status: 500 }
    );
  }
}

export const GET = withAuthContext(handleGet);
export const POST = withAuthContext(handlePost);
export const PUT = withAuthContext(handlePut);
export const DELETE = withAuthContext(handleDelete);

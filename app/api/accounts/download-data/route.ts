import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse } from '../../types';
import { withAuthContext, AuthResult } from '../../utils/auth';
import { buildFamilyMigration } from '../../utils/family-migration-export';

async function handleGet(req: NextRequest, authContext: AuthResult) {
  try {
    const { accountId, isAccountAuth, familyId } = authContext;

    if (!isAccountAuth || !accountId || !familyId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Account authentication and family association required' },
        { status: 403 }
      );
    }

    // Resolve the family slug for the download filename (scoped to the caller's family).
    const family = await prisma.family.findUnique({
      where: { id: familyId },
      select: { slug: true },
    });

    if (!family) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Family not found' },
        { status: 404 }
      );
    }

    // Build the full family-migration archive (plaintext PINs + decrypted media by design).
    const zipBuffer = await buildFamilyMigration(familyId);
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const filename = `${family.slug}-migration-${date}.zip`;

    // Convert Buffer to Uint8Array for NextResponse compatibility, preserving offset/length.
    const bufferArray = new Uint8Array(
      zipBuffer.buffer as ArrayBuffer,
      zipBuffer.byteOffset,
      zipBuffer.byteLength
    );

    return new NextResponse(bufferArray, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': bufferArray.length.toString(),
      },
    });

  } catch (error) {
    console.error('Error creating data export:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to create data export' },
      { status: 500 }
    );
  }
}

export const GET = withAuthContext(handleGet as any);

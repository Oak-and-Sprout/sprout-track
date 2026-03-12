import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '../db';
import { ApiResponse } from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';
import { checkWritePermission } from '../utils/writeProtection';

function isAdmin(authContext: AuthResult): boolean {
  return (
    authContext.caretakerRole === 'ADMIN' ||
    authContext.caretakerRole === 'OWNER' ||
    authContext.isSysAdmin === true ||
    (authContext.isAccountAuth === true && authContext.isAccountOwner === true)
  );
}

function getFamilyId(authContext: AuthResult, req: NextRequest): string | null {
  let familyId = authContext.familyId || null;
  if (!familyId && authContext.isSysAdmin) {
    const { searchParams } = new URL(req.url);
    familyId = searchParams.get('familyId');
  }
  return familyId;
}

async function handleGet(req: NextRequest, authContext: AuthResult) {
  try {
    if (!isAdmin(authContext)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const familyId = getFamilyId(authContext, req);
    if (!familyId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'No family context' },
        { status: 403 }
      );
    }

    const keys = await prisma.apiKey.findMany({
      where: { familyId },
      include: {
        baby: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = keys.map((key) => ({
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      scopes: JSON.parse(key.scopes) as string[],
      babyId: key.babyId,
      babyName: key.baby ? `${key.baby.firstName} ${key.baby.lastName}` : null,
      lastUsedAt: key.lastUsedAt?.toISOString() || null,
      expiresAt: key.expiresAt?.toISOString() || null,
      revoked: key.revoked,
      createdAt: key.createdAt.toISOString(),
    }));

    return NextResponse.json<ApiResponse<typeof data>>({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to fetch API keys' },
      { status: 500 }
    );
  }
}

async function handlePost(req: NextRequest, authContext: AuthResult) {
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) {
    return writeCheck.response!;
  }

  try {
    if (!isAdmin(authContext)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const familyId = getFamilyId(authContext, req);
    if (!familyId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'No family context' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, scopes, babyId, expiresAt } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Key name is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(scopes) || scopes.length === 0 || !scopes.every((s: string) => ['read', 'write'].includes(s))) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Valid scopes are required (read, write)' },
        { status: 400 }
      );
    }

    // Validate babyId belongs to family if provided
    if (babyId) {
      const baby = await prisma.baby.findFirst({
        where: { id: babyId, familyId },
      });
      if (!baby) {
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: 'Baby not found in this family' },
          { status: 400 }
        );
      }
    }

    // Generate key: st_live_ + 32 hex chars
    const rawKey = crypto.randomBytes(16).toString('hex');
    const fullKey = `st_live_${rawKey}`;
    const keyPrefix = fullKey.substring(0, 16);
    const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');

    const apiKey = await prisma.apiKey.create({
      data: {
        name: name.trim(),
        keyPrefix,
        keyHash,
        familyId,
        babyId: babyId || null,
        scopes: JSON.stringify(scopes),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    return NextResponse.json<ApiResponse<{ id: string; fullKey: string }>>({
      success: true,
      data: {
        id: apiKey.id,
        fullKey,
      },
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to create API key' },
      { status: 500 }
    );
  }
}

async function handleDelete(req: NextRequest, authContext: AuthResult) {
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) {
    return writeCheck.response!;
  }

  try {
    if (!isAdmin(authContext)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const familyId = getFamilyId(authContext, req);
    if (!familyId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'No family context' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Key ID is required' },
        { status: 400 }
      );
    }

    // Verify key belongs to this family
    const existingKey = await prisma.apiKey.findFirst({
      where: { id, familyId },
    });

    if (!existingKey) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'API key not found' },
        { status: 404 }
      );
    }

    if (existingKey.revoked) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Key is already revoked' },
        { status: 400 }
      );
    }

    await prisma.apiKey.update({
      where: { id },
      data: { revoked: true },
    });

    return NextResponse.json<ApiResponse<{ revoked: boolean }>>({
      success: true,
      data: { revoked: true },
    });
  } catch (error) {
    console.error('Error revoking API key:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to revoke API key' },
      { status: 500 }
    );
  }
}

export const GET = withAuthContext(handleGet);
export const POST = withAuthContext(handlePost);
export const DELETE = withAuthContext(handleDelete);

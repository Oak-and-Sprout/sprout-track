import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse } from '../../types';
import { withSysAdminAuth } from '../../utils/auth';
import { decrypt, isEncrypted } from '../../utils/encryption';

/**
 * POST /api/app-config/verify-admin-password
 *
 * Verifies a submitted password against the current site admin password, server-side,
 * so the client never needs the actual password to confirm it (e.g. the "verify current
 * password" step of the change-password flow). System administrators only; returns a
 * boolean and nothing else.
 */
async function handler(
  req: NextRequest
): Promise<NextResponse<ApiResponse<{ valid: boolean }>>> {
  try {
    const body = await req.json().catch(() => ({}));
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!password) {
      return NextResponse.json<ApiResponse<{ valid: boolean }>>({
        success: true,
        data: { valid: false },
      });
    }

    const appConfig = await prisma.appConfig.findFirst();

    // Resolve the current admin password (defaults to "admin" when unset)
    let currentPass = 'admin';
    if (appConfig?.adminPass && appConfig.adminPass.trim() !== '') {
      currentPass = isEncrypted(appConfig.adminPass) ? decrypt(appConfig.adminPass) : appConfig.adminPass;
    }

    return NextResponse.json<ApiResponse<{ valid: boolean }>>({
      success: true,
      data: { valid: password === currentPass },
    });
  } catch (error) {
    console.error('Error verifying admin password:', error);
    return NextResponse.json<ApiResponse<{ valid: boolean }>>(
      { success: false, error: 'Failed to verify password' },
      { status: 500 }
    );
  }
}

export const POST = withSysAdminAuth(handler);

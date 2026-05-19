import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse } from '../../types';
import { withAuthContext, AuthResult } from '../../utils/auth';
import packageInfo from '@/package.json';

interface ChangelogSeenData {
  hasNewUpdates: boolean;
  currentVersion: string;
  lastSeenVersion: string | null;
}

async function handleGet(req: NextRequest, authContext: AuthResult) {
  try {
    const { isAccountAuth, accountId, caretakerId, isSysAdmin } = authContext;

    if (isSysAdmin) {
      return NextResponse.json<ApiResponse<ChangelogSeenData>>({
        success: true,
        data: { hasNewUpdates: false, currentVersion: packageInfo.version, lastSeenVersion: packageInfo.version }
      });
    }

    if (isAccountAuth && accountId) {
      const account = await prisma.account.findUnique({
        where: { id: accountId },
        select: { lastSeenVersion: true }
      });

      const lastSeenVersion = account?.lastSeenVersion || null;
      return NextResponse.json<ApiResponse<ChangelogSeenData>>({
        success: true,
        data: { hasNewUpdates: lastSeenVersion !== packageInfo.version, currentVersion: packageInfo.version, lastSeenVersion }
      });
    }

    if (caretakerId) {
      const caretaker = await prisma.caretaker.findUnique({
        where: { id: caretakerId },
        select: { lastSeenVersion: true }
      });

      const lastSeenVersion = caretaker?.lastSeenVersion || null;
      return NextResponse.json<ApiResponse<ChangelogSeenData>>({
        success: true,
        data: { hasNewUpdates: lastSeenVersion !== packageInfo.version, currentVersion: packageInfo.version, lastSeenVersion }
      });
    }

    return NextResponse.json<ApiResponse<ChangelogSeenData>>({
      success: true,
      data: { hasNewUpdates: false, currentVersion: packageInfo.version, lastSeenVersion: null }
    });
  } catch (error) {
    console.error('Error checking changelog seen status:', error);
    return NextResponse.json<ApiResponse<ChangelogSeenData>>(
      { success: false, error: 'Failed to check changelog seen status' },
      { status: 500 }
    );
  }
}

async function handlePut(req: NextRequest, authContext: AuthResult) {
  try {
    const { isAccountAuth, accountId, caretakerId, isSysAdmin } = authContext;
    const body = await req.json();
    const version = body.version || packageInfo.version;

    if (isSysAdmin) {
      return NextResponse.json<ApiResponse<{ lastSeenVersion: string }>>({
        success: true,
        data: { lastSeenVersion: version }
      });
    }

    if (isAccountAuth && accountId) {
      await prisma.account.update({
        where: { id: accountId },
        data: { lastSeenVersion: version }
      });

      return NextResponse.json<ApiResponse<{ lastSeenVersion: string }>>({
        success: true,
        data: { lastSeenVersion: version }
      });
    }

    if (caretakerId) {
      await prisma.caretaker.update({
        where: { id: caretakerId },
        data: { lastSeenVersion: version }
      });

      return NextResponse.json<ApiResponse<{ lastSeenVersion: string }>>({
        success: true,
        data: { lastSeenVersion: version }
      });
    }

    return NextResponse.json<ApiResponse<{ lastSeenVersion: string }>>(
      { success: false, error: 'User is not authenticated.' },
      { status: 401 }
    );
  } catch (error) {
    console.error('Error updating changelog seen status:', error);
    return NextResponse.json<ApiResponse<{ lastSeenVersion: string }>>(
      { success: false, error: 'Failed to update changelog seen status' },
      { status: 500 }
    );
  }
}

export const GET = withAuthContext(handleGet);
export const PUT = withAuthContext(handlePut);

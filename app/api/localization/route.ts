import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse } from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';
import { supportedLanguageCodes } from '@/src/localization/supported-languages-config';

const supportedSet = new Set(supportedLanguageCodes);

/**
 * Validates if a language code is allowed (configured in supported-languages.json)
 */
function isValidLanguageCode(lang: string): boolean {
  if (!lang || typeof lang !== 'string' || lang.length !== 2 || !/^[a-z]{2}$/i.test(lang)) {
    return false;
  }
  return supportedSet.has(lang.toLowerCase());
}

/**
 * GET /api/localization
 * Retrieves the current user's language preference
 */
async function handleGet(req: NextRequest, authContext: AuthResult) {
  try {
    const { isAccountAuth, accountId, caretakerId, isSysAdmin } = authContext;

    // System administrators use sessionStorage, so return default
    // The client will handle reading from sessionStorage
    if (isSysAdmin) {
      return NextResponse.json<ApiResponse<{ language: string }>>({
        success: true,
        data: { language: 'en' }
      });
    }

    // If user is authenticated via account, fetch from Account table
    if (isAccountAuth && accountId) {
      const account = await prisma.account.findUnique({
        where: { id: accountId },
        select: { language: true }
      });

      const language = account?.language || 'en';
      return NextResponse.json<ApiResponse<{ language: string }>>({
        success: true,
        data: { language }
      });
    }

    // If user is authenticated via caretaker, fetch from Caretaker table
    if (caretakerId) {
      const caretaker = await prisma.caretaker.findUnique({
        where: { id: caretakerId },
        select: { language: true }
      });

      const language = caretaker?.language || 'en';
      return NextResponse.json<ApiResponse<{ language: string }>>({
        success: true,
        data: { language }
      });
    }

    // User is not authenticated, return default
    return NextResponse.json<ApiResponse<{ language: string }>>({
      success: true,
      data: { language: 'en' }
    });
  } catch (error) {
    console.error('Error fetching language preference:', error);
    return NextResponse.json<ApiResponse<{ language: string }>>(
      {
        success: false,
        error: 'Failed to fetch language preference',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/localization
 * Updates the current user's language preference
 * 
 * Note: Language preference changes are allowed regardless of subscription status
 * (similar to read operations) to ensure users can always access the app in their preferred language
 */
async function handlePut(req: NextRequest, authContext: AuthResult) {
  try {
    const { isAccountAuth, accountId, caretakerId, isSysAdmin } = authContext;
    const body = await req.json();
    const { language } = body;

    // Validate language code
    if (!language || !isValidLanguageCode(language)) {
      return NextResponse.json<ApiResponse<{ language: string }>>(
        {
          success: false,
          error: 'Invalid language code. Must be a supported language from supported-languages.json.',
        },
        { status: 400 }
      );
    }

    const normalizedLanguage = language.toLowerCase();

    // System administrators use sessionStorage, so just return success
    // The client will handle storing in sessionStorage
    if (isSysAdmin) {
      return NextResponse.json<ApiResponse<{ language: string }>>({
        success: true,
        data: { language: normalizedLanguage }
      });
    }

    // If user is authenticated via account, update Account table
    if (isAccountAuth && accountId) {
      const account = await prisma.account.update({
        where: { id: accountId },
        data: { language: normalizedLanguage },
        select: { language: true }
      });

      return NextResponse.json<ApiResponse<{ language: string }>>({
        success: true,
        data: { language: account.language || 'en' }
      });
    }

    // If user is authenticated via caretaker, update Caretaker table
    if (caretakerId) {
      const caretaker = await prisma.caretaker.update({
        where: { id: caretakerId },
        data: { language: normalizedLanguage },
        select: { language: true }
      });

      return NextResponse.json<ApiResponse<{ language: string }>>({
        success: true,
        data: { language: caretaker.language || 'en' }
      });
    }

    // User is not authenticated
    return NextResponse.json<ApiResponse<{ language: string }>>(
      {
        success: false,
        error: 'User is not authenticated.',
      },
      { status: 401 }
    );
  } catch (error) {
    console.error('Error updating language preference:', error);
    return NextResponse.json<ApiResponse<{ language: string }>>(
      {
        success: false,
        error: 'Failed to update language preference',
      },
      { status: 500 }
    );
  }
}

export const GET = withAuthContext(handleGet);
export const PUT = withAuthContext(handlePut);

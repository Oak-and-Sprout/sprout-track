import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse } from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';
import { checkWritePermission } from '../utils/writeProtection';

/**
 * Valid ISO 639-1 language codes (2-letter codes)
 * Common languages supported by the application
 */
const VALID_LANGUAGE_CODES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ru', 'ar', 'hi'];

/**
 * Validates if a language code is a valid ISO 639-1 code
 */
function isValidLanguageCode(lang: string): boolean {
  if (!lang || typeof lang !== 'string' || lang.length !== 2) {
    return false;
  }
  // Check if it's in our supported list or matches ISO 639-1 pattern (2 lowercase letters)
  return VALID_LANGUAGE_CODES.includes(lang.toLowerCase()) || /^[a-z]{2}$/.test(lang.toLowerCase());
}

/**
 * GET /api/localization
 * Retrieves the current user's language preference
 */
async function handleGet(req: NextRequest, authContext: AuthResult) {
  try {
    const { isAccountAuth, accountId, caretakerId } = authContext;

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
 */
async function handlePut(req: NextRequest, authContext: AuthResult) {
  // Check write permissions for expired accounts
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) {
    return writeCheck.response!;
  }

  try {
    const { isAccountAuth, accountId, caretakerId } = authContext;
    const body = await req.json();
    const { language } = body;

    // Validate language code
    if (!language || !isValidLanguageCode(language)) {
      return NextResponse.json<ApiResponse<{ language: string }>>(
        {
          success: false,
          error: 'Invalid language code. Must be a valid ISO 639-1 code (2 letters).',
        },
        { status: 400 }
      );
    }

    const normalizedLanguage = language.toLowerCase();

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

import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse, VaccineDocumentResponse } from '../../types';
import { withAuthContext, AuthResult } from '../../utils/auth';
import { encryptAndStore, generateStoredName } from '@/src/lib/file-encryption';
import { formatForResponse } from '../../utils/timezone';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Handle POST request to upload a document for a vaccine log
 */
async function handlePost(req: NextRequest, authContext: AuthResult) {
  try {
    const { familyId: userFamilyId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    const formData = await req.formData();
    const vaccineLogId = formData.get('vaccineLogId') as string;
    const file = formData.get('file') as File;

    if (!vaccineLogId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Vaccine log ID is required' },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'File is required' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'File size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    // Verify vaccine log belongs to user's family
    const vaccineLog = await prisma.vaccineLog.findFirst({
      where: { id: vaccineLogId, familyId: userFamilyId },
    });

    if (!vaccineLog) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Vaccine log not found or access denied' },
        { status: 404 }
      );
    }

    // Encrypt and store the file
    const buffer = Buffer.from(await file.arrayBuffer());
    const storedName = generateStoredName();
    encryptAndStore(buffer, storedName);

    // Create document record
    const document = await prisma.vaccineDocument.create({
      data: {
        originalName: file.name,
        storedName,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
        vaccineLogId,
      },
    });

    const response: VaccineDocumentResponse = {
      id: document.id,
      originalName: document.originalName,
      mimeType: document.mimeType,
      fileSize: document.fileSize,
      createdAt: formatForResponse(document.createdAt) || '',
      updatedAt: formatForResponse(document.updatedAt) || '',
    };

    return NextResponse.json<ApiResponse<VaccineDocumentResponse>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error uploading vaccine document:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to upload vaccine document',
      },
      { status: 500 }
    );
  }
}

// Apply authentication middleware
export const POST = withAuthContext(handlePost as any);

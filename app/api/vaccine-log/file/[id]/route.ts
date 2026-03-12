import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../db';
import { ApiResponse } from '../../../types';
import { withAuthContext, AuthResult } from '../../../utils/auth';
import { decryptFile, deleteEncryptedFile } from '@/src/lib/file-encryption';

/**
 * Handle GET request to download a vaccine document
 */
async function handleGet(req: NextRequest, authContext: AuthResult) {
  try {
    const { familyId: userFamilyId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    // Extract id from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 1];

    if (!id) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Document ID is required' },
        { status: 400 }
      );
    }

    // Lookup document and verify family access through vaccineLog relation
    const document = await prisma.vaccineDocument.findFirst({
      where: {
        id,
        vaccineLog: {
          familyId: userFamilyId,
        },
      },
    });

    if (!document) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Document not found or access denied' },
        { status: 404 }
      );
    }

    // Decrypt the file
    const decryptedBuffer = decryptFile(document.storedName);

    // Encode filename for Content-Disposition (RFC 5987) to handle non-ASCII chars
    const encodedFilename = encodeURIComponent(document.originalName).replace(/['()]/g, escape);

    return new NextResponse(decryptedBuffer.buffer.slice(decryptedBuffer.byteOffset, decryptedBuffer.byteOffset + decryptedBuffer.byteLength), {
      headers: {
        'Content-Type': document.mimeType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
        'Content-Length': decryptedBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error downloading vaccine document:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to download vaccine document',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle DELETE request to delete a vaccine document
 */
async function handleDelete(req: NextRequest, authContext: AuthResult) {
  try {
    const { familyId: userFamilyId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    // Extract id from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 1];

    if (!id) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Document ID is required' },
        { status: 400 }
      );
    }

    // Lookup document and verify family access through vaccineLog relation
    const document = await prisma.vaccineDocument.findFirst({
      where: {
        id,
        vaccineLog: {
          familyId: userFamilyId,
        },
      },
    });

    if (!document) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Document not found or access denied' },
        { status: 404 }
      );
    }

    // Delete encrypted file from disk
    deleteEncryptedFile(document.storedName);

    // Delete document record
    await prisma.vaccineDocument.delete({
      where: { id },
    });

    return NextResponse.json<ApiResponse>({
      success: true,
    });
  } catch (error) {
    console.error('Error deleting vaccine document:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: 'Failed to delete vaccine document',
      },
      { status: 500 }
    );
  }
}

// Apply authentication middleware
export const GET = withAuthContext(handleGet as any);
export const DELETE = withAuthContext(handleDelete as any);

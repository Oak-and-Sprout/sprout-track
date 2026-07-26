import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../db';
import { ApiResponse } from '../../../types';
import { withAuthContext, AuthResult } from '../../../utils/auth';
import { decryptFile } from '@/src/lib/file-encryption';
import { isPhotosEnabled, photosDisabledResponse, photoSubdir } from '../../photo-service';

/**
 * GET /api/photos/file/[id]?size=thumb|full&trash=true
 * Decrypt and serve a photo inline. Trashed photos are only served when
 * trash=true (Trash view tiles); otherwise 404.
 */
async function handleGet(req: NextRequest, authContext: AuthResult) {
  if (!(await isPhotosEnabled())) return photosDisabledResponse();

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 1];
    const size = url.searchParams.get('size') === 'thumb' ? 'thumb' : 'full';
    const allowTrashed = url.searchParams.get('trash') === 'true';

    if (!id) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Photo ID is required' }, { status: 400 });
    }

    const photo = await prisma.photo.findFirst({
      where: { id, familyId: authContext.familyId },
    });
    if (!photo || (photo.deletedAt && !allowTrashed)) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Photo not found' }, { status: 404 });
    }

    const storedName = size === 'thumb' ? photo.thumbStoredName : photo.storedName;
    const mimeType = size === 'thumb' ? 'image/jpeg' : photo.mimeType;
    const decryptedBuffer = decryptFile(storedName, photoSubdir(authContext.familyId!));

    return new NextResponse(
      decryptedBuffer.buffer.slice(
        decryptedBuffer.byteOffset,
        decryptedBuffer.byteOffset + decryptedBuffer.byteLength
      ) as ArrayBuffer,
      {
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': 'inline',
          'Content-Length': decryptedBuffer.length.toString(),
          'Cache-Control': 'private, max-age=3600',
        },
      }
    );
  } catch (error) {
    console.error('Error serving photo:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to load photo' }, { status: 500 });
  }
}

export const GET = withAuthContext(handleGet as any);

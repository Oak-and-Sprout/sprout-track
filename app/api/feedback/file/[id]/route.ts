import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../db';
import { ApiResponse } from '../../../types';
import { withAuthContext, AuthResult } from '../../../utils/auth';
import { decryptFile, deleteEncryptedFile } from '@/src/lib/file-encryption';

/**
 * Verify the caller has access to the attachment's feedback thread.
 */
async function verifyAccess(attachmentId: string, authContext: AuthResult) {
  const attachment = await prisma.feedbackAttachment.findUnique({
    where: { id: attachmentId },
    include: {
      feedback: {
        select: {
          accountId: true,
          caretakerId: true,
          familyId: true,
          parentId: true,
          parent: { select: { accountId: true, caretakerId: true } },
        },
      },
    },
  });

  if (!attachment) return null;

  const isAdmin = authContext.isSysAdmin || authContext.caretakerRole === 'ADMIN';
  if (isAdmin) return attachment;

  const fb = attachment.feedback;
  let hasAccess = false;
  if (authContext.isAccountAuth && authContext.accountId) {
    hasAccess = fb.accountId === authContext.accountId ||
      (!!fb.parent && fb.parent.accountId === authContext.accountId);
  } else if (authContext.caretakerId) {
    hasAccess = fb.caretakerId === authContext.caretakerId ||
      (!!fb.parent && fb.parent.caretakerId === authContext.caretakerId);
  }

  return hasAccess ? attachment : null;
}

/**
 * GET /api/feedback/file/[id]
 * Decrypt and serve a feedback image inline
 */
async function handleGet(req: NextRequest, authContext: AuthResult) {
  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 1];

    if (!id) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Attachment ID is required' },
        { status: 400 }
      );
    }

    const attachment = await verifyAccess(id, authContext);
    if (!attachment) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Attachment not found or access denied' },
        { status: 404 }
      );
    }

    const decryptedBuffer = decryptFile(attachment.storedName, 'feedback');

    return new NextResponse(
      decryptedBuffer.buffer.slice(
        decryptedBuffer.byteOffset,
        decryptedBuffer.byteOffset + decryptedBuffer.byteLength
      ) as ArrayBuffer,
      {
        headers: {
          'Content-Type': attachment.mimeType,
          'Content-Disposition': 'inline',
          'Content-Length': decryptedBuffer.length.toString(),
          'Cache-Control': 'private, max-age=3600',
        },
      }
    );
  } catch (error) {
    console.error('Error serving feedback attachment:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to load attachment' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/feedback/file/[id]
 * Delete a feedback image attachment
 */
async function handleDelete(req: NextRequest, authContext: AuthResult) {
  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 1];

    if (!id) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Attachment ID is required' },
        { status: 400 }
      );
    }

    const attachment = await verifyAccess(id, authContext);
    if (!attachment) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Attachment not found or access denied' },
        { status: 404 }
      );
    }

    // Delete encrypted file from disk
    deleteEncryptedFile(attachment.storedName, 'feedback');

    // Delete database record
    await prisma.feedbackAttachment.delete({
      where: { id },
    });

    return NextResponse.json<ApiResponse>({ success: true });
  } catch (error) {
    console.error('Error deleting feedback attachment:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to delete attachment' },
      { status: 500 }
    );
  }
}

export const GET = withAuthContext(handleGet as any);
export const DELETE = withAuthContext(handleDelete as any);

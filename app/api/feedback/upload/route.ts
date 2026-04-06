import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import prisma from '../../db';
import { ApiResponse, FeedbackAttachmentResponse } from '../../types';
import { withAuthContext, AuthResult } from '../../utils/auth';
import { encryptAndStore, generateStoredName } from '@/src/lib/file-encryption';
import { formatForResponse } from '../../utils/timezone';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
  'image/gif',
];

/**
 * Compress image while maintaining original dimensions.
 * Converts HEIC/HEIF to JPEG for browser compatibility.
 */
async function compressImage(buffer: Buffer, mimeType: string): Promise<{ data: Buffer; mimeType: string }> {
  let pipeline = sharp(buffer);

  // Auto-rotate based on EXIF orientation
  pipeline = pipeline.rotate();

  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    // Convert HEIC to JPEG
    pipeline = pipeline.jpeg({ quality: 80 });
    return { data: await pipeline.toBuffer(), mimeType: 'image/jpeg' };
  }

  if (mimeType === 'image/png') {
    pipeline = pipeline.png({ quality: 80, compressionLevel: 8 });
    return { data: await pipeline.toBuffer(), mimeType };
  }

  if (mimeType === 'image/webp') {
    pipeline = pipeline.webp({ quality: 80 });
    return { data: await pipeline.toBuffer(), mimeType };
  }

  if (mimeType === 'image/gif') {
    // GIFs are tricky with sharp; return as-is to preserve animation
    return { data: buffer, mimeType };
  }

  // Default: JPEG compression
  pipeline = pipeline.jpeg({ quality: 80 });
  return { data: await pipeline.toBuffer(), mimeType: 'image/jpeg' };
}

/**
 * POST /api/feedback/upload
 * Upload an image attachment to a feedback message
 */
async function handlePost(req: NextRequest, authContext: AuthResult) {
  try {
    const formData = await req.formData();
    const feedbackId = formData.get('feedbackId') as string;
    const file = formData.get('file') as File;

    if (!feedbackId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Feedback ID is required' },
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

    const fileMimeType = file.type.toLowerCase();
    if (!ALLOWED_MIME_TYPES.includes(fileMimeType)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Only image files are allowed (JPEG, PNG, HEIC, WebP, GIF)' },
        { status: 400 }
      );
    }

    const isAdmin = authContext.isSysAdmin || authContext.caretakerRole === 'ADMIN';

    // Verify feedback exists and user has access
    const feedback = await prisma.feedback.findUnique({
      where: { id: feedbackId },
      select: { id: true, familyId: true, accountId: true, caretakerId: true, parentId: true, parent: { select: { accountId: true, caretakerId: true } } },
    });

    if (!feedback) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Feedback not found' },
        { status: 404 }
      );
    }

    // Non-admins can only attach to their own feedback
    if (!isAdmin) {
      let hasAccess = false;
      if (authContext.isAccountAuth && authContext.accountId) {
        hasAccess = feedback.accountId === authContext.accountId ||
          (!!feedback.parent && feedback.parent.accountId === authContext.accountId);
      } else if (authContext.caretakerId) {
        hasAccess = feedback.caretakerId === authContext.caretakerId ||
          (!!feedback.parent && feedback.parent.caretakerId === authContext.caretakerId);
      }
      if (!hasAccess) {
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    // Read and compress the image
    const rawBuffer = Buffer.from(await file.arrayBuffer());
    const compressed = await compressImage(rawBuffer, fileMimeType);

    // Encrypt and store
    const storedName = generateStoredName();
    encryptAndStore(compressed.data, storedName, 'feedback');

    // Create attachment record
    const attachment = await prisma.feedbackAttachment.create({
      data: {
        originalName: file.name,
        storedName,
        mimeType: compressed.mimeType,
        fileSize: compressed.data.length,
        feedbackId,
      },
    });

    const response: FeedbackAttachmentResponse = {
      id: attachment.id,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      createdAt: formatForResponse(attachment.createdAt) || '',
    };

    return NextResponse.json<ApiResponse<FeedbackAttachmentResponse>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error uploading feedback attachment:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to upload attachment' },
      { status: 500 }
    );
  }
}

export const POST = withAuthContext(handlePost as any);

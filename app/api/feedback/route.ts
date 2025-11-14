import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { withAuthContext, ApiResponse } from '../utils/auth';
import { FeedbackCreate, FeedbackResponse } from '../types';
import { sendFeedbackConfirmationEmail } from '../utils/account-emails';

/**
 * POST /api/feedback
 * Create a new feedback entry
 */
async function handlePost(req: NextRequest, authContext: any): Promise<NextResponse<ApiResponse<FeedbackResponse>>> {
  try {
    const body: FeedbackCreate = await req.json();
    const { subject, message, familyId, parentId, submitterName, submitterEmail } = body;

    // Validate required fields
    if (!subject || !message) {
      return NextResponse.json<ApiResponse<FeedbackResponse>>(
        {
          success: false,
          error: 'Subject and message are required',
        },
        { status: 400 }
      );
    }

    // Trim and validate subject and message
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();

    if (!trimmedSubject || !trimmedMessage) {
      return NextResponse.json<ApiResponse<FeedbackResponse>>(
        {
          success: false,
          error: 'Subject and message cannot be empty',
        },
        { status: 400 }
      );
    }

    // If this is a reply, get the parent feedback to inherit familyId and subject
    let parentFeedback = null;
    if (parentId) {
      parentFeedback = await prisma.feedback.findUnique({
        where: { id: parentId },
        select: { familyId: true, subject: true },
      });
      
      if (!parentFeedback) {
        return NextResponse.json<ApiResponse<FeedbackResponse>>(
          {
            success: false,
            error: 'Parent feedback not found',
          },
          { status: 404 }
        );
      }
    }

    // Determine the family ID to use (inherit from parent if replying)
    let finalFamilyId = familyId || parentFeedback?.familyId || authContext.familyId || null;

    // Determine account and caretaker IDs based on auth context
    let accountId: string | null = null;
    let caretakerId: string | null = null;
    let finalSubmitterName = submitterName || 'Anonymous User';
    let finalSubmitterEmail = submitterEmail || null;

    // If this is a reply from admin, use admin email from AppConfig
    if (parentId && (authContext.isSysAdmin || authContext.caretakerRole === 'ADMIN')) {
      const appConfig = await prisma.appConfig.findFirst();
      if (appConfig?.adminEmail) {
        finalSubmitterEmail = appConfig.adminEmail;
        finalSubmitterName = 'Admin';
      }
    } else if (authContext.isAccountAuth && authContext.accountId) {
      accountId = authContext.accountId;
      finalSubmitterEmail = authContext.accountEmail || finalSubmitterEmail;
      
      // If no submitter name provided, try to derive from email
      if (!submitterName && authContext.accountEmail) {
        finalSubmitterName = authContext.accountEmail.split('@')[0];
      }
    } else if (authContext.caretakerId) {
      caretakerId = authContext.caretakerId;
      
      // For caretakers, try to get name from the database if not provided
      if (!submitterName) {
        try {
          const caretaker = await prisma.caretaker.findUnique({
            where: { id: authContext.caretakerId },
            select: { name: true }
          });
          if (caretaker) {
            finalSubmitterName = caretaker.name;
          }
        } catch (error) {
          console.error('Error fetching caretaker name:', error);
        }
      }
    }

    // For replies, inherit subject from parent with "Re: " prefix
    // Remove existing "Re: " prefix if present to avoid double prefixing
    const finalSubject = parentId && parentFeedback 
      ? `Re: ${parentFeedback.subject.replace(/^Re:\s*/i, '')}` 
      : trimmedSubject;

    // Create the feedback entry
    const feedback = await prisma.feedback.create({
      data: {
        subject: finalSubject,
        message: trimmedMessage,
        familyId: finalFamilyId,
        parentId: parentId || null,
        accountId: accountId,
        caretakerId: caretakerId,
        submitterName: finalSubmitterName,
        submitterEmail: finalSubmitterEmail,
        viewed: false,
      },
    });

    // Send confirmation email if user has an email address
    if (finalSubmitterEmail && accountId) {
      try {
        await sendFeedbackConfirmationEmail(
          finalSubmitterEmail,
          finalSubmitterName,
          trimmedSubject
        );
        console.log('Feedback confirmation email sent to:', finalSubmitterEmail);
      } catch (emailError) {
        console.error('Error sending feedback confirmation email:', emailError);
        // Don't fail the feedback submission if email fails
      }
    }

    const response: FeedbackResponse = {
      id: feedback.id,
      subject: feedback.subject,
      message: feedback.message,
      submittedAt: feedback.submittedAt.toISOString(),
      viewed: feedback.viewed,
      submitterName: feedback.submitterName,
      submitterEmail: feedback.submitterEmail,
      familyId: feedback.familyId,
      parentId: feedback.parentId,
      createdAt: feedback.createdAt.toISOString(),
      updatedAt: feedback.updatedAt.toISOString(),
      deletedAt: feedback.deletedAt ? feedback.deletedAt.toISOString() : null,
    };

    return NextResponse.json<ApiResponse<FeedbackResponse>>(
      {
        success: true,
        data: response,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating feedback:', error);
    return NextResponse.json<ApiResponse<FeedbackResponse>>(
      {
        success: false,
        error: 'Failed to submit feedback',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/feedback
 * Get feedback entries (admin only)
 */
async function handleGet(req: NextRequest, authContext: any): Promise<NextResponse<ApiResponse<FeedbackResponse[]>>> {
  try {
    // Check if user has admin privileges
    if (!authContext.isSysAdmin && authContext.caretakerRole !== 'ADMIN') {
      return NextResponse.json<ApiResponse<FeedbackResponse[]>>(
        {
          success: false,
          error: 'Admin access required',
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const viewed = searchParams.get('viewed');
    const familyId = searchParams.get('familyId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause - only show top-level feedback (no replies)
    const where: any = {
      parentId: null, // Only top-level feedback, not replies
    };
    
    if (viewed !== null) {
      where.viewed = viewed === 'true';
    }
    
    if (familyId) {
      where.familyId = familyId;
    }

    // For non-system admins, only show feedback from their family
    if (!authContext.isSysAdmin && authContext.familyId) {
      where.familyId = authContext.familyId;
    }

    const feedback = await prisma.feedback.findMany({
      where,
      include: {
        replies: {
          orderBy: {
            submittedAt: 'asc', // Order replies chronologically
          },
        },
      },
      orderBy: {
        submittedAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    const response: FeedbackResponse[] = feedback.map((item: any) => ({
      id: item.id,
      subject: item.subject,
      message: item.message,
      submittedAt: item.submittedAt.toISOString(),
      viewed: item.viewed,
      submitterName: item.submitterName,
      submitterEmail: item.submitterEmail,
      familyId: item.familyId,
      parentId: item.parentId,
      replies: item.replies?.map((reply: any) => ({
        id: reply.id,
        subject: reply.subject,
        message: reply.message,
        submittedAt: reply.submittedAt.toISOString(),
        viewed: reply.viewed,
        submitterName: reply.submitterName,
        submitterEmail: reply.submitterEmail,
        familyId: reply.familyId,
        parentId: reply.parentId,
        createdAt: reply.createdAt.toISOString(),
        updatedAt: reply.updatedAt.toISOString(),
        deletedAt: reply.deletedAt ? reply.deletedAt.toISOString() : null,
      })) || [],
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      deletedAt: item.deletedAt ? item.deletedAt.toISOString() : null,
    }));

    return NextResponse.json<ApiResponse<FeedbackResponse[]>>(
      {
        success: true,
        data: response,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json<ApiResponse<FeedbackResponse[]>>(
      {
        success: false,
        error: 'Failed to fetch feedback',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/feedback
 * Update feedback (mark as viewed, etc.) - admin only
 */
async function handlePut(req: NextRequest, authContext: any): Promise<NextResponse<ApiResponse<FeedbackResponse>>> {
  try {
    // Check if user has admin privileges
    if (!authContext.isSysAdmin && authContext.caretakerRole !== 'ADMIN') {
      return NextResponse.json<ApiResponse<FeedbackResponse>>(
        {
          success: false,
          error: 'Admin access required',
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json<ApiResponse<FeedbackResponse>>(
        {
          success: false,
          error: 'Feedback ID is required',
        },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { viewed } = body;

    // Update the feedback
    const feedback = await prisma.feedback.update({
      where: { id },
      data: {
        viewed: viewed !== undefined ? viewed : undefined,
        updatedAt: new Date(),
      },
    });

    const response: FeedbackResponse = {
      id: feedback.id,
      subject: feedback.subject,
      message: feedback.message,
      submittedAt: feedback.submittedAt.toISOString(),
      viewed: feedback.viewed,
      submitterName: feedback.submitterName,
      submitterEmail: feedback.submitterEmail,
      familyId: feedback.familyId,
      parentId: feedback.parentId,
      createdAt: feedback.createdAt.toISOString(),
      updatedAt: feedback.updatedAt.toISOString(),
      deletedAt: feedback.deletedAt ? feedback.deletedAt.toISOString() : null,
    };

    return NextResponse.json<ApiResponse<FeedbackResponse>>(
      {
        success: true,
        data: response,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating feedback:', error);
    return NextResponse.json<ApiResponse<FeedbackResponse>>(
      {
        success: false,
        error: 'Failed to update feedback',
      },
      { status: 500 }
    );
  }
}

// Export the handlers
export const POST = withAuthContext(handlePost);
export const GET = withAuthContext(handleGet);
export const PUT = withAuthContext(handlePut);

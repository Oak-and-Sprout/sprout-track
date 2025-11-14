import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { withAuthContext, ApiResponse } from '../utils/auth';
import { FeedbackCreate, FeedbackResponse } from '../types';
import {
  sendFeedbackSubmissionConfirmationEmail,
  sendFeedbackAdminNotificationEmail,
  sendFeedbackReplyAdminNotificationEmail,
  sendFeedbackReplyUserNotificationEmail,
} from '../utils/feedback-emails';

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

    // Send emails based on whether this is a new feedback or a reply
    if (parentId) {
      // This is a reply - determine if it's from admin or user
      const isAdminReply = authContext.isSysAdmin || authContext.caretakerRole === 'ADMIN';
      
      if (isAdminReply) {
        // Admin replied - notify the original user
        // Get the original feedback to find the user's email, subject, and familyId
        const originalFeedback = await prisma.feedback.findUnique({
          where: { id: parentId },
          select: { submitterEmail: true, submitterName: true, subject: true, familyId: true },
        });
        
        if (originalFeedback?.submitterEmail && originalFeedback.submitterEmail !== finalSubmitterEmail) {
          try {
            // Use original subject (without "Re: " prefix) for the email
            const originalSubject = originalFeedback.subject.replace(/^Re:\s*/i, '');
            await sendFeedbackReplyUserNotificationEmail(
              originalFeedback.submitterEmail,
              originalFeedback.submitterName || 'User',
              originalSubject,
              trimmedMessage,
              feedback.id,
              originalFeedback.familyId || finalFamilyId
            );
            console.log('Feedback reply notification email sent to user:', originalFeedback.submitterEmail);
          } catch (emailError) {
            console.error('Error sending feedback reply notification email to user:', emailError);
            // Don't fail the feedback submission if email fails
          }
        }
      } else {
        // User replied - notify admin
        // Use the original subject from parentFeedback (already fetched earlier)
        const originalSubject = parentFeedback?.subject.replace(/^Re:\s*/i, '') || trimmedSubject;
        
        try {
          await sendFeedbackReplyAdminNotificationEmail(
            originalSubject,
            trimmedMessage,
            finalSubmitterName,
            finalSubmitterEmail,
            feedback.id,
            finalFamilyId
          );
          console.log('Feedback reply notification email sent to admin');
        } catch (emailError) {
          console.error('Error sending feedback reply notification email to admin:', emailError);
          // Don't fail the feedback submission if email fails
        }
      }
    } else {
      // This is a new feedback submission
      // Send confirmation email to user if they have an email address
      if (finalSubmitterEmail && accountId) {
        try {
          await sendFeedbackSubmissionConfirmationEmail(
            finalSubmitterEmail,
            finalSubmitterName,
            trimmedSubject,
            finalFamilyId
          );
          console.log('Feedback submission confirmation email sent to:', finalSubmitterEmail);
        } catch (emailError) {
          console.error('Error sending feedback submission confirmation email:', emailError);
          // Don't fail the feedback submission if email fails
        }
      }
      
      // Send notification email to admin
      try {
        await sendFeedbackAdminNotificationEmail(
          trimmedSubject,
          trimmedMessage,
          finalSubmitterName,
          finalSubmitterEmail,
          feedback.id,
          finalFamilyId
        );
        console.log('Feedback admin notification email sent');
      } catch (emailError) {
        console.error('Error sending feedback admin notification email:', emailError);
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
 * Get feedback entries
 * - Admins: Get all feedback (with optional filters)
 * - Users: Get only their own feedback threads
 */
async function handleGet(req: NextRequest, authContext: any): Promise<NextResponse<ApiResponse<FeedbackResponse[]>>> {
  try {
    const { searchParams } = new URL(req.url);
    const viewed = searchParams.get('viewed');
    const familyId = searchParams.get('familyId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const isAdmin = authContext.isSysAdmin || authContext.caretakerRole === 'ADMIN';

    // Build where clause - only show top-level feedback (no replies)
    const where: any = {
      parentId: null, // Only top-level feedback, not replies
    };
    
    if (isAdmin) {
      // Admin can filter by viewed status
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
    } else {
      // For regular users, only show their own feedback
      // Match by accountId or caretakerId
      if (authContext.isAccountAuth && authContext.accountId) {
        where.accountId = authContext.accountId;
      } else if (authContext.caretakerId) {
        where.caretakerId = authContext.caretakerId;
      } else {
        // No way to identify user, return empty
        return NextResponse.json<ApiResponse<FeedbackResponse[]>>(
          {
            success: true,
            data: [],
          },
          { status: 200 }
        );
      }
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
 * Update feedback (mark as viewed, etc.)
 * - Admins: Can update any feedback
 * - Users: Can only update replies to their own feedback threads
 */
async function handlePut(req: NextRequest, authContext: any): Promise<NextResponse<ApiResponse<FeedbackResponse>>> {
  try {
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

    const isAdmin = authContext.isSysAdmin || authContext.caretakerRole === 'ADMIN';

    // For non-admins, verify they own the feedback or it's a reply to their feedback
    if (!isAdmin) {
      const existingFeedback = await prisma.feedback.findUnique({
        where: { id },
        include: {
          parent: true, // Include parent to check if this is a reply to user's feedback
        },
      });

      if (!existingFeedback) {
        return NextResponse.json<ApiResponse<FeedbackResponse>>(
          {
            success: false,
            error: 'Feedback not found',
          },
          { status: 404 }
        );
      }

      // Check if user owns the feedback or if it's a reply to their feedback
      let userOwnsFeedback = false;
      
      if (authContext.isAccountAuth && authContext.accountId) {
        // Check if this feedback belongs to the user's account
        if (existingFeedback.accountId === authContext.accountId) {
          userOwnsFeedback = true;
        }
        // Check if this is a reply to feedback owned by the user
        if (existingFeedback.parent && existingFeedback.parent.accountId === authContext.accountId) {
          userOwnsFeedback = true;
        }
      } else if (authContext.caretakerId) {
        // Check if this feedback belongs to the user's caretaker
        if (existingFeedback.caretakerId === authContext.caretakerId) {
          userOwnsFeedback = true;
        }
        // Check if this is a reply to feedback owned by the user
        if (existingFeedback.parent && existingFeedback.parent.caretakerId === authContext.caretakerId) {
          userOwnsFeedback = true;
        }
      }

      if (!userOwnsFeedback) {
        return NextResponse.json<ApiResponse<FeedbackResponse>>(
          {
            success: false,
            error: 'You can only update your own feedback',
          },
          { status: 403 }
        );
      }
    }

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

import { sendEmail } from '@/src/lib/email';
import prisma from '../db';

async function getDomainUrl(): Promise<string> {
  try {
    let appConfig = await prisma.appConfig.findFirst();
    
    if (!appConfig) {
      // Create default app config if none exists
      appConfig = await prisma.appConfig.create({
        data: {
          adminPass: 'admin',
          rootDomain: 'localhost:3000',
          enableHttps: false,
        },
      });
    }

    const protocol = appConfig.enableHttps ? 'https' : 'http';
    return `${protocol}://${appConfig.rootDomain}`;
  } catch (error) {
    console.error('Error fetching app config for domain URL:', error);
    // Fallback to environment variable or default
    return process.env.ROOT_DOMAIN || 'http://localhost:3000';
  }
}

async function getAdminEmail(): Promise<string | null> {
  try {
    const appConfig = await prisma.appConfig.findFirst();
    return appConfig?.adminEmail || null;
  } catch (error) {
    console.error('Error fetching admin email:', error);
    return null;
  }
}

async function getFamilySlug(familyId: string | null): Promise<string | null> {
  if (!familyId) return null;
  
  try {
    const family = await prisma.family.findUnique({
      where: { id: familyId },
      select: { slug: true },
    });
    return family?.slug || null;
  } catch (error) {
    console.error('Error fetching family slug:', error);
    return null;
  }
}

function getLoginUrl(familySlug: string | null, domainUrl: string): string {
  if (familySlug) {
    return `${domainUrl}/${familySlug}/login`;
  }
  return `${domainUrl}/?login=true`;
}

/**
 * Send confirmation email to user when they submit feedback
 */
export async function sendFeedbackSubmissionConfirmationEmail(
  email: string,
  submitterName: string,
  subject: string,
  familyId?: string | null
) {
  try {
    const domainUrl = await getDomainUrl();
    const familySlug = await getFamilySlug(familyId || null);
    const loginUrl = getLoginUrl(familySlug, domainUrl);
    
    const result = await sendEmail({
      to: email,
      from: 'no-reply@sprout-track.com',
      subject: 'Sprout Track - Feedback Received',
      text: `Hi ${submitterName},

Thank you for your feedback! We've received your message about "${subject}".

We appreciate you taking the time to help us improve Sprout Track. Our team will review your feedback and we'll contact you soon if we need any additional information.

Your input helps us make Sprout Track better for all families.

IMPORTANT: This email address is not monitored. Please do not reply to this email. If you need to add more information or have questions, please log in to Sprout Track and reply from within the application.

Best regards,
The Sprout Track Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0d9488;">Thank You for Your Feedback!</h2>
        <p>Hi ${submitterName},</p>
        <p>Thank you for your feedback! We've received your message about <strong>"${subject}"</strong>.</p>
        
        <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0d9488;">
          <p style="margin: 0; color: #059669; font-weight: 600;">
            We appreciate you taking the time to help us improve Sprout Track. Our team will review your feedback and we'll contact you soon if we need any additional information.
          </p>
        </div>
        
        <p>Your input helps us make Sprout Track better for all families.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" 
             style="background-color: #0d9488; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 6px; display: inline-block;">
            Continue Using Sprout Track
          </a>
        </div>
        
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <p style="margin: 0; color: #92400e; font-size: 13px; font-weight: 600;">
            ⚠️ IMPORTANT: This email address is not monitored. Please do not reply to this email. If you need to add more information or have questions, please log in to Sprout Track and reply from within the application.
          </p>
        </div>
          
          <p>Best regards,<br>The Sprout Track Team</p>
        </div>
      `
    });

    if (!result.success) {
      console.warn('Failed to send feedback submission confirmation email:', result.error);
    }

    return result;
  } catch (error) {
    console.error('Error in sendFeedbackSubmissionConfirmationEmail:', error);
    return { success: false, error };
  }
}

/**
 * Send notification email to admin when new feedback is submitted
 */
export async function sendFeedbackAdminNotificationEmail(
  subject: string,
  message: string,
  submitterName: string,
  submitterEmail: string | null,
  feedbackId: string,
  familyId?: string | null
) {
  try {
    const adminEmail = await getAdminEmail();
    if (!adminEmail) {
      console.warn('Admin email not configured. Skipping admin notification email.');
      return { success: false, error: 'Admin email not configured' };
    }

    const domainUrl = await getDomainUrl();
    const feedbackUrl = `${domainUrl}/family-manager#feedback`;
    
    const result = await sendEmail({
      to: adminEmail,
      from: 'no-reply@sprout-track.com',
      subject: `New Feedback: ${subject}`,
      text: `New feedback has been submitted:

Subject: ${subject}
From: ${submitterName}${submitterEmail ? ` (${submitterEmail})` : ''}

Message:
${message}

View and respond to this feedback in the Family Manager:
${feedbackUrl}

Feedback ID: ${feedbackId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">New Feedback Received</h2>
          
          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
            <p style="margin: 0 0 10px 0;"><strong>Subject:</strong> ${subject}</p>
            <p style="margin: 0 0 10px 0;"><strong>From:</strong> ${submitterName}${submitterEmail ? ` (${submitterEmail})` : ''}</p>
            <p style="margin: 0;"><strong>Feedback ID:</strong> ${feedbackId}</p>
          </div>
          
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151;">Message:</h3>
            <p style="white-space: pre-wrap; color: #4b5563;">${message}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${feedbackUrl}" 
               style="background-color: #dc2626; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              View Feedback in Family Manager
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 12px;">
            You can reply to this feedback directly from the Family Manager.
          </p>
        </div>
      `
    });

    if (!result.success) {
      console.warn('Failed to send feedback admin notification email:', result.error);
    }

    return result;
  } catch (error) {
    console.error('Error in sendFeedbackAdminNotificationEmail:', error);
    return { success: false, error };
  }
}

/**
 * Send notification email to admin when user replies to feedback
 */
export async function sendFeedbackReplyAdminNotificationEmail(
  originalSubject: string,
  replyMessage: string,
  replyFromName: string,
  replyFromEmail: string | null,
  feedbackId: string,
  familyId?: string | null
) {
  try {
    const adminEmail = await getAdminEmail();
    if (!adminEmail) {
      console.warn('Admin email not configured. Skipping admin notification email.');
      return { success: false, error: 'Admin email not configured' };
    }

    const domainUrl = await getDomainUrl();
    const feedbackUrl = `${domainUrl}/family-manager#feedback`;
    
    const result = await sendEmail({
    to: adminEmail,
    from: 'no-reply@sprout-track.com',
    subject: `Re: ${originalSubject.replace(/^Re:\s*/i, '')}`,
    text: `A new reply has been added to feedback thread "${originalSubject}":

From: ${replyFromName}${replyFromEmail ? ` (${replyFromEmail})` : ''}

Reply:
${replyMessage}

View and respond to this feedback in the Family Manager:
${feedbackUrl}

Feedback ID: ${feedbackId}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">New Reply to Feedback</h2>
        
        <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
          <p style="margin: 0 0 10px 0;"><strong>Thread:</strong> ${originalSubject}</p>
          <p style="margin: 0 0 10px 0;"><strong>From:</strong> ${replyFromName}${replyFromEmail ? ` (${replyFromEmail})` : ''}</p>
          <p style="margin: 0;"><strong>Feedback ID:</strong> ${feedbackId}</p>
        </div>
        
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151;">Reply:</h3>
          <p style="white-space: pre-wrap; color: #4b5563;">${replyMessage}</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${feedbackUrl}" 
             style="background-color: #dc2626; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 6px; display: inline-block;">
            View Feedback Thread
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 12px;">
          You can reply to this feedback directly from the Family Manager.
        </p>
      </div>
    `
    });

    if (!result.success) {
      console.warn('Failed to send feedback reply admin notification email:', result.error);
    }

    return result;
  } catch (error) {
    console.error('Error in sendFeedbackReplyAdminNotificationEmail:', error);
    return { success: false, error };
  }
}

/**
 * Send notification email to user when admin replies to their feedback
 */
export async function sendFeedbackReplyUserNotificationEmail(
  userEmail: string,
  userName: string,
  originalSubject: string,
  adminReplyMessage: string,
  feedbackId: string,
  familyId?: string | null
) {
  try {
    const domainUrl = await getDomainUrl();
    const familySlug = await getFamilySlug(familyId || null);
    const loginUrl = getLoginUrl(familySlug, domainUrl);
    
    const result = await sendEmail({
    to: userEmail,
    from: 'no-reply@sprout-track.com',
    subject: `Re: ${originalSubject.replace(/^Re:\s*/i, '')}`,
    text: `Hi ${userName},

We've replied to your feedback about "${originalSubject}".

Our Reply:
${adminReplyMessage}

You can view the full conversation and reply back by logging in:
${loginUrl}

IMPORTANT: This email address is not monitored. Please do not reply to this email. To continue the conversation, please log in to Sprout Track and reply from within the application.

Thank you for your continued feedback!

Best regards,
The Sprout Track Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0d9488;">We've Replied to Your Feedback</h2>
        <p>Hi ${userName},</p>
        <p>We've replied to your feedback about <strong>"${originalSubject}"</strong>.</p>
        
        <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0d9488;">
          <h3 style="margin-top: 0; color: #059669;">Our Reply:</h3>
          <p style="white-space: pre-wrap; color: #047857; margin: 0;">${adminReplyMessage}</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" 
             style="background-color: #0d9488; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 6px; display: inline-block;">
            View Full Conversation
          </a>
        </div>
        
        <p>You can reply back to continue the conversation. Thank you for your continued feedback!</p>
        
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <p style="margin: 0; color: #92400e; font-size: 13px; font-weight: 600;">
            ⚠️ IMPORTANT: This email address is not monitored. Please do not reply to this email. To continue the conversation, please log in to Sprout Track and reply from within the application.
          </p>
        </div>
        
        <p>Best regards,<br>The Sprout Track Team</p>
      </div>
    `
    });

    if (!result.success) {
      console.warn('Failed to send feedback reply user notification email:', result.error);
    }

    return result;
  } catch (error) {
    console.error('Error in sendFeedbackReplyUserNotificationEmail:', error);
    return { success: false, error };
  }
}


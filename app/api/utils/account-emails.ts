import { sendEmail } from '@/src/lib/email';
import prisma from '../db';

/**
 * Path-based, not fragment-based: Universal and App Links match on path, and a
 * URL fragment is not part of that match. The legacy /#verify and /#passwordreset
 * handlers stay in place indefinitely for links already sitting in inboxes.
 */
export function verificationLink(domainUrl: string, token: string): string {
  return `${domainUrl}/verify?token=${token}`;
}

export function passwordResetLink(domainUrl: string, token: string): string {
  return `${domainUrl}/passwordreset?token=${token}`;
}

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

export async function sendVerificationEmail(email: string, token: string, firstName: string) {
  const domainUrl = await getDomainUrl();
  const verificationUrl = verificationLink(domainUrl, token);
  
  const result = await sendEmail({
    to: email,
    from: accountsFrom(),
    subject: 'Welcome to Sprout Track - Verify Your Account',
    text: `Hi ${firstName},

Welcome to Sprout Track! Please verify your email address by visiting this link:

${verificationUrl}

This link will expire in 24 hours.

Best regards,
The Sprout Track Team

${UNMONITORED_NOTICE_TEXT}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0d9488;">Welcome to Sprout Track!</h2>
        <p>Hi ${firstName},</p>
        <p>Welcome to Sprout Track! Please verify your email address by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #0d9488; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 6px; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">
          This link will expire in 24 hours. If you didn't create an account with Sprout Track, 
          please ignore this email.
        </p>
        <p>Best regards,<br>The Sprout Track Team</p>${unmonitoredNoticeHtml()}
      </div>
    `
  });

  return result;
}

export async function sendPasswordResetEmail(email: string, token: string, firstName: string) {
  const domainUrl = await getDomainUrl();
  const resetUrl = passwordResetLink(domainUrl, token);
  
  const result = await sendEmail({
    to: email,
    from: accountsFrom(),
    subject: 'Sprout Track - Password Reset Request',
    text: `Hi ${firstName},

You requested a password reset for your Sprout Track account. Please visit this link to reset your password:

${resetUrl}

This link will expire in 15 minutes.

If you didn't request a password reset, please ignore this email.

Best regards,
The Sprout Track Team

${UNMONITORED_NOTICE_TEXT}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0d9488;">Password Reset Request</h2>
        <p>Hi ${firstName},</p>
        <p>You requested a password reset for your Sprout Track account. Click the button below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background-color: #0d9488; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 6px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">
          This link will expire in 15 minutes. If you didn't request a password reset, 
          please ignore this email.
        </p>
        <p>Best regards,<br>The Sprout Track Team</p>${unmonitoredNoticeHtml()}
      </div>
    `
  });

  return result;
}

export async function sendWelcomeEmail(email: string, firstName: string, familySlug: string, familyPin: string, caretakerLoginId: string) {
  const domainUrl = await getDomainUrl();
  const familyUrl = `${domainUrl}/${familySlug}`;
  
  const result = await sendEmail({
    to: email,
    from: accountsFrom(),
    subject: 'Welcome to Sprout Track - Your Family is Ready!',
    text: `Hi ${firstName},

Welcome to Sprout Track! Your account has been verified and your family is ready to use.

Your Family Details:
- Family URL: ${familyUrl}
- Your Caretaker Login ID: ${caretakerLoginId}
- Family PIN: ${familyPin}

Use your Caretaker Login ID (${caretakerLoginId}) and PIN (${familyPin}) to access your family's dashboard directly.

You can share the family URL, your login ID, and PIN with other caretakers so they can access your family's data.

As the account owner, you can also log in directly using your email and password without needing the PIN.

Get started by adding your first baby and logging your first activities!

Best regards,
The Sprout Track Team

${UNMONITORED_NOTICE_TEXT}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0d9488;">Welcome to Sprout Track!</h2>
        <p>Hi ${firstName},</p>
        <p>Welcome to Sprout Track! Your account has been verified and your family is ready to use.</p>
        
        <div style="background-color: #f0fdfa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #0d9488; margin-top: 0;">Your Family Details:</h3>
          <p><strong>Family URL:</strong> <a href="${familyUrl}">${familyUrl}</a></p>
          <p><strong>Your Caretaker Login ID:</strong> <code style="background-color: #fff; padding: 4px 8px; border-radius: 4px; font-weight: bold;">${caretakerLoginId}</code></p>
          <p><strong>Family PIN:</strong> <code style="background-color: #fff; padding: 4px 8px; border-radius: 4px;">${familyPin}</code></p>
        </div>
        
        <p>Use your Caretaker Login ID (<strong>${caretakerLoginId}</strong>) and PIN (<strong>${familyPin}</strong>) to access your family's dashboard directly.</p>
        <p>You can share the family URL, your login ID, and PIN with other caretakers so they can access your family's data.</p>
        <p>As the account owner, you can also log in directly using your email and password without needing the PIN.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${familyUrl}" 
             style="background-color: #0d9488; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 6px; display: inline-block;">
            Access Your Family Dashboard
          </a>
        </div>
        
        <p>Get started by adding your first baby and logging your first activities!</p>
        <p>Best regards,<br>The Sprout Track Team</p>${unmonitoredNoticeHtml()}
      </div>
    `
  });

  return result;
}

export async function sendFeedbackConfirmationEmail(email: string, firstName: string, subject: string) {
  const domainUrl = await getDomainUrl();
  
  const result = await sendEmail({
    to: email,
    from: adminFrom(),
    subject: 'Sprout Track - Feedback Received',
    text: `Hi ${firstName},

Thank you for your feedback! We've received your message about "${subject}" and appreciate you taking the time to help us improve Sprout Track.

Our team will review your feedback and may reach out if we need any additional information.

Your input helps us make Sprout Track better for all families.

Best regards,
The Sprout Track Team

${UNMONITORED_NOTICE_TEXT}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Thank You for Your Feedback!</h2>
        <p>Hi ${firstName},</p>
        <p>Thank you for your feedback! We've received your message about <strong>"${subject}"</strong> and appreciate you taking the time to help us improve Sprout Track.</p>
        
        <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
          <p style="margin: 0; color: #059669; font-weight: 600;">
            Your feedback is important to us and helps make Sprout Track better for all families.
          </p>
        </div>
        
        <p>Our team will review your feedback and may reach out if we need any additional information.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${domainUrl}" 
             style="background-color: #059669; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 6px; display: inline-block;">
            Continue Using Sprout Track
          </a>
        </div>
        
        <p>Best regards,<br>The Sprout Track Team</p>${unmonitoredNoticeHtml()}
      </div>
    `
  });

  return result;
}

export async function sendAccountClosureEmail(email: string, firstName: string) {
  const domainUrl = await getDomainUrl();

  const result = await sendEmail({
    to: email,
    from: accountsFrom(),
    subject: 'Sprout Track - Account Closed',
    text: `Hi ${firstName},

Your Sprout Track account has been successfully closed as requested.

Your account and associated family data have been deactivated and are no longer accessible. This action cannot be undone.

If you closed your account by mistake or would like to reactivate it, please contact our support team as soon as possible.

Thank you for using Sprout Track. We're sorry to see you go!

Best regards,
The Sprout Track Team

${UNMONITORED_NOTICE_TEXT}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Account Closed</h2>
        <p>Hi ${firstName},</p>
        <p>Your Sprout Track account has been successfully closed as requested.</p>

        <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
          <p style="margin: 0; color: #dc2626; font-weight: 600;">
            Your account and associated family data have been deactivated and are no longer accessible. This action cannot be undone.
          </p>
        </div>

        <p>If you closed your account by mistake or would like to reactivate it, please contact our support team as soon as possible.</p>

        <p>Thank you for using Sprout Track. We're sorry to see you go!</p>

        <p>Best regards,<br>The Sprout Track Team</p>${unmonitoredNoticeHtml()}
      </div>
    `
  });

  return result;
}

// The account manager is a modal on the landing page, not a dedicated route,
// so the gift email links to the site root.
export function giftRedemptionUrl(domainUrl: string): string {
  return domainUrl;
}

/**
 * Outgoing senders.
 *
 * The provider verifies senders per-address and rejects anything else outright,
 * so these must stay in lockstep with the verified Sender Identities. There are
 * exactly four, all with From Name "Sprout Track":
 *
 *   accounts@sprout-track.com   account lifecycle (verify, reset, welcome, closure)
 *   payments@sprout-track.com   payment mail (gift codes, receipts)
 *   admin@sprout-track.com      feedback correspondence, both directions
 *   no-reply@sprout-track.com   notifications nobody should reply to
 *
 * A rejected send is easy to mistake for a delivered one — it only surfaces in a
 * server log — so any override must also be a verified sender.
 */
const FROM_NAME = 'Sprout Track';

function mailbox(address: string): string {
  // Already a full "Name <addr>" mailbox — respect it verbatim.
  if (address.includes('<')) return address;
  // Matching the verified sender's From Name means inboxes show "Sprout Track"
  // rather than the bare address. All three transports (SendGrid, SMTP2GO,
  // nodemailer) accept this form.
  return `${FROM_NAME} <${address}>`;
}

export function accountsFrom(): string {
  return mailbox(process.env.ACCOUNTS_EMAIL || 'accounts@sprout-track.com');
}

export function paymentsFrom(): string {
  return mailbox(process.env.PAYMENTS_EMAIL || 'payments@sprout-track.com');
}

export function noReplyFrom(): string {
  return mailbox(process.env.NO_REPLY_EMAIL || 'no-reply@sprout-track.com');
}

/** Feedback correspondence, in both directions. */
export function adminFrom(): string {
  return mailbox(process.env.ADMIN_EMAIL || 'admin@sprout-track.com');
}

/**
 * None of the three mailboxes are monitored, and Reply-To points back at the
 * sending address, so a reply looks like it will reach someone. Say plainly
 * that it will not, and point at the channel that does work.
 */
export const UNMONITORED_NOTICE_TEXT =
  'This mailbox is not monitored — replies to this message will not reach us. ' +
  'To get in touch, use the Feedback option inside Sprout Track.';

export function unmonitoredNoticeHtml(): string {
  return `
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
        <p style="color: #6b7280; font-size: 12px; margin: 0;">
          This mailbox is not monitored &mdash; replies to this message will not reach us.
          To get in touch, use the Feedback option inside Sprout Track.
        </p>`;
}

export async function sendGiftCodeEmail(email: string, code: string) {
  const domainUrl = await getDomainUrl();
  const redeemUrl = giftRedemptionUrl(domainUrl);

  const result = await sendEmail({
    to: email,
    from: paymentsFrom(),
    subject: 'Your Sprout Track gift code',
    text: `Thank you for giving Sprout Track!

Here is your lifetime access gift code:

${code}

To redeem it:
1. Go to ${redeemUrl} and sign in — or create a free account.
2. Open Account Settings and find the Subscription section.
3. Choose "Redeem a gift code" and enter the code above.

The code grants lifetime access to Sprout Track and can be used once.

Best regards,
The Sprout Track Team

${UNMONITORED_NOTICE_TEXT}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0d9488;">Thank you for giving Sprout Track!</h2>
        <p>Here is your lifetime access gift code:</p>

        <div style="background-color: #f0fdfa; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <code style="background-color: #fff; padding: 8px 16px; border-radius: 4px; font-size: 20px; font-weight: bold; letter-spacing: 2px;">${code}</code>
        </div>

        <p>To redeem it:</p>
        <ol>
          <li>Go to <a href="${redeemUrl}">${redeemUrl}</a> and sign in — or create a free account.</li>
          <li>Open Account Settings and find the Subscription section.</li>
          <li>Choose "Redeem a gift code" and enter the code above.</li>
        </ol>

        <p>The code grants lifetime access to Sprout Track and can be used once.</p>
        <p>Best regards,<br>The Sprout Track Team</p>${unmonitoredNoticeHtml()}
      </div>
    `,
  });

  return result;
}

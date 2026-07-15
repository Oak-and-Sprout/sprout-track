import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse } from '../types';
import { AppConfig, EmailConfig, NotificationConfig } from '@prisma/client';
import { encrypt } from '../utils/encryption';
import { withSysAdminAuth } from '../utils/auth';
import { clearNotificationConfigCache, resetWebPushState } from '../../../src/lib/notifications/config';
import * as crypto from 'crypto';

/**
 * Builds the client-safe config response. Secret fields (adminPass, email API keys,
 * SMTP password, VAPID private key) are NEVER returned — they are blanked and paired
 * with has* booleans so the editor can show a "configured" state and a
 * "leave blank to keep current" input. The client never receives these secrets.
 */
function toSafeConfigResponse(
  appConfig: AppConfig,
  emailConfig: EmailConfig,
  notificationConfig: NotificationConfig
) {
  return {
    appConfig: {
      ...appConfig,
      adminPass: '',
    },
    emailConfig: {
      ...emailConfig,
      sendGridApiKey: '',
      smtp2goApiKey: '',
      password: '',
      hasSendGridApiKey: !!emailConfig.sendGridApiKey,
      hasSmtp2goApiKey: !!emailConfig.smtp2goApiKey,
      hasPassword: !!emailConfig.password,
    },
    notificationConfig: {
      ...notificationConfig,
      // vapidPublicKey is public and returned as-is; the private key is never returned.
      vapidPrivateKey: '',
      hasVapidPrivateKey: !!notificationConfig.vapidPrivateKey,
    },
  };
}

/**
 * GET handler for AppConfig
 * Returns the current app configuration with all secrets stripped (see toSafeConfigResponse).
 * Requires system administrator authentication.
 */
async function getHandler(req: NextRequest): Promise<NextResponse<ApiResponse<any>>> {
  try {
    let appConfig = await prisma.appConfig.findFirst();
    let emailConfig = await prisma.emailConfig.findFirst();
    let notificationConfig = await prisma.notificationConfig.findFirst();

    if (!appConfig) {
      // Create default app config if none exists
      appConfig = await prisma.appConfig.create({
        data: {
          adminPass: encrypt('admin'), // Default encrypted password
          rootDomain: 'localhost:3000',
          enableHttps: false,
        },
      });
    }

    if (!emailConfig) {
      // Create default email config if none exists
      emailConfig = await prisma.emailConfig.create({
        data: {
          providerType: 'SENDGRID',
        },
      });
    }

    if (!notificationConfig) {
      // Create default notification config if none exists
      const randomHex = crypto.randomBytes(4).toString('hex');
      notificationConfig = await prisma.notificationConfig.create({
        data: {
          enabled: false,
          vapidSubject: `mailto:notify_${randomHex}@sprout-track.com`,
        },
      });
    }

    return NextResponse.json<ApiResponse<any>>({
      success: true,
      data: toSafeConfigResponse(appConfig, emailConfig, notificationConfig),
    });
  } catch (error) {
    console.error('Error fetching app config:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to fetch app configuration',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT handler for AppConfig
 * Updates the app configuration with encrypted adminPass
 * Requires system administrator authentication
 */
async function putHandler(req: NextRequest): Promise<NextResponse<ApiResponse<any>>> {
  try {
    const body = await req.json();
    const { appConfigData, emailConfigData, notificationConfigData } = body;

    let updatedAppConfig;
    let updatedEmailConfig;
    let updatedNotificationConfig;

    // Update AppConfig
    if (appConfigData) {
      const existingAppConfig = await prisma.appConfig.findFirst();
      if (!existingAppConfig) {
        return NextResponse.json<ApiResponse<null>>({ success: false, error: 'App configuration not found.' }, { status: 404 });
      }

      const data: Partial<AppConfig> = {};
      const allowedAppFields: (keyof AppConfig)[] = ['adminPass', 'rootDomain', 'enableHttps', 'adminEmail', 'enablePhotos', 'defaultPhotoQuotaMB'];
      for (const field of allowedAppFields) {
        if (appConfigData[field] !== undefined) {
          if (field === 'adminPass') {
            // Blank means "keep the current password" — never overwrite with an empty value.
            if (!appConfigData[field]) continue;
            (data as any)[field] = encrypt(appConfigData[field]);
          } else if (field === 'defaultPhotoQuotaMB') {
            const quota = parseInt(appConfigData[field], 10);
            if (isNaN(quota) || quota < 1) {
              return NextResponse.json<ApiResponse<null>>(
                { success: false, error: 'Default photo quota must be a positive number of MB' },
                { status: 400 }
              );
            }
            (data as any)[field] = quota;
          } else {
            (data as any)[field] = appConfigData[field];
          }
        }
      }
      updatedAppConfig = await prisma.appConfig.update({ where: { id: existingAppConfig.id }, data });
    }

    // Update EmailConfig
    if (emailConfigData) {
      const existingEmailConfig = await prisma.emailConfig.findFirst();
      if (!existingEmailConfig) {
        return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Email configuration not found.' }, { status: 404 });
      }

      const data: Partial<EmailConfig> = {};
      const allowedEmailFields: (keyof EmailConfig)[] = [
        'providerType', 'sendGridApiKey', 'smtp2goApiKey', 'serverAddress', 'port', 'username', 'password', 'enableTls', 'allowSelfSignedCert'
      ];
      const encryptedFields = ['sendGridApiKey', 'smtp2goApiKey', 'password'];

      for (const field of allowedEmailFields) {
        if (emailConfigData[field] !== undefined) {
          if (encryptedFields.includes(field)) {
            // Blank means "keep the current secret" — never overwrite with an empty value.
            if (!emailConfigData[field]) continue;
            (data as any)[field] = encrypt(emailConfigData[field]);
          } else {
            (data as any)[field] = emailConfigData[field];
          }
        }
      }
      updatedEmailConfig = await prisma.emailConfig.update({ where: { id: existingEmailConfig.id }, data });
    }

    // Update NotificationConfig
    if (notificationConfigData) {
      const existingNotificationConfig = await prisma.notificationConfig.findFirst();
      if (!existingNotificationConfig) {
        return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Notification configuration not found.' }, { status: 404 });
      }

      const data: Partial<NotificationConfig> = {};
      const allowedNotificationFields: (keyof NotificationConfig)[] = [
        'enabled', 'vapidPublicKey', 'vapidPrivateKey', 'vapidSubject', 'logRetentionDays'
      ];
      const encryptedNotificationFields = ['vapidPrivateKey'];

      for (const field of allowedNotificationFields) {
        if (notificationConfigData[field] !== undefined) {
          if (field === 'logRetentionDays') {
            const days = parseInt(notificationConfigData[field], 10);
            (data as any)[field] = Math.max(1, Math.min(365, isNaN(days) ? 30 : days));
          } else if (encryptedNotificationFields.includes(field)) {
            // Blank means "keep the current private key" — never overwrite with an empty value.
            if (!notificationConfigData[field]) continue;
            (data as any)[field] = encrypt(notificationConfigData[field]);
          } else {
            (data as any)[field] = notificationConfigData[field];
          }
        }
      }
      updatedNotificationConfig = await prisma.notificationConfig.update({ where: { id: existingNotificationConfig.id }, data });

      // Clear cached config so notification system picks up changes
      clearNotificationConfigCache();
      resetWebPushState();
    }

    // Re-fetch and return the client-safe (secret-free) config
    const finalAppConfig = await prisma.appConfig.findFirst();
    const finalEmailConfig = await prisma.emailConfig.findFirst();
    const finalNotificationConfig = await prisma.notificationConfig.findFirst();

    return NextResponse.json<ApiResponse<any>>({
      success: true,
      data: finalAppConfig && finalEmailConfig && finalNotificationConfig
        ? toSafeConfigResponse(finalAppConfig, finalEmailConfig, finalNotificationConfig)
        : null,
    });
  } catch (error) {
    console.error('Error updating app config:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to update app configuration',
      },
      { status: 500 }
    );
  }
}

// Export handlers with system admin authentication
export const GET = withSysAdminAuth(getHandler);
export const PUT = withSysAdminAuth(putHandler); 
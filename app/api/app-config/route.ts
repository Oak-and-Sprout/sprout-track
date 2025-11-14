import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse } from '../types';
import { AppConfig, EmailConfig } from '@prisma/client';
import { encrypt, decrypt, isEncrypted } from '../utils/encryption';
import { withSysAdminAuth } from '../utils/auth';

/**
 * GET handler for AppConfig
 * Returns the current app configuration with decrypted adminPass
 * Requires system administrator authentication
 */
async function getHandler(req: NextRequest): Promise<NextResponse<ApiResponse<any>>> {
  try {
    let appConfig = await prisma.appConfig.findFirst();
    let emailConfig = await prisma.emailConfig.findFirst();
    
    if (!appConfig) {
      // Create default app config if none exists
      appConfig = await prisma.appConfig.create({
        data: {
          adminPass: encrypt('admin'), // Default encrypted password
          rootDomain: 'localhost',
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

    // Decrypt sensitive fields for the response
    // If adminPass is blank/empty, use default "admin" password
    let decryptedAdminPass: string;
    if (!appConfig.adminPass || appConfig.adminPass.trim() === '') {
      decryptedAdminPass = 'admin';
    } else {
      decryptedAdminPass = isEncrypted(appConfig.adminPass) ? decrypt(appConfig.adminPass) : appConfig.adminPass;
    }

    const decryptedAppConfig = {
      ...appConfig,
      adminPass: decryptedAdminPass,
    };

    const decryptedEmailConfig = {
      ...emailConfig,
      sendGridApiKey: emailConfig.sendGridApiKey && isEncrypted(emailConfig.sendGridApiKey) ? decrypt(emailConfig.sendGridApiKey) : emailConfig.sendGridApiKey,
      smtp2goApiKey: emailConfig.smtp2goApiKey && isEncrypted(emailConfig.smtp2goApiKey) ? decrypt(emailConfig.smtp2goApiKey) : emailConfig.smtp2goApiKey,
      password: emailConfig.password && isEncrypted(emailConfig.password) ? decrypt(emailConfig.password) : emailConfig.password,
    };

    return NextResponse.json<ApiResponse<{ appConfig: any; emailConfig: any }>>({
      success: true,
      data: {
        appConfig: decryptedAppConfig,
        emailConfig: decryptedEmailConfig,
      },
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
    const { appConfigData, emailConfigData } = body;
    
    let updatedAppConfig;
    let updatedEmailConfig;

    // Update AppConfig
    if (appConfigData) {
      const existingAppConfig = await prisma.appConfig.findFirst();
      if (!existingAppConfig) {
        return NextResponse.json<ApiResponse<null>>({ success: false, error: 'App configuration not found.' }, { status: 404 });
      }

      const data: Partial<AppConfig> = {};
      const allowedAppFields: (keyof AppConfig)[] = ['adminPass', 'rootDomain', 'enableHttps', 'adminEmail'];
      for (const field of allowedAppFields) {
        if (appConfigData[field] !== undefined) {
          (data as any)[field] = field === 'adminPass' ? encrypt(appConfigData[field]) : appConfigData[field];
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
          (data as any)[field] = encryptedFields.includes(field) && emailConfigData[field] ? encrypt(emailConfigData[field]) : emailConfigData[field];
        }
      }
      updatedEmailConfig = await prisma.emailConfig.update({ where: { id: existingEmailConfig.id }, data });
    }

    // Fetch updated configs to return decrypted data
    const finalAppConfig = await prisma.appConfig.findFirst();
    const finalEmailConfig = await prisma.emailConfig.findFirst();

    // Decrypt the final app config, using default "admin" if password is blank
    const decryptedAppConfig = finalAppConfig ? (() => {
      let decryptedAdminPass: string;
      if (!finalAppConfig.adminPass || finalAppConfig.adminPass.trim() === '') {
        decryptedAdminPass = 'admin';
      } else {
        decryptedAdminPass = isEncrypted(finalAppConfig.adminPass) ? decrypt(finalAppConfig.adminPass) : finalAppConfig.adminPass;
      }
      return {
        ...finalAppConfig,
        adminPass: decryptedAdminPass,
      };
    })() : null;

    const decryptedEmailConfig = finalEmailConfig ? {
      ...finalEmailConfig,
      sendGridApiKey: finalEmailConfig.sendGridApiKey && isEncrypted(finalEmailConfig.sendGridApiKey) ? decrypt(finalEmailConfig.sendGridApiKey) : finalEmailConfig.sendGridApiKey,
      smtp2goApiKey: finalEmailConfig.smtp2goApiKey && isEncrypted(finalEmailConfig.smtp2goApiKey) ? decrypt(finalEmailConfig.smtp2goApiKey) : finalEmailConfig.smtp2goApiKey,
      password: finalEmailConfig.password && isEncrypted(finalEmailConfig.password) ? decrypt(finalEmailConfig.password) : finalEmailConfig.password,
    } : null;

    return NextResponse.json<ApiResponse<any>>({
      success: true,
      data: {
        appConfig: decryptedAppConfig,
        emailConfig: decryptedEmailConfig
      },
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
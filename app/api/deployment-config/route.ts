import { NextRequest, NextResponse } from 'next/server';
import { ApiResponse } from '../types';

/**
 * GET handler for deployment configuration
 * Returns public deployment configuration without authentication
 * This endpoint is used to determine if the app is in SaaS or self-hosted mode
 */
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<any>>> {
  try {
    const deploymentMode = process.env.DEPLOYMENT_MODE || 'selfhosted';
    
    const config = {
      deploymentMode,
      // Add other public configuration options here as needed
      enableAccounts: process.env.ENABLE_ACCOUNTS === 'true',
      allowAccountRegistration: process.env.ALLOW_ACCOUNT_REGISTRATION === 'true',
      betaEnabled: process.env.BETA === '1',
      notificationsEnabled: process.env.ENABLE_NOTIFICATIONS === 'true',
    };

    return NextResponse.json<ApiResponse<typeof config>>({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Error fetching deployment config:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to fetch deployment configuration',
      },
      { status: 500 }
    );
  }
}

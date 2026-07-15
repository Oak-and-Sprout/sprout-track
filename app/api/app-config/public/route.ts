import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse } from '../../types';

/**
 * GET handler for public AppConfig data
 * Returns only non-sensitive configuration data (rootDomain, enableHttps, enablePhotos)
 * No authentication required - used for generating share URLs
 */
export async function GET(req: NextRequest) {
  try {
    let appConfig = await prisma.appConfig.findFirst();
    
    if (!appConfig) {
      // Create default app config if none exists
      appConfig = await prisma.appConfig.create({
        data: {
          adminPass: 'admin', // Default password (will be encrypted in main endpoint)
          rootDomain: 'localhost:3000',
          enableHttps: false,
        },
      });
    }

    // Return only public, non-sensitive data
    const publicConfig = {
      rootDomain: appConfig.rootDomain,
      enableHttps: appConfig.enableHttps,
      enablePhotos: appConfig?.enablePhotos ?? false,
    };

    return NextResponse.json<ApiResponse<typeof publicConfig>>({
      success: true,
      data: publicConfig,
    });
  } catch (error) {
    console.error('Error fetching public app config:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to fetch app configuration',
      },
      { status: 500 }
    );
  }
} 
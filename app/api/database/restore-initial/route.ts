import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import prisma from '../../db';
import { withAuthContext, ApiResponse, AuthResult } from '../../utils/auth';

// Helper to ensure database is closed before operations
async function disconnectPrisma() {
  await prisma.$disconnect();
}

async function handler(request: NextRequest, authContext: AuthResult): Promise<NextResponse<ApiResponse<any>>> {
  try {
    console.log('Starting initial setup database restore...');

    // Ensure database connection is closed
    await disconnectPrisma();

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'No file provided'
        },
        { status: 400 }
      );
    }

    const dbPath = path.resolve('./db/baby-tracker.db');
    const envPath = path.resolve('./.env');
    const dateStr = new Date().toISOString().split('T')[0];

    // Create buffer from file
    const buffer = Buffer.from(await file.arrayBuffer());

    // Check if it's a zip file
    const isZipFile = file.name.endsWith('.zip');

    if (isZipFile) {
      // Handle zip file restoration
      try {
        const zip = await JSZip.loadAsync(buffer);

        // Extract database file
        const dbFile = zip.file('baby-tracker.db');
        if (!dbFile) {
          return NextResponse.json<ApiResponse<null>>(
            {
              success: false,
              error: 'Database file not found in zip archive'
            },
            { status: 400 }
          );
        }

        const dbContent = await dbFile.async('nodebuffer');

        // Validate it's a SQLite database
        if (!dbContent.toString('utf8', 0, 16).includes('SQLite')) {
          return NextResponse.json<ApiResponse<null>>(
            {
              success: false,
              error: 'Invalid database file in zip archive'
            },
            { status: 400 }
          );
        }

        // Extract .env file if it exists
        const envFiles = Object.keys(zip.files).filter(name => name.endsWith('.backup.env'));
        let envContent: string | null = null;

        if (envFiles.length > 0) {
          const envFile = zip.file(envFiles[0]);
          if (envFile) {
            envContent = await envFile.async('string');
          }
        }

        // Create backup of existing database if it exists
        if (fs.existsSync(dbPath)) {
          const backupPath = `${dbPath}.backup-${dateStr}`;
          await fs.promises.copyFile(dbPath, backupPath);
          console.log('✓ Existing database backed up');
        }

        // Create backup of existing .env if it exists
        if (envContent && fs.existsSync(envPath)) {
          const envBackupPath = `${envPath}.backup-${dateStr}`;
          await fs.promises.copyFile(envPath, envBackupPath);
          console.log('✓ Existing .env backed up');
        }

        // Write new database file
        await fs.promises.writeFile(dbPath, dbContent);
        console.log('✓ Database file restored successfully');

        // Write new .env file if provided
        if (envContent) {
          await fs.promises.writeFile(envPath, envContent);
          console.log('✓ .env file restored successfully');
        }

        return NextResponse.json<ApiResponse<null>>({
          success: true,
          data: null
        });
      } catch (zipError) {
        console.error('Zip extraction error:', zipError);
        return NextResponse.json<ApiResponse<null>>(
          {
            success: false,
            error: 'Failed to extract zip archive'
          },
          { status: 400 }
        );
      }
    } else {
      // Handle raw database file restoration (legacy support)
      // Validate file is a SQLite database
      if (!buffer.toString('utf8', 0, 16).includes('SQLite')) {
        return NextResponse.json<ApiResponse<null>>(
          {
            success: false,
            error: 'Invalid database file - must be a valid SQLite database'
          },
          { status: 400 }
        );
      }

      // Create backup of existing database if it exists
      if (fs.existsSync(dbPath)) {
        const backupPath = `${dbPath}.backup-${dateStr}`;
        await fs.promises.copyFile(dbPath, backupPath);
        console.log('✓ Existing database backed up');
      }

      // Write new database file
      await fs.promises.writeFile(dbPath, buffer);
      console.log('✓ Database file restored successfully');

      return NextResponse.json<ApiResponse<null>>({
        success: true,
        data: null
      });
    }
  } catch (error) {
    console.error('💥 Initial setup restore failed:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to restore backup during initial setup'
      },
      { status: 500 }
    );
  }
}

// Export the POST handler with auth context (allows system admin and setup auth)
export const POST = withAuthContext(handler); 
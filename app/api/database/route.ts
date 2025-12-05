import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import prisma from '../db';
import { withSysAdminAuth, ApiResponse } from '../utils/auth';
import { reloadEnvFile } from '../utils/env-reload';

// Helper to ensure database is closed before operations
async function disconnectPrisma() {
  await prisma.$disconnect();
}

// Original GET handler
async function getHandler(req: NextRequest): Promise<NextResponse<ApiResponse<any>>> {
  try {
    // Ensure database connection is closed
    await disconnectPrisma();

    const dbPath = path.resolve('./db/baby-tracker.db');
    const envPath = path.resolve('./.env');
    const dateStr = new Date().toISOString().split('T')[0];

    // Read the database file
    const dbContent = await fs.promises.readFile(dbPath);

    // Read the .env file
    const envContent = await fs.promises.readFile(envPath, 'utf-8');

    // Create a zip file
    const zip = new JSZip();
    zip.file('baby-tracker.db', dbContent);
    zip.file(`${dateStr}.backup.env`, envContent);

    // Generate the zip file as a buffer
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // Create response with the zip content
    const response = new NextResponse(zipBuffer as any);

    // Set headers for file download
    response.headers.set('Content-Type', 'application/zip');
    response.headers.set('Content-Disposition', `attachment; filename="sprout-track-backup-${dateStr}.zip"`);

    return response as unknown as NextResponse<ApiResponse<any>>;
  } catch (error) {
    console.error('Backup error:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to create backup'
      },
      { status: 500 }
    );
  }
}

// Original POST handler
async function postHandler(req: NextRequest): Promise<NextResponse<ApiResponse<any>>> {
  try {
    // Ensure database connection is closed
    await disconnectPrisma();

    const formData = await req.formData();
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

        // Create backup of existing database
        const backupPath = `${dbPath}.backup-${dateStr}`;
        await fs.promises.copyFile(dbPath, backupPath);

        // Create backup of existing .env
        const envBackupPath = `${envPath}.backup-${dateStr}`;
        if (await fs.promises.access(envPath).then(() => true).catch(() => false)) {
          await fs.promises.copyFile(envPath, envBackupPath);
        }

        // Write new database file
        await fs.promises.writeFile(dbPath, dbContent);

        // Write new .env file if provided
        if (envContent) {
          await fs.promises.writeFile(envPath, envContent);
          // Reload environment variables from the new .env file
          reloadEnvFile(envPath);
        }

        return NextResponse.json<ApiResponse<null>>({ success: true });
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
            error: 'Invalid database file'
          },
          { status: 400 }
        );
      }

      // Create backup of existing database
      const backupPath = `${dbPath}.backup-${dateStr}`;
      await fs.promises.copyFile(dbPath, backupPath);

      // Write new database file
      await fs.promises.writeFile(dbPath, buffer);

      return NextResponse.json<ApiResponse<null>>({ success: true });
    }
  } catch (error) {
    console.error('Restore error:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to restore backup'
      },
      { status: 500 }
    );
  }
}

// Export the wrapped handlers with authentication
// Database operations should only be accessible to system administrators
export const GET = withSysAdminAuth(getHandler);
export const POST = withSysAdminAuth(postHandler);

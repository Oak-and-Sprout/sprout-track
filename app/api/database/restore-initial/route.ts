import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import prisma from '../../db';
import { withAuthContext, ApiResponse, AuthResult } from '../../utils/auth';
import { reloadEnvFile, ensureEnvDefaults } from '../../utils/env-reload';
import { isSQLite } from '../../utils/db-provider';
import { importFromSQLiteFile, importFromJSON } from '../../utils/db-backup';

// Helper to ensure database is closed before operations
async function disconnectPrisma() {
  await prisma.$disconnect();
}

async function handler(request: NextRequest, authContext: AuthResult): Promise<NextResponse<ApiResponse<any>>> {
  try {
    console.log('Starting initial setup database restore...');

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

        // Check what format the backup is in
        const dbFile = zip.file('baby-tracker.db');
        const jsonFile = zip.file('data.json');

        if (jsonFile) {
          // JSON format backup (from PostgreSQL) — works on any provider
          const jsonContent = await jsonFile.async('string');
          const data = JSON.parse(jsonContent);
          const result = await importFromJSON(data);
          console.log(`✓ Restored ${result.recordsImported} records across ${result.tablesImported} tables from JSON backup`);
        } else if (dbFile) {
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

          if (isSQLite()) {
            // SQLite → SQLite: write the .db file directly (existing behavior)
            await disconnectPrisma();

            const dbPath = path.resolve('./db/baby-tracker.db');

            // Create backup of existing database if it exists
            if (fs.existsSync(dbPath)) {
              const backupPath = `${dbPath}.backup-${dateStr}`;
              await fs.promises.copyFile(dbPath, backupPath);
              console.log('✓ Existing database backed up');
            }

            // Write new database file
            await fs.promises.writeFile(dbPath, dbContent);
            console.log('✓ Database file restored successfully');
          } else {
            // SQLite → PostgreSQL: read with better-sqlite3, insert via Prisma
            const result = await importFromSQLiteFile(dbContent);
            console.log(`✓ Migrated ${result.recordsImported} records across ${result.tablesImported} tables from SQLite to PostgreSQL`);
          }
        } else {
          return NextResponse.json<ApiResponse<null>>(
            {
              success: false,
              error: 'No database file or data.json found in zip archive'
            },
            { status: 400 }
          );
        }

        // Extract and restore .env file if it exists
        const envFiles = Object.keys(zip.files).filter(name => name.endsWith('.backup.env'));
        if (envFiles.length > 0) {
          const envFile = zip.file(envFiles[0]);
          if (envFile) {
            const envContent = await envFile.async('string');

            // Backup existing .env
            if (fs.existsSync(envPath)) {
              const envBackupPath = `${envPath}.backup-${dateStr}`;
              await fs.promises.copyFile(envPath, envBackupPath);
              console.log('✓ Existing .env backed up');
            }

            await fs.promises.writeFile(envPath, envContent);
            console.log('✓ .env file restored successfully');
          }
        }

        // Ensure all required env vars exist (fills gaps from older backups)
        ensureEnvDefaults(envPath);
        // Reload environment variables into process.env
        reloadEnvFile(envPath);

        // Ensure all required env vars exist (fills gaps from older backups)
        ensureEnvDefaults(envPath);
        // Reload environment variables into process.env
        reloadEnvFile(envPath);

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
      if (buffer.toString('utf8', 0, 16).includes('SQLite')) {
        if (isSQLite()) {
          // SQLite → SQLite: write the .db file directly
          await disconnectPrisma();

          const dbPath = path.resolve('./db/baby-tracker.db');

          if (fs.existsSync(dbPath)) {
            const backupPath = `${dbPath}.backup-${dateStr}`;
            await fs.promises.copyFile(dbPath, backupPath);
            console.log('✓ Existing database backed up');
          }

          await fs.promises.writeFile(dbPath, buffer);
          console.log('✓ Database file restored successfully');
        } else {
          // SQLite → PostgreSQL: read with better-sqlite3, insert via Prisma
          const result = await importFromSQLiteFile(buffer);
          console.log(`✓ Migrated ${result.recordsImported} records across ${result.tablesImported} tables from SQLite to PostgreSQL`);
        }

        // Ensure all required env vars exist
        ensureEnvDefaults(envPath);
        reloadEnvFile(envPath);

        return NextResponse.json<ApiResponse<null>>({
          success: true,
          data: null
        });
      } else {
        return NextResponse.json<ApiResponse<null>>(
          {
            success: false,
            error: 'Invalid file format. Expected a .zip backup or .db SQLite file.'
          },
          { status: 400 }
        );
      }
    }
  } catch (error) {
    console.error('Initial setup restore failed:', error);
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

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import prisma from '../db';
import { withSysAdminAuth, ApiResponse } from '../utils/auth';
import { reloadEnvFile, ensureEnvDefaults, parseEnvFile, replaceEnvVar } from '../utils/env-reload';
import { isSQLite } from '../utils/db-provider';
import { importFromSQLiteFile, importFromJSON, exportToJSON } from '../utils/db-backup';

// Helper to ensure database is closed before operations
async function disconnectPrisma() {
  await prisma.$disconnect();
}

// GET handler — create backup
async function getHandler(req: NextRequest): Promise<NextResponse<ApiResponse<any>>> {
  try {
    const dateStr = new Date().toISOString().split('T')[0];
    const zip = new JSZip();

    if (isSQLite()) {
      // SQLite: zip the .db file directly (existing behavior)
      await disconnectPrisma();

      const dbPath = path.resolve('./db/baby-tracker.db');
      const dbContent = await fs.promises.readFile(dbPath);
      zip.file('baby-tracker.db', dbContent);
    } else {
      // PostgreSQL: export all data as JSON via Prisma
      const data = await exportToJSON();
      zip.file('data.json', JSON.stringify(data, null, 2));
    }

    // Include .env file in backup
    const envPath = path.resolve('./.env');
    try {
      const envContent = await fs.promises.readFile(envPath, 'utf-8');
      zip.file(`${dateStr}.backup.env`, envContent);
    } catch {
      // .env file may not exist, that's ok
    }

    // Generate the zip file as a buffer
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // Create response with the zip content
    const response = new NextResponse(zipBuffer as any);
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

// POST handler — restore backup
async function postHandler(req: NextRequest): Promise<NextResponse<ApiResponse<any>>> {
  try {
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
          console.log(`Restored ${result.recordsImported} records across ${result.tablesImported} tables from JSON backup`);
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

            // Create backup of existing database
            const backupPath = `${dbPath}.backup-${dateStr}`;
            await fs.promises.copyFile(dbPath, backupPath);

            // Write new database file
            await fs.promises.writeFile(dbPath, dbContent);
          } else {
            // SQLite → PostgreSQL: read with better-sqlite3, insert via Prisma
            const result = await importFromSQLiteFile(dbContent);
            console.log(`Migrated ${result.recordsImported} records across ${result.tablesImported} tables from SQLite to PostgreSQL`);
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

        // Extract and restore .env file if it exists, preserving current DB connection params
        const envFiles = Object.keys(zip.files).filter(name => name.endsWith('.backup.env'));
        if (envFiles.length > 0) {
          const envFile = zip.file(envFiles[0]);
          if (envFile) {
            const envContent = await envFile.async('string');

            // Save current DB connection params before overwriting
            const preserveKeys = ['DATABASE_PROVIDER', 'DATABASE_URL', 'LOG_DATABASE_URL'];
            const preserved: Record<string, string> = {};
            const currentEnvExists = await fs.promises.access(envPath).then(() => true).catch(() => false);
            if (currentEnvExists) {
              const currentEnvContent = await fs.promises.readFile(envPath, 'utf-8');
              const currentVars = parseEnvFile(currentEnvContent);
              for (const key of preserveKeys) {
                if (currentVars[key]) preserved[key] = currentVars[key];
              }

              // Backup existing .env
              const envBackupPath = `${envPath}.backup-${dateStr}`;
              await fs.promises.copyFile(envPath, envBackupPath);
            }

            // Write the backup's .env
            await fs.promises.writeFile(envPath, envContent);

            // Re-apply preserved DB connection params
            if (Object.keys(preserved).length > 0) {
              let restoredContent = await fs.promises.readFile(envPath, 'utf-8');
              for (const [key, value] of Object.entries(preserved)) {
                restoredContent = replaceEnvVar(restoredContent, key, value);
              }
              await fs.promises.writeFile(envPath, restoredContent);
              console.log('Database connection parameters preserved during .env restore');
            }
          }
        }

        // Ensure all required env vars exist (fills gaps from older backups)
        ensureEnvDefaults(envPath);
        // Reload environment variables into process.env
        reloadEnvFile(envPath);

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
      if (buffer.toString('utf8', 0, 16).includes('SQLite')) {
        if (isSQLite()) {
          // SQLite → SQLite: write the .db file directly
          await disconnectPrisma();

          const dbPath = path.resolve('./db/baby-tracker.db');
          const backupPath = `${dbPath}.backup-${dateStr}`;
          await fs.promises.copyFile(dbPath, backupPath);
          await fs.promises.writeFile(dbPath, buffer);
        } else {
          // SQLite → PostgreSQL: read with better-sqlite3, insert via Prisma
          const result = await importFromSQLiteFile(buffer);
          console.log(`Migrated ${result.recordsImported} records across ${result.tablesImported} tables from SQLite to PostgreSQL`);
        }

        // Ensure all required env vars exist
        ensureEnvDefaults(envPath);
        reloadEnvFile(envPath);

        return NextResponse.json<ApiResponse<null>>({ success: true });
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

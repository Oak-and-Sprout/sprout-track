import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { withAuthContext, ApiResponse, AuthResult } from '../../utils/auth';

// Target migration to check against
const TARGET_MIGRATION = '20250807141402_add_feedback_model';

interface PreMigrationCheckResult {
  adminResetRequired: boolean;
  latestMigration: string | null;
  isOlderDatabase: boolean;
}

async function checkHandler(req: NextRequest, authContext: AuthResult): Promise<NextResponse<ApiResponse<PreMigrationCheckResult>>> {
  let tempPrisma: PrismaClient | null = null;

  try {
    // Create a new Prisma client instance for the restored database
    tempPrisma = new PrismaClient({
      datasources: {
        db: {
          url: 'file:../db/baby-tracker.db'
        }
      }
    });

    // Query the _prisma_migrations table to get the latest migration
    const latestMigration = await tempPrisma.$queryRaw<Array<{ migration_name: string; finished_at: string }>>`
      SELECT migration_name, finished_at
      FROM _prisma_migrations
      ORDER BY finished_at DESC
      LIMIT 1
    `;

    let adminResetRequired = false;
    let isOlderDatabase = false;
    let latestMigrationName: string | null = null;

    if (latestMigration && latestMigration.length > 0) {
      latestMigrationName = latestMigration[0].migration_name;

      // Extract the date portion from migration names (format: YYYYMMDDHHMMSS_description)
      const latestMigrationDate = latestMigrationName.substring(0, 14);
      const targetMigrationDate = TARGET_MIGRATION.substring(0, 14);

      // Compare migration dates
      isOlderDatabase = latestMigrationDate <= targetMigrationDate;
      adminResetRequired = isOlderDatabase;

      console.log(`Pre-migration check (initial): Latest migration: ${latestMigrationName}`);
      console.log(`Pre-migration check (initial): Target migration: ${TARGET_MIGRATION}`);
      console.log(`Pre-migration check (initial): Is older database: ${isOlderDatabase}`);
      console.log(`Pre-migration check (initial): Admin reset required: ${adminResetRequired}`);

      // If admin reset is required, clear the admin password in AppConfig
      if (adminResetRequired) {
        console.log('Pre-migration check (initial): Resetting admin password in AppConfig table...');

        // Update all AppConfig records to have an empty admin password
        const updateResult = await tempPrisma.$executeRaw`
          UPDATE AppConfig SET adminPass = ''
        `;

        console.log(`Pre-migration check (initial): Admin password reset complete. Rows affected: ${updateResult}`);
      }
    } else {
      // No migrations found - treat as a new/empty database
      console.log('Pre-migration check (initial): No migrations found in database');
      latestMigrationName = null;
      isOlderDatabase = false;
      adminResetRequired = false;
    }

    await tempPrisma.$disconnect();

    return NextResponse.json<ApiResponse<PreMigrationCheckResult>>({
      success: true,
      data: {
        adminResetRequired,
        latestMigration: latestMigrationName,
        isOlderDatabase
      }
    });

  } catch (error) {
    console.error('Pre-migration check (initial) error:', error);

    // Ensure we disconnect the Prisma client
    if (tempPrisma) {
      try {
        await tempPrisma.$disconnect();
      } catch (disconnectError) {
        console.error('Error disconnecting Prisma client:', disconnectError);
      }
    }

    return NextResponse.json<ApiResponse<PreMigrationCheckResult>>(
      {
        success: false,
        error: 'Failed to perform pre-migration check',
        data: {
          adminResetRequired: false,
          latestMigration: null,
          isOlderDatabase: false
        }
      },
      { status: 500 }
    );
  }
}

// Export the wrapped handler with auth context (allows system admin and setup auth)
export const POST = withAuthContext(checkHandler);

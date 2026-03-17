import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { withAuthContext, ApiResponse, AuthResult } from '../../utils/auth';
import { isPostgreSQL } from '../../utils/db-provider';

const execAsync = promisify(exec);

async function handler(request: NextRequest, authContext: AuthResult): Promise<NextResponse<ApiResponse<any>>> {
  try {
    console.log('Starting initial setup database migration...');
    
    // Get the project root directory
    const projectRoot = process.cwd();
    const scriptsDir = path.join(projectRoot, 'scripts');
    
    // Step 1: Generate Prisma client
    console.log('Step 1: Generating Prisma client...');
    try {
      await execAsync('npm run prisma:generate', { cwd: projectRoot });
      console.log('✓ Prisma client generated successfully');
    } catch (error) {
      console.error('✗ Prisma client generation failed:', error);
      throw new Error('Failed to generate Prisma client. This may indicate a schema issue.');
    }
    
    // Step 2: Run Prisma migrations
    console.log('Step 2: Running database schema migrations...');
    if (isPostgreSQL()) {
      // PostgreSQL: use db push to sync schema (no SQLite migration files)
      try {
        await execAsync('npx prisma db push --accept-data-loss --skip-generate', { cwd: projectRoot });
        console.log('✓ PostgreSQL schema push completed successfully');
      } catch (error) {
        console.error('✗ PostgreSQL schema push failed:', error);
        throw new Error('Failed to push database schema. Database may be incompatible.');
      }
    } else {
      // SQLite: use migrate deploy (existing behavior)
      try {
        await execAsync('npx prisma migrate deploy', { cwd: projectRoot });
        console.log('✓ Database schema migrations completed successfully');
      } catch (error) {
        console.error('✗ Database schema migrations failed:', error);
        // Try development migration as fallback
        try {
          console.log('Trying development migration as fallback...');
          await execAsync('npm run prisma:migrate', { cwd: projectRoot });
          console.log('✓ Development migration completed successfully');
        } catch (devError) {
          console.error('✗ Development migration also failed:', devError);
          throw new Error('Failed to run database migrations. Database schema may be incompatible.');
        }
      }
    }

    // Step 3: Run family migration script (SQLite only — uses SQLite-specific raw SQL)
    if (!isPostgreSQL()) {
      console.log('Step 3: Checking for family data migration...');
      try {
        const familyMigrationScript = path.join(scriptsDir, 'family-migration.js');
        await execAsync(`node "${familyMigrationScript}"`, { cwd: projectRoot });
        console.log('✓ Family data migration completed successfully');
      } catch (error) {
        console.error('⚠ Family data migration failed:', error);
        console.warn('Family migration skipped - may not be needed for this database version');
      }
    } else {
      console.log('Step 3: Skipping family migration (not needed for PostgreSQL)');
    }
    
    // Step 4: Seed the database with updated data
    console.log('Step 4: Updating database with latest settings and units...');
    try {
      await execAsync('npm run prisma:seed', { cwd: projectRoot });
      console.log('✓ Database seeding completed successfully');
    } catch (error) {
      console.error('✗ Database seeding failed:', error);
      throw new Error('Failed to seed database with default data. Some features may not work correctly.');
    }
    
    console.log('🎉 Initial setup migration completed successfully!');
    
    return NextResponse.json<ApiResponse<any>>({
      success: true,
      data: {
        message: 'Database successfully migrated for initial setup',
        steps: [
          'Prisma client generated',
          'Schema migrations applied', 
          'Family data structure updated',
          'Default settings and units added'
        ]
      }
    });
    
  } catch (error) {
    console.error('💥 Initial setup migration failed:', error);
    
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: `${error instanceof Error ? error.message : 'Migration failed'}. You may need to use a different backup or manually run migration scripts.`,
        data: null
      }, 
      { status: 500 }
    );
  }
}

// Export the POST handler with auth context (allows system admin and setup auth)
export const POST = withAuthContext(handler); 
/**
 * Database backup/restore utilities for cross-database migration support.
 *
 * Supports:
 * - Reading SQLite .db files via better-sqlite3 and importing into any provider
 * - Exporting all data via Prisma as JSON (for PostgreSQL backups)
 * - Importing JSON data via Prisma (for PostgreSQL restores)
 */

import Database from 'better-sqlite3';
import prisma from '../db';

// Tables in dependency order (parents before children)
// Junction/child tables come after their parent tables
const TABLE_IMPORT_ORDER = [
  // Standalone tables (no foreign keys to other app tables)
  'Unit',
  'AppConfig',
  'EmailConfig',
  'NotificationConfig',
  'DemoTracker',
  'CdcWeightForAge',
  'CdcLengthForAge',
  'CdcHeadCircumferenceForAge',
  'BetaSubscriber',
  'BetaCampaign',

  // Core entities
  'Family',
  'Account',
  'Caretaker',
  'Baby',
  'Settings',
  'Contact',

  // Family membership
  'FamilyMember',
  'FamilySetup',

  // Activity logs (depend on Baby, Caretaker, Family)
  'SleepLog',
  'FeedLog',
  'DiaperLog',
  'MoodLog',
  'Note',
  'Milestone',
  'PumpLog',
  'BreastMilkAdjustment',
  'PlayLog',
  'BathLog',
  'Measurement',
  'ActiveBreastFeed',

  // Medicine (Medicine before MedicineLog)
  'Medicine',
  'MedicineLog',

  // Calendar events
  'CalendarEvent',

  // Vaccines
  'VaccineLog',
  'VaccineDocument',

  // Junction tables
  'BabyEvent',
  'CaretakerEvent',
  'ContactEvent',
  'ContactMedicine',
  'ContactVaccine',
  'BetaCampaignEmail',

  // Feedback
  'Feedback',

  // Push notifications
  'PushSubscription',
  'NotificationPreference',
  'NotificationLog',

  // API keys
  'ApiKey',
];

// Boolean columns per table that need conversion from SQLite integers (0/1) to booleans
const BOOLEAN_COLUMNS: Record<string, string[]> = {
  Account: ['verified', 'betaparticipant', 'closed'],
  Family: ['isActive'],
  Baby: ['inactive'],
  Caretaker: ['inactive'],
  Settings: ['enableDebugTimer', 'enableDebugTimezone', 'enableBreastMilkTracking'],
  BathLog: ['soapUsed', 'shampooUsed'],
  DiaperLog: ['blowout', 'creamApplied'],
  CalendarEvent: ['allDay', 'recurring', 'notificationSent'],
  Medicine: ['active', 'isSupplement'],
  BetaSubscriber: ['isOptedIn'],
  BetaCampaign: ['isActive'],
  Feedback: ['viewed'],
  NotificationConfig: ['enabled'],
  AppConfig: ['enableHttps'],
  EmailConfig: ['enableTls', 'allowSelfSignedCert'],
  NotificationPreference: ['enabled'],
  NotificationLog: ['success'],
  ActiveBreastFeed: ['isPaused'],
  ApiKey: ['revoked'],
};

// Date columns per table that need conversion from SQLite strings to Date objects
// Only listing columns that are NOT auto-managed by Prisma (createdAt/updatedAt)
const DATE_COLUMNS: Record<string, string[]> = {
  Account: ['passwordResetExpires', 'planExpires', 'trialEnds', 'closedAt', 'createdAt', 'updatedAt'],
  Family: ['createdAt', 'updatedAt'],
  FamilyMember: ['joinedAt'],
  Baby: ['birthDate', 'createdAt', 'updatedAt', 'deletedAt'],
  Caretaker: ['createdAt', 'updatedAt', 'deletedAt'],
  SleepLog: ['startTime', 'endTime', 'createdAt', 'updatedAt', 'deletedAt'],
  FeedLog: ['time', 'startTime', 'endTime', 'createdAt', 'updatedAt', 'deletedAt'],
  DiaperLog: ['time', 'createdAt', 'updatedAt', 'deletedAt'],
  MoodLog: ['time', 'createdAt', 'updatedAt', 'deletedAt'],
  Note: ['time', 'createdAt', 'updatedAt', 'deletedAt'],
  Settings: ['createdAt', 'updatedAt'],
  Milestone: ['date', 'createdAt', 'updatedAt', 'deletedAt'],
  PumpLog: ['startTime', 'endTime', 'createdAt', 'updatedAt', 'deletedAt'],
  BreastMilkAdjustment: ['time', 'createdAt', 'updatedAt', 'deletedAt'],
  PlayLog: ['startTime', 'endTime', 'createdAt', 'updatedAt', 'deletedAt'],
  BathLog: ['time', 'createdAt', 'updatedAt', 'deletedAt'],
  Measurement: ['date', 'createdAt', 'updatedAt', 'deletedAt'],
  Contact: ['createdAt', 'updatedAt', 'deletedAt'],
  CalendarEvent: ['startTime', 'endTime', 'recurrenceEnd', 'createdAt', 'updatedAt', 'deletedAt'],
  Medicine: ['createdAt', 'updatedAt', 'deletedAt'],
  MedicineLog: ['time', 'createdAt', 'updatedAt', 'deletedAt'],
  VaccineLog: ['time', 'createdAt', 'updatedAt', 'deletedAt'],
  VaccineDocument: ['createdAt', 'updatedAt'],
  FamilySetup: ['expiresAt', 'createdAt', 'updatedAt'],
  BetaSubscriber: ['optedOutAt', 'createdAt', 'updatedAt', 'deletedAt'],
  BetaCampaign: ['scheduledAt', 'sentAt', 'createdAt', 'updatedAt', 'deletedAt'],
  BetaCampaignEmail: ['sentAt', 'deliveredAt', 'openedAt', 'clickedAt'],
  AppConfig: ['updatedAt'],
  EmailConfig: ['updatedAt'],
  NotificationConfig: ['updatedAt'],
  DemoTracker: ['dateRangeStart', 'dateRangeEnd', 'generatedAt', 'lastAccessedAt'],
  Feedback: ['submittedAt', 'createdAt', 'updatedAt', 'deletedAt'],
  PushSubscription: ['lastFailureAt', 'lastSuccessAt', 'createdAt', 'updatedAt'],
  NotificationPreference: ['lastTimerNotifiedAt', 'createdAt', 'updatedAt'],
  NotificationLog: ['createdAt'],
  ActiveBreastFeed: ['currentSideStartTime', 'sessionStartTime', 'createdAt', 'updatedAt'],
  ApiKey: ['lastUsedAt', 'expiresAt', 'createdAt', 'updatedAt'],
  Unit: ['createdAt', 'updatedAt'],
};

/**
 * Convert SQLite row data for a given table to proper types.
 * SQLite stores booleans as 0/1 and dates as strings.
 */
function convertRow(tableName: string, row: Record<string, any>): Record<string, any> {
  const converted = { ...row };

  // Convert boolean columns
  const boolCols = BOOLEAN_COLUMNS[tableName] || [];
  for (const col of boolCols) {
    if (col in converted && converted[col] !== null && converted[col] !== undefined) {
      converted[col] = converted[col] === 1 || converted[col] === true || converted[col] === '1';
    }
  }

  // Convert date columns
  const dateCols = DATE_COLUMNS[tableName] || [];
  for (const col of dateCols) {
    if (col in converted && converted[col] !== null && converted[col] !== undefined) {
      const val = converted[col];
      if (typeof val === 'string' || typeof val === 'number') {
        converted[col] = new Date(val);
      }
    }
  }

  return converted;
}

/**
 * Get the Prisma model delegate for a given table name.
 */
function getModelDelegate(tableName: string): any {
  const modelName = tableName.charAt(0).toLowerCase() + tableName.slice(1);
  return (prisma as any)[modelName];
}

/**
 * Import data from a SQLite .db file buffer into the current database via Prisma.
 * Used when restoring a SQLite backup onto PostgreSQL.
 */
export async function importFromSQLiteFile(buffer: Buffer): Promise<{ tablesImported: number; recordsImported: number }> {
  // Write buffer to a temp file for better-sqlite3
  const fs = await import('fs');
  const os = await import('os');
  const path = await import('path');
  const tmpFile = path.join(os.tmpdir(), `sprout-restore-${Date.now()}.db`);

  try {
    fs.writeFileSync(tmpFile, buffer);
    const db = new Database(tmpFile, { readonly: true });

    let tablesImported = 0;
    let recordsImported = 0;

    // Get list of tables that actually exist in the SQLite database
    const existingTables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_prisma%' AND name NOT LIKE 'sqlite_%'"
    ).all() as Array<{ name: string }>;
    const existingTableNames = new Set(existingTables.map(t => t.name));

    for (const tableName of TABLE_IMPORT_ORDER) {
      if (!existingTableNames.has(tableName)) {
        continue;
      }

      const delegate = getModelDelegate(tableName);
      if (!delegate) {
        console.warn(`Warning: No Prisma model found for table "${tableName}", skipping.`);
        continue;
      }

      const rows = db.prepare(`SELECT * FROM "${tableName}"`).all() as Record<string, any>[];
      if (rows.length === 0) continue;

      const convertedRows = rows.map(row => convertRow(tableName, row));

      // Insert in batches to avoid memory issues
      const BATCH_SIZE = 100;
      for (let i = 0; i < convertedRows.length; i += BATCH_SIZE) {
        const batch = convertedRows.slice(i, i + BATCH_SIZE);
        try {
          await delegate.createMany({
            data: batch,
            skipDuplicates: true,
          });
        } catch (error) {
          // Fall back to individual inserts if createMany fails
          console.warn(`Batch insert failed for ${tableName}, falling back to individual inserts:`, error);
          for (const row of batch) {
            try {
              await delegate.create({ data: row });
            } catch (individualError) {
              console.warn(`Skipping row in ${tableName}:`, individualError);
            }
          }
        }
      }

      tablesImported++;
      recordsImported += convertedRows.length;
      console.log(`Imported ${convertedRows.length} records into ${tableName}`);
    }

    db.close();
    return { tablesImported, recordsImported };
  } finally {
    // Clean up temp file
    try {
      const fs = await import('fs');
      if (fs.existsSync(tmpFile)) {
        fs.unlinkSync(tmpFile);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Export all data from the current database via Prisma as a JSON object.
 * Used for PostgreSQL backups (since there's no .db file to grab).
 */
export async function exportToJSON(): Promise<Record<string, any[]>> {
  const data: Record<string, any[]> = {};

  for (const tableName of TABLE_IMPORT_ORDER) {
    const delegate = getModelDelegate(tableName);
    if (!delegate) continue;

    try {
      const rows = await delegate.findMany();
      if (rows.length > 0) {
        data[tableName] = rows;
      }
    } catch (error) {
      console.warn(`Warning: Could not export table "${tableName}":`, error);
    }
  }

  return data;
}

/**
 * Import data from a JSON object into the current database via Prisma.
 * Used for PostgreSQL-to-PostgreSQL (or PostgreSQL-to-SQLite) restores.
 */
export async function importFromJSON(data: Record<string, any[]>): Promise<{ tablesImported: number; recordsImported: number }> {
  let tablesImported = 0;
  let recordsImported = 0;

  for (const tableName of TABLE_IMPORT_ORDER) {
    const rows = data[tableName];
    if (!rows || rows.length === 0) continue;

    const delegate = getModelDelegate(tableName);
    if (!delegate) {
      console.warn(`Warning: No Prisma model found for table "${tableName}", skipping.`);
      continue;
    }

    // Convert date strings back to Date objects
    const convertedRows = rows.map(row => {
      const converted = { ...row };
      const dateCols = DATE_COLUMNS[tableName] || [];
      for (const col of dateCols) {
        if (col in converted && converted[col] !== null && converted[col] !== undefined) {
          converted[col] = new Date(converted[col]);
        }
      }
      return converted;
    });

    const BATCH_SIZE = 100;
    for (let i = 0; i < convertedRows.length; i += BATCH_SIZE) {
      const batch = convertedRows.slice(i, i + BATCH_SIZE);
      try {
        await delegate.createMany({
          data: batch,
          skipDuplicates: true,
        });
      } catch (error) {
        console.warn(`Batch insert failed for ${tableName}, falling back to individual inserts:`, error);
        for (const row of batch) {
          try {
            await delegate.create({ data: row });
          } catch (individualError) {
            console.warn(`Skipping row in ${tableName}:`, individualError);
          }
        }
      }
    }

    tablesImported++;
    recordsImported += convertedRows.length;
    console.log(`Imported ${convertedRows.length} records into ${tableName}`);
  }

  return { tablesImported, recordsImported };
}

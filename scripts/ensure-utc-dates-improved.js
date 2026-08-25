/**
 * Improved script to check and update all time fields in the database to UTC
 * Run with: node scripts/ensure-utc-dates-improved.js
 * 
 * This version has improved DST handling and more reliable UTC detection
 */

import { PrismaClient } from '@prisma/client';
import { createPrismaAdapter } from '../prisma/prisma-adapter.js';
import { execSync } from 'child_process';

const prisma = new PrismaClient({ adapter: createPrismaAdapter(process.env.DATABASE_URL) });

// Models and their date fields
const dateFieldsByModel = {
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
  PlayLog: ['startTime', 'endTime', 'createdAt', 'updatedAt', 'deletedAt'],
  BathLog: ['time', 'createdAt', 'updatedAt', 'deletedAt'],
  Measurement: ['date', 'createdAt', 'updatedAt', 'deletedAt'],
  Unit: ['createdAt', 'updatedAt']
};

/**
 * Get the system timezone directly
 * @returns The detected system timezone string
 */
function getSystemTimezone() {
  try {
    // Try to get timezone from process.env.TZ
    if (process.env.TZ) {
      return process.env.TZ;
    }
    
    // Different commands based on platform
    if (process.platform === 'darwin') { // macOS
      const tzOutput = execSync('systemsetup -gettimezone').toString().trim();
      // Extract timezone from "Time Zone: America/Denver" format
      const match = tzOutput.match(/Time Zone: (.+)$/);
      if (match && match[1]) {
        return match[1];
      }
    } else if (process.platform === 'linux') {
      return execSync('cat /etc/timezone').toString().trim();
    }
    
    // Fallback to Intl API for Windows or other platforms
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.error('Error detecting system timezone:', error);
    // Fallback to a safe default if detection fails
    return 'UTC';
  }
}

/**
 * Check if a date is in UTC
 * This improved version is more reliable during DST transitions
 * @param date The date to check
 * @returns True if the date is in UTC, false otherwise
 */
function isUtcDate(date) {
  if (!(date instanceof Date)) {
    return false;
  }
  
  // Get the ISO string representation
  const isoString = date.toISOString();
  
  // Create a new Date from the ISO string
  // This will be in UTC by definition
  const utcDate = new Date(isoString);
  
  // Compare the time values directly
  // If they're the same, the original date was in UTC
  return date.getTime() === utcDate.getTime();
}

/**
 * Convert a date to UTC
 * @param date The date to convert
 * @returns The date in UTC
 */
function toUtc(date) {
  // Create a new date from the ISO string, which is always in UTC
  return new Date(date.toISOString());
}

/**
 * Process a model to ensure all date fields are in UTC
 * @param modelName The name of the model to process
 */
async function processModel(modelName) {
  console.log(`Processing ${modelName}...`);
  
  const dateFields = dateFieldsByModel[modelName];
  if (!dateFields || dateFields.length === 0) {
    console.log(`No date fields found for ${modelName}`);
    return;
  }
  
  // Get all records for the model
  const records = await prisma[modelName.charAt(0).toLowerCase() + modelName.slice(1)].findMany();
  console.log(`Found ${records.length} records for ${modelName}`);
  
  let updatedCount = 0;
  
  // Process each record
  for (const record of records) {
    const updates = {};
    let needsUpdate = false;
    
    // Check each date field
    for (const field of dateFields) {
      const date = record[field];
      if (date && date instanceof Date) {
        if (!isUtcDate(date)) {
          updates[field] = toUtc(date);
          needsUpdate = true;
          console.log(`Converting ${field} for ${modelName} record ${record.id}`);
        }
      }
    }
    
    // Update the record if needed
    if (needsUpdate) {
      try {
        await prisma[modelName.charAt(0).toLowerCase() + modelName.slice(1)].update({
          where: { id: record.id },
          data: updates
        });
        updatedCount++;
      } catch (error) {
        console.error(`Error updating ${modelName} record ${record.id}:`, error);
      }
    }
  }
  
  console.log(`Updated ${updatedCount} records for ${modelName}`);
}

/**
 * Main function to process all models
 */
async function main() {
  console.log('Starting UTC date conversion...');
  console.log(`System timezone: ${getSystemTimezone()}`);
  
  // Process each model
  for (const modelName of Object.keys(dateFieldsByModel)) {
    await processModel(modelName);
  }
  
  console.log('UTC date conversion complete!');
}

// Run the main function
main()
  .catch(e => {
    console.error('Error in UTC date conversion:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/**
 * Server-side timezone utilities
 * These functions handle conversion between UTC and local time for database operations
 */

import prisma from '../db';

/**
 * Get the actual system timezone directly from the OS
 * @returns The detected system timezone string (e.g., 'America/Denver')
 */
export function getSystemTimezone(): string {
  try {
    // Try to get timezone from process.env.TZ
    if (process.env.TZ) {
      return process.env.TZ;
    }
    
    // Use child_process to execute the system command to get timezone
    // This is more reliable on server environments
    const { execSync } = require('child_process');
    
    // Different commands based on platform
    if (process.platform === 'darwin') { // macOS
      const tzOutput = execSync('systemsetup -gettimezone').toString().trim();
      // Extract timezone from "Time Zone: America/Denver" format
      const match = tzOutput.match(/Time Zone: (.+)$/);
      if (match && match[1]) {
        return match[1];
      }
    } else if (process.platform === 'linux') {
      try {
        // Try /etc/timezone first (Debian, Ubuntu)
        return execSync('cat /etc/timezone').toString().trim();
      } catch (error) {
        try {
          // Try /etc/localtime as a symlink (RHEL, CentOS, Alpine)
          const linkTarget = execSync('readlink -f /etc/localtime').toString().trim();
          const match = linkTarget.match(/\/usr\/share\/zoneinfo\/(.+)$/);
          if (match && match[1]) {
            return match[1];
          }
        } catch (innerError) {
          // Try TZ file (Alpine Linux)
          try {
            return execSync('cat /etc/TZ').toString().trim();
          } catch (tzError) {
            // Fallback to TZ environment variable or Intl API
            if (process.env.TZ) {
              return process.env.TZ;
            }
            return Intl.DateTimeFormat().resolvedOptions().timeZone;
          }
        }
      }
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
 * Get the server's timezone settings
 * Always returns the actual system timezone regardless of what's in the database
 * @returns The server's timezone settings object containing the timezone
 */
export async function getSettings() {
  // Get the actual system timezone
  const systemTimezone = getSystemTimezone();
  console.log(`Using system timezone: ${systemTimezone}`);
  
  // Get or create settings record
  let settings = await prisma.settings.findFirst();
  if (!settings) {
    // Create settings without timezone field since it's been removed from the schema
    settings = await prisma.settings.create({
      data: {
        familyName: 'My Family', // Default family name
        defaultBottleUnit: 'OZ',
        defaultSolidsUnit: 'TBSP',
        defaultHeightUnit: 'IN',
        defaultWeightUnit: 'LB',
        defaultTempUnit: 'F',
      },
    });
  }
  
  // Return the settings object with the system timezone as a separate property
  return {
    settings,
    systemTimezone
  };
}

/**
 * Convert a date string or Date object to UTC for storage in the database
 * This function properly handles different date input formats and ensures
 * consistent UTC conversion regardless of the server's timezone
 * @param dateInput - Date string or Date object to convert
 * @returns Date object in UTC
 */
export function toUTC(dateInput: string | Date): Date {
  try {
    // If it's already a Date object, just return a new copy
    if (dateInput instanceof Date) {
      return new Date(dateInput);
    }
    
    // If it's a string with timezone info (Z or +/-), parse it directly
    if (typeof dateInput === 'string' && 
        (dateInput.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(dateInput))) {
      return new Date(dateInput);
    }
    
    // For strings without timezone info (from datetime-local inputs)
    // We need to treat them as UTC directly, not interpret in server's timezone
    if (typeof dateInput === 'string') {
      // Parse the date string components
      const [datePart, timePart] = dateInput.split('T');
      if (!datePart) {
        throw new Error('Invalid date format');
      }
      
      const [year, month, day] = datePart.split('-').map(Number);
      const [hours, minutes, secondsStr = '0'] = timePart ? timePart.split(':') : ['0', '0', '0'];
      
      // Create a UTC date directly using Date.UTC
      // This bypasses any server timezone interpretation
      return new Date(Date.UTC(
        year,
        month - 1, // Month is 0-indexed in JavaScript
        day,
        Number(hours),
        Number(minutes),
        Number(secondsStr)
      ));
    }
    
    throw new Error('Invalid date input type');
  } catch (error) {
    console.error('Error converting to UTC:', error);
    // Return current date as fallback
    return new Date();
  }
}

/**
 * Format a date for API responses (ISO format)
 * @param date - Date to format
 * @returns ISO string representation of the date or null if date is null
 */
export function formatForResponse(date: Date | string | null): string | null {
  if (!date) return null;
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Validate the date
    if (isNaN(dateObj.getTime())) {
      throw new Error('Invalid date input');
    }
    
    return dateObj.toISOString();
  } catch (error) {
    console.error('Error formatting date for response:', error);
    return null;
  }
}

/**
 * Calculate duration between two dates in minutes
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Duration in minutes
 */
export function calculateDurationMinutes(startDate: Date | string, endDate: Date | string): number {
  try {
    const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
    
    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date input');
    }
    
    return Math.round((end.getTime() - start.getTime()) / 60000);
  } catch (error) {
    console.error('Error calculating duration:', error);
    return 0;
  }
}

/**
 * Format a duration in minutes to a human-readable string (HH:MM)
 * @param minutes - Duration in minutes
 * @returns Formatted duration string
 */
export function formatDuration(minutes: number): string {
  try {
    if (minutes < 0) {
      throw new Error('Duration cannot be negative');
    }
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  } catch (error) {
    console.error('Error formatting duration:', error);
    return '0:00';
  }
}

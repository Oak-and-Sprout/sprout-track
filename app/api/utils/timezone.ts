/**
 * Server-side timezone utilities
 * These functions handle conversion between UTC and local time for database operations
 */

import prisma from '../db';

/**
 * Get the server's timezone settings from the database
 * @returns The server's timezone settings object containing the timezone
 */
export async function getSettings() {
  let settings = await prisma.settings.findFirst();
  if (!settings) {
    settings = await prisma.settings.create({
      data: {
        timezone: 'America/Chicago', // Default timezone
      },
    });
  }
  return settings;
}

/**
 * Convert a date string or Date object to UTC for storage in the database
 * This function creates a new Date object which is already in UTC internally
 * @param dateInput - Date string or Date object to convert
 * @returns Date object in UTC
 */
export function toUTC(dateInput: string | Date): Date {
  try {
    // If it's already a Date object, create a new one to avoid mutation
    const date = typeof dateInput === 'string' ? new Date(dateInput) : new Date(dateInput);
    
    // Validate the date
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date input');
    }
    
    return date;
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

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  DateFormatSetting,
  TimeFormatSetting,
  formatTimeDisplay,
  formatDateLong,
  formatDateTimeDisplay as formatDateTimeUtil,
} from '@/src/utils/dateFormat';

/**
 * Interface for the timezone context
 */
interface TimezoneContextType {
  /**
   * Whether the timezone context is still initializing
   */
  isLoading: boolean;
  
  /**
   * The user's detected timezone (e.g., 'America/Denver')
   */
  userTimezone: string;
  
  /**
   * Whether DST is currently active in the user's timezone
   */
  isDST: boolean;
  
  /**
   * Format an ISO date string in the user's timezone with specified format options
   */
  formatDate: (isoString: string | null | undefined, formatOptions?: Intl.DateTimeFormatOptions) => string;
  
  /**
   * Format a time-only representation of an ISO date string in the user's timezone
   */
  formatTime: (isoString: string | null | undefined) => string;
  
  /**
   * Format a date-only representation of an ISO date string in the user's timezone
   */
  formatDateOnly: (isoString: string | null | undefined) => string;
  
  /**
   * Format a date and time representation of an ISO date string in the user's timezone
   */
  formatDateTime: (isoString: string | null | undefined) => string;
  
  /**
   * Calculate the duration between two ISO date strings in minutes
   */
  calculateDurationMinutes: (startIsoString: string | null | undefined, endIsoString: string | null | undefined) => number;
  
  /**
   * Format a duration in minutes to a human-readable string (HH:MM)
   */
  formatDuration: (minutes: number) => string;
  
  /**
   * Check if a date is today in the user's timezone
   */
  isToday: (isoString: string | null | undefined) => boolean;
  
  /**
   * Check if a date is yesterday in the user's timezone
   */
  isYesterday: (isoString: string | null | undefined) => boolean;
  
  /**
   * Check if a date is in DST for a specific timezone
   */
  isDaylightSavingTime: (date: Date, timezone: string) => boolean;
  
  /**
   * Get timezone information for debugging
   */
  getTimezoneInfo: () => { 
    userTimezone: string;
    currentTime: string;
    currentOffset: number;
    isDST: boolean;
    isMobile: boolean;
    isLoading: boolean;
  };
  
  /**
   * Convert a UTC ISO string to a Date object in the user's local timezone
   */
  toLocalDate: (isoString: string | null | undefined) => Date | null;
  
  /**
   * Convert a local Date object to a UTC ISO string for storage in the database
   */
  toUTCString: (date: Date | null | undefined) => string | null;
  
  /**
   * Get the current date and time as a UTC ISO string
   */
  getCurrentUTCString: () => string;
  
  /**
   * Force refresh the timezone information
   */
  refreshTimezone: () => void;

  /**
   * The family's preferred date format setting
   */
  dateFormat: DateFormatSetting;

  /**
   * The family's preferred time format setting
   */
  timeFormat: TimeFormatSetting;

  /**
   * Update the date and time format settings (called from settings UI for immediate update)
   */
  setDateTimeFormats: (dateFormat: DateFormatSetting, timeFormat: TimeFormatSetting) => void;
}

const TimezoneContext = createContext<TimezoneContextType | undefined>(undefined);

/**
 * Provider component for timezone context
 */
export function TimezoneProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userTimezone, setUserTimezone] = useState<string>('UTC');
  const [isDST, setIsDST] = useState<boolean>(false);
  const [dateFormat, setDateFormat] = useState<DateFormatSetting>('MM/DD/YYYY');
  const [timeFormat, setTimeFormat] = useState<TimeFormatSetting>('12h');

  /**
   * Detect and set the user's timezone and DST status
   */
  const detectTimezone = useCallback(() => {
    setIsLoading(true);
    console.log('Detecting timezone...');
    
    try {
      // Detect timezone synchronously if possible
      const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      // Check if DST is active
      const now = new Date();
      const isDSTActive = isDaylightSavingTime(now, detectedTimezone);
      
      console.log(`Detected timezone: ${detectedTimezone}, DST active: ${isDSTActive}`);
      console.log(`Current time: ${now.toISOString()}, Offset: ${now.getTimezoneOffset()}`);
      
      // Update state
      setUserTimezone(detectedTimezone);
      setIsDST(isDSTActive);
      setIsLoading(false);
    } catch (error) {
      console.error('Error detecting timezone:', error);
      // Fallback to UTC
      setUserTimezone('UTC');
      setIsDST(false);
      setIsLoading(false);
    }
  }, []);

  // Initialize timezone detection on mount
  useEffect(() => {
    detectTimezone();
  }, [detectTimezone]);
  
  // Fetch date/time format settings from the API
  useEffect(() => {
    const fetchFormatSettings = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
        if (!token) return;

        const response = await fetch('/api/settings', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) return;

        const result = await response.json();
        if (result.success && result.data) {
          if (result.data.dateFormat) setDateFormat(result.data.dateFormat);
          if (result.data.timeFormat) setTimeFormat(result.data.timeFormat);
        }
      } catch (error) {
        console.error('Error fetching date/time format settings:', error);
      }
    };
    fetchFormatSettings();
  }, []);

  /**
   * Update the date and time format settings immediately (called from settings UI)
   */
  const setDateTimeFormats = useCallback((newDateFormat: DateFormatSetting, newTimeFormat: TimeFormatSetting) => {
    setDateFormat(newDateFormat);
    setTimeFormat(newTimeFormat);
  }, []);

  // Refresh timezone when window gains focus (in case user changed system timezone)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleFocus = () => {
        console.log('Window focused, refreshing timezone');
        detectTimezone();
      };
      
      window.addEventListener('focus', handleFocus);
      return () => window.removeEventListener('focus', handleFocus);
    }
  }, [detectTimezone]);
  
  /**
   * Check if a date is in DST for a specific timezone
   */
  const isDaylightSavingTime = (date: Date, timezone: string): boolean => {
    try {
      // Format the date with the timezone name
      const formatted = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'long'
      }).format(date);
      
      // Check if the timezone name includes "Daylight" or "Summer"
      return formatted.includes('Daylight') || formatted.includes('Summer');
    } catch (error) {
      console.error('Error checking DST:', error);
      return false;
    }
  };

  /**
   * Format an ISO date string in the user's timezone with specified format options
   */
  const formatDate = (
    isoString: string | null | undefined,
    formatOptions?: Intl.DateTimeFormatOptions
  ): string => {
    // Apply format-aware defaults when no explicit options are passed
    const options: Intl.DateTimeFormatOptions = formatOptions ?? {
      hour: 'numeric',
      minute: '2-digit',
      hour12: timeFormat === '12h',
    };
    // If caller provided options with hour but not hour12, apply the setting
    if (formatOptions && 'hour' in formatOptions && formatOptions.hour12 === undefined) {
      options.hour12 = timeFormat === '12h';
    }
    if (!isoString) return '';
    
    try {
      // Ensure we're working with a proper ISO string
      // This helps with dates that might not be properly stored in UTC
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '';
      
      // Check if the date should be in DST
      const dateIsDST = isDaylightSavingTime(date, userTimezone);
      
      // Use the Intl.DateTimeFormat API which properly handles DST
      const formatter = new Intl.DateTimeFormat('en-US', {
        ...options,
        timeZone: userTimezone
      });
      
      const formattedDate = formatter.format(date);
      
      // Log for debugging
      if (process.env.NODE_ENV === 'development') {
        console.debug(`Formatting date: ${isoString}, DST: ${dateIsDST}, Result: ${formattedDate}`);
      }
      
      return formattedDate;
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  };

  /**
   * Format a time-only representation of an ISO date string in the user's timezone
   */
  const formatTime = (isoString: string | null | undefined): string => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '';
      return formatTimeDisplay(date, timeFormat, userTimezone);
    } catch {
      return '';
    }
  };

  /**
   * Format a date-only representation of an ISO date string in the user's timezone
   */
  const formatDateOnly = (isoString: string | null | undefined): string => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '';
      return formatDateLong(date, dateFormat, userTimezone);
    } catch {
      return '';
    }
  };

  /**
   * Format a date and time representation of an ISO date string in the user's timezone
   */
  const formatDateTime = (isoString: string | null | undefined): string => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '';
      return formatDateTimeUtil(date, dateFormat, timeFormat, userTimezone);
    } catch {
      return '';
    }
  };

  /**
   * Calculate the duration between two ISO date strings in minutes
   * Uses epoch time difference which automatically handles DST transitions
   */
  const calculateDurationMinutes = (
    startIsoString: string | null | undefined, 
    endIsoString: string | null | undefined
  ): number => {
    if (!startIsoString || !endIsoString) return 0;
    
    try {
      const startDate = new Date(startIsoString);
      const endDate = new Date(endIsoString);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return 0;
      }
      
      // Calculate duration in minutes using epoch timestamps
      // This approach correctly handles DST transitions automatically
      const diffMs = endDate.getTime() - startDate.getTime();
      return Math.floor(diffMs / 60000);
    } catch (error) {
      console.error('Error calculating duration:', error);
      return 0;
    }
  };

  /**
   * Format a duration in minutes to a human-readable string (HH:MM)
   */
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };

  /**
   * Check if a date is today in the user's timezone
   */
  const isToday = (isoString: string | null | undefined): boolean => {
    if (!isoString) return false;
    
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return false;
      
      const today = new Date();
      
      // Create a formatter that only includes date components (not time)
      const formatter = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        timeZone: userTimezone
      });
      
      // Compare the formatted dates
      return formatter.format(date) === formatter.format(today);
    } catch (error) {
      console.error('Error checking if date is today:', error);
      return false;
    }
  };

  /**
   * Check if a date is yesterday in the user's timezone
   */
  const isYesterday = (isoString: string | null | undefined): boolean => {
    if (!isoString) return false;
    
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return false;
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      // Create a formatter that only includes date components (not time)
      const formatter = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        timeZone: userTimezone
      });
      
      // Compare the formatted dates
      return formatter.format(date) === formatter.format(yesterday);
    } catch (error) {
      console.error('Error checking if date is yesterday:', error);
      return false;
    }
  };

  /**
   * Get timezone information for debugging
   */
  const getTimezoneInfo = () => {
    const now = new Date();
    const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const currentDST = isDaylightSavingTime(now, userTimezone);
    
    return {
      userTimezone,
      currentTime: now.toISOString(),
      currentOffset: now.getTimezoneOffset(),
      isDST: currentDST,
      isMobile,
      isLoading
    };
  };
  
  /**
   * Force refresh the timezone information
   */
  const refreshTimezone = () => {
    console.log('Manually refreshing timezone');
    detectTimezone();
  };
  
  /**
   * Convert a UTC ISO string to a Date object in the user's local timezone
   * Useful for working with dates from the database (which are stored in UTC)
   */
  const toLocalDate = (isoString: string | null | undefined): Date | null => {
    if (!isoString) return null;
    
    try {
      // Create a date from the ISO string (which is in UTC)
      const utcDate = new Date(isoString);
      if (isNaN(utcDate.getTime())) return null;
      
      // Create a formatter for the user's timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: userTimezone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false
      });
      
      // Get the parts of the formatted date
      const parts = formatter.formatToParts(utcDate);
      
      // Extract the components
      const year = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
      const month = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10) - 1;
      const day = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);
      const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
      const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
      const second = parseInt(parts.find(p => p.type === 'second')?.value || '0', 10);
      
      // Create a date object with these components in local time
      const localDate = new Date(year, month, day, hour, minute, second);
      
      // Log for debugging
      if (process.env.NODE_ENV === 'development') {
        console.debug(`Converting UTC date: ${isoString} to local: ${localDate.toISOString()}`);
        console.debug(`DST active for this date: ${isDaylightSavingTime(utcDate, userTimezone)}`);
      }
      
      return localDate;
    } catch (error) {
      console.error('Error converting to local date:', error);
      return null;
    }
  };
  
  /**
   * Convert a local Date object to a UTC ISO string for storage in the database
   */
  const toUTCString = (date: Date | null | undefined): string | null => {
    if (!date) return null;
    
    try {
      if (isNaN(date.getTime())) return null;
      return date.toISOString();
    } catch (error) {
      console.error('Error converting to UTC string:', error);
      return null;
    }
  };
  
  /**
   * Get the current date and time as a UTC ISO string
   */
  const getCurrentUTCString = (): string => {
    return new Date().toISOString();
  };

  return (
    <TimezoneContext.Provider value={{
      isLoading,
      userTimezone,
      isDST,
      formatDate,
      formatTime,
      formatDateOnly,
      formatDateTime,
      calculateDurationMinutes,
      formatDuration,
      isToday,
      isYesterday,
      isDaylightSavingTime,
      getTimezoneInfo,
      toLocalDate,
      toUTCString,
      getCurrentUTCString,
      refreshTimezone,
      dateFormat,
      timeFormat,
      setDateTimeFormats
    }}>
      {children}
    </TimezoneContext.Provider>
  );
}

/**
 * Hook to use the timezone context
 */
export function useTimezone() {
  const context = useContext(TimezoneContext);
  if (context === undefined) {
    throw new Error('useTimezone must be used within a TimezoneProvider');
  }
  return context;
}

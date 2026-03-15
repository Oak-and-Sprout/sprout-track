# Timezone Implementation Guide

This guide provides detailed implementation instructions for the timezone refactoring plan. It includes code examples and specific changes required for each phase.

## Phase 1: Server-Side Standardization

### 1.1 Update Server-Side Timezone Utilities

#### Updated `app/api/utils/timezone.ts`:

```typescript
/**
 * Server-side timezone utilities
 * These functions handle conversion between UTC and local time for database operations
 */

import prisma from '../db';

/**
 * Get the server's timezone settings from the database
 * @returns The server's timezone settings
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
```

### 1.2 Standardize API Date Handling

#### Example update for `feed-log/route.ts`:

```typescript
import { toUTC, formatForResponse } from '../utils/timezone';

async function handlePost(req: NextRequest, authContext: AuthResult) {
  try {
    const body: FeedLogCreate = await req.json();
    
    // Convert time to UTC for storage
    const timeUTC = toUTC(body.time);
    
    // Process startTime, endTime if provided
    const data = {
      ...body,
      time: timeUTC,
      caretakerId: authContext.caretakerId,
      ...(body.startTime && { startTime: toUTC(body.startTime) }),
      ...(body.endTime && { endTime: toUTC(body.endTime) }),
      ...(body.feedDuration !== undefined && { feedDuration: body.feedDuration }),
    };
    
    const feedLog = await prisma.feedLog.create({
      data,
    });

    // Format dates as ISO strings for response
    const response: FeedLogResponse = {
      ...feedLog,
      time: formatForResponse(feedLog.time),
      startTime: formatForResponse(feedLog.startTime),
      endTime: formatForResponse(feedLog.endTime),
      createdAt: formatForResponse(feedLog.createdAt),
      updatedAt: formatForResponse(feedLog.updatedAt),
      deletedAt: formatForResponse(feedLog.deletedAt),
    };

    return NextResponse.json<ApiResponse<FeedLogResponse>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error creating feed log:', error);
    return NextResponse.json<ApiResponse<FeedLogResponse>>(
      {
        success: false,
        error: 'Failed to create feed log',
      },
      { status: 500 }
    );
  }
}
```

#### Example update for `sleep-log/route.ts`:

```typescript
import { toUTC, formatForResponse, calculateDurationMinutes } from '../utils/timezone';

async function handlePost(req: NextRequest, authContext: AuthResult) {
  try {
    const body: SleepLogCreate = await req.json();
    
    // Convert times to UTC for storage
    const startTimeUTC = toUTC(body.startTime);
    const endTimeUTC = body.endTime ? toUTC(body.endTime) : null;
    
    // Calculate duration if both start and end times are present
    const duration = endTimeUTC ? calculateDurationMinutes(startTimeUTC, endTimeUTC) : undefined;

    const sleepLog = await prisma.sleepLog.create({
      data: {
        ...body,
        startTime: startTimeUTC,
        ...(endTimeUTC && { endTime: endTimeUTC }),
        duration,
        caretakerId: authContext.caretakerId,
      },
    });

    // Format dates as ISO strings for response
    const response: SleepLogResponse = {
      ...sleepLog,
      startTime: formatForResponse(sleepLog.startTime),
      endTime: formatForResponse(sleepLog.endTime),
      createdAt: formatForResponse(sleepLog.createdAt),
      updatedAt: formatForResponse(sleepLog.updatedAt),
      deletedAt: formatForResponse(sleepLog.deletedAt),
    };

    return NextResponse.json<ApiResponse<SleepLogResponse>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error creating sleep log:', error);
    return NextResponse.json<ApiResponse<SleepLogResponse>>(
      {
        success: false,
        error: 'Failed to create sleep log',
      },
      { status: 500 }
    );
  }
}
```

### 1.3 Simplify API Endpoints

#### Updated `app/api/timezone/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSettings } from '../utils/timezone';
import { ApiResponse } from '../types';

export async function GET(req: NextRequest) {
  try {
    // Get server timezone settings
    const settings = await getSettings();
    
    return NextResponse.json<ApiResponse<{ 
      serverTimezone: string,
      serverTime: string
    }>>({
      success: true,
      data: { 
        serverTimezone: settings.timezone,
        serverTime: new Date().toISOString()
      },
    });
  } catch (error) {
    console.error('Error getting timezone information:', error);
    return NextResponse.json<ApiResponse<any>>({
      success: false,
      error: 'Failed to get timezone information',
    }, { status: 500 });
  }
}
```

## Phase 2: Client-Side Enhancement

### 2.1 Enhance Timezone Context

#### Updated `app/context/timezone.tsx`:

```typescript
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface TimezoneContextType {
  userTimezone: string;
  formatDate: (dateString: string, formatOptions?: Intl.DateTimeFormatOptions) => string;
  formatTime: (dateString: string) => string;
  formatDateOnly: (dateString: string) => string;
  formatDateTime: (dateString: string) => string;
  getMinutesBetweenDates: (startDate: Date | string, endDate: Date | string) => number;
  formatDuration: (minutes: number) => string;
  getTimezoneInfo: () => { 
    userTimezone: string; 
    currentTime: string;
    currentOffset: number;
  };
}

const TimezoneContext = createContext<TimezoneContextType | undefined>(undefined);

export function TimezoneProvider({ children }: { children: ReactNode }) {
  const [userTimezone, setUserTimezone] = useState<string>('UTC');

  useEffect(() => {
    // Detect user's timezone from browser
    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setUserTimezone(detectedTimezone);
  }, []);

  // Format a date in user's timezone with specified format
  const formatDate = (
    dateString: string, 
    formatOptions: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }
  ): string => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      
      return date.toLocaleString('en-US', {
        ...formatOptions,
        timeZone: userTimezone
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  };
  
  // Format time only
  const formatTime = (dateString: string): string => {
    return formatDate(dateString, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };
  
  // Format date only
  const formatDateOnly = (dateString: string): string => {
    return formatDate(dateString, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };
  
  // Format date and time
  const formatDateTime = (dateString: string): string => {
    return formatDate(dateString, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };
  
  // Calculate minutes between dates accounting for DST
  const getMinutesBetweenDates = (startDate: Date | string, endDate: Date | string): number => {
    try {
      const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
      const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error('Invalid date input');
      }
      
      return Math.floor((end.getTime() - start.getTime()) / 60000);
    } catch (error) {
      console.error('Error calculating minutes between dates:', error);
      return 0;
    }
  };
  
  // Format duration in minutes to HH:MM format
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };
  
  // Get timezone information for debugging
  const getTimezoneInfo = () => {
    const now = new Date();
    
    return {
      userTimezone,
      currentTime: now.toISOString(),
      currentOffset: now.getTimezoneOffset(),
    };
  };

  return (
    <TimezoneContext.Provider value={{
      userTimezone,
      formatDate,
      formatTime,
      formatDateOnly,
      formatDateTime,
      getMinutesBetweenDates,
      formatDuration,
      getTimezoneInfo
    }}>
      {children}
    </TimezoneContext.Provider>
  );
}

export function useTimezone() {
  const context = useContext(TimezoneContext);
  if (context === undefined) {
    throw new Error('useTimezone must be used within a TimezoneProvider');
  }
  return context;
}
```

### 2.2 Update Component Utilities

#### Updated `activity-tile-utils.ts`:

```typescript
import { ActivityType } from './activity-tile.types';
import { useTimezone } from '@/app/context/timezone';

/**
 * Gets the activity time from different activity types
 */
export const getActivityTime = (activity: ActivityType): string => {
  if ('time' in activity && activity.time) {
    return activity.time;
  }
  if ('startTime' in activity && activity.startTime) {
    if ('duration' in activity && activity.endTime) {
      return String(activity.endTime);
    }
    return String(activity.startTime);
  }
  return new Date().toISOString();
};

/**
 * Determines the variant based on the activity type
 */
export const getActivityVariant = (activity: ActivityType): 'sleep' | 'feed' | 'diaper' | 'note' | 'bath' | 'pump' | 'default' => {
  if ('type' in activity) {
    if ('duration' in activity) return 'sleep';
    if ('amount' in activity) return 'feed';
    if ('condition' in activity) return 'diaper';
    if ('soapUsed' in activity || 'shampooUsed' in activity) return 'bath';
  }
  if ('leftAmount' in activity || 'rightAmount' in activity) return 'pump';
  if ('content' in activity) return 'note';
  return 'default';
};

/**
 * Generates a description for the activity
 * Uses the timezone context for all date formatting
 */
export const getActivityDescription = (activity: ActivityType) => {
  // Use the timezone context for formatting
  const { formatTime, formatDateTime, formatDuration } = useTimezone();
  
  if ('type' in activity) {
    if ('duration' in activity) {
      const startTimeFormatted = activity.startTime ? formatDateTime(activity.startTime) : 'unknown';
      const endTimeFormatted = activity.endTime ? formatTime(activity.endTime) : 'ongoing';
      const duration = activity.duration ? ` ${formatDuration(activity.duration)}` : '';
      const location = activity.location === 'OTHER' ? 'Other' : activity.location?.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
      return {
        type: `${activity.type === 'NAP' ? 'Nap' : 'Night Sleep'}${location ? ` - ${location}` : ''}`,
        details: `${startTimeFormatted} - ${endTimeFormatted}${duration}`
      };
    }
    
    // Rest of implementation remains similar but uses the context functions
    // ...
  }
  
  return {
    type: 'Activity',
    details: 'logged'
  };
};
```

## Phase 3: Component Updates

### 3.1 Update UI Components

#### Example update for `status-bubble/index.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import { Moon, Sun, Icon } from 'lucide-react';
import { diaper, bottleBaby } from '@lucide/lab';
import { cn } from "@/src/lib/utils";
import { statusBubbleStyles as styles } from './status-bubble.styles';
import { StatusBubbleProps, StatusStyle } from './status-bubble.types';
import { useTimezone } from '@/app/context/timezone';

/**
 * Converts warning time (hh:mm) to minutes
 */
const getWarningMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * A component that displays the current status and duration in a stylized bubble
 */
export function StatusBubble({ 
  status, 
  durationInMinutes, 
  warningTime, 
  className,
  startTime // Add startTime prop
}: StatusBubbleProps & { startTime?: string }) {
  const { getMinutesBetweenDates, formatDuration } = useTimezone();
  const [calculatedDuration, setCalculatedDuration] = useState(durationInMinutes);
  
  // If startTime is provided, calculate duration based on current time
  useEffect(() => {
    if (startTime) {
      const updateDuration = () => {
        try {
          // Use the getMinutesBetweenDates function from the timezone context
          const now = new Date();
          const diffMinutes = getMinutesBetweenDates(startTime, now);
          
          setCalculatedDuration(diffMinutes);
        } catch (error) {
          console.error('Error calculating duration:', error);
          // Fallback to the provided duration if calculation fails
          setCalculatedDuration(durationInMinutes);
        }
      };
      
      // Update immediately
      updateDuration();
      
      // Then update every minute
      const interval = setInterval(updateDuration, 60000);
      return () => clearInterval(interval);
    }
  }, [startTime, durationInMinutes, getMinutesBetweenDates]);
  
  // Use calculated duration if available, otherwise use prop
  const displayDuration = startTime ? calculatedDuration : durationInMinutes;
  
  // Check if duration exceeds warning time
  const isWarning = warningTime && displayDuration >= getWarningMinutes(warningTime);

  // Get status-specific styles and icon
  const getStatusStyles = (): StatusStyle => {
    switch (status) {
      case 'sleeping':
        return {
          bgColor: styles.statusStyles.sleeping.bgColor,
          icon: <Moon className={styles.icon} />
        };
      case 'awake':
        return {
          bgColor: styles.statusStyles.awake.bgColor,
          icon: <Sun className={cn(styles.icon, styles.statusStyles.awake.iconColor)} />
        };
      case 'feed':
        return {
          bgColor: isWarning ? styles.statusStyles.feed.warning : styles.statusStyles.feed.normal,
          icon: <Icon iconNode={bottleBaby} className={styles.icon} />
        };
      case 'diaper':
        return {
          bgColor: isWarning ? styles.statusStyles.diaper.warning : styles.statusStyles.diaper.normal,
          icon: <Icon iconNode={diaper} className={styles.icon} />
        };
      default:
        return {
          bgColor: styles.statusStyles.default.bgColor,
          icon: null
        };
    }
  };

  const { bgColor, icon } = getStatusStyles();

  return (
    <div
      className={cn(
        styles.base,
        bgColor,
        className
      )}
    >
      {icon}
      <span>{formatDuration(displayDuration)}</span>
    </div>
  );
}
```

### 3.2 Update Form Components

#### Example update for `FeedForm/index.tsx`:

```typescript
// Inside the FeedForm component
import { useTimezone } from '@/app/context/timezone';

export default function FeedForm({
  isOpen,
  onClose,
  babyId,
  initialTime,
  activity,
  onSuccess,
}: FeedFormProps) {
  const { formatDate } = useTimezone();
  
  // Format date string to be compatible with datetime-local input
  const formatDateForInput = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    
    // Format as YYYY-MM-DDThh:mm in local time
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };
  
  // Rest of component implementation
  // ...
}
```

## Phase 4: Testing and Documentation

### 4.1 Testing

Create test cases for timezone handling:

```typescript
// Example test for timezone utilities
import { toUTC, formatForResponse, calculateDurationMinutes } from '../app/api/utils/timezone';

describe('Timezone Utilities', () => {
  test('toUTC converts date string to UTC Date', () => {
    const dateStr = '2025-03-15T14:30:00.000Z';
    const result = toUTC(dateStr);
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe(dateStr);
  });
  
  test('formatForResponse returns ISO string', () => {
    const date = new Date('2025-03-15T14:30:00.000Z');
    const result = formatForResponse(date);
    expect(result).toBe('2025-03-15T14:30:00.000Z');
  });
  
  test('calculateDurationMinutes returns correct duration', () => {
    const start = new Date('2025-03-15T14:30:00.000Z');
    const end = new Date('2025-03-15T15:45:00.000Z');
    const result = calculateDurationMinutes(start, end);
    expect(result).toBe(75); // 1 hour and 15 minutes = 75 minutes
  });
});
```

### 4.2 Documentation

#### Updated `app/api/utils/timezone.README.md`:

```markdown
# Server-Side Timezone Utilities

This module provides utilities for handling timezone conversions and date formatting on the server side.

## Core Functions

### `toUTC(dateInput: string | Date): Date`

Converts a date string or Date object to UTC for storage in the database.

```typescript
import { toUTC } from '../utils/timezone';

// Convert a date string to UTC
const utcDate = toUTC('2025-03-15T14:30:00');

// Store in database
await prisma.feedLog.create({
  data: {
    time: utcDate,
    // other fields...
  }
});
```

### `formatForResponse(date: Date | string | null): string | null`

Formats a date for API responses in ISO format.

```typescript
import { formatForResponse } from '../utils/timezone';

// Format a date for API response
const response = {
  ...feedLog,
  time: formatForResponse(feedLog.time),
  // other fields...
};
```

### `calculateDurationMinutes(startDate: Date | string, endDate: Date | string): number`

Calculates the duration between two dates in minutes.

```typescript
import { calculateDurationMinutes } from '../utils/timezone';

// Calculate duration between start and end time
const duration = calculateDurationMinutes(startTime, endTime);
```

## Best Practices

1. Always store dates in UTC format in the database
2. Use ISO strings for date serialization in API responses
3. Use the timezone utilities for all date operations
4. Handle timezone conversions on the client side for display
```

## Phase 5: Migration and Cleanup

### 5.1 Data Migration

Create a migration script to convert existing dates to UTC:

```typescript
// scripts/migrate-dates-to-utc.ts
import { PrismaClient } from '@prisma/client';
import { toUTC } from '../app/api/utils/timezone';

const prisma = new PrismaClient();

async function migrateDatesToUTC() {
  console.log('Starting date migration to UTC...');
  
  // Migrate feed logs
  const feedLogs = await prisma.feedLog.findMany();
  console.log(`Found ${feedLogs.length} feed logs to migrate`);
  
  for (const log of feedLogs) {
    await prisma.feedLog.update({
      where: { id: log.id },
      data: {
        time: toUTC(log.time),
        ...(log.startTime && { startTime: toUTC(log.startTime) }),
        ...(log.endTime && { endTime: toUTC(log.endTime) }),
      },
    });
  }
  
  // Migrate sleep logs
  const sleepLogs = await prisma.sleepLog.findMany();
  console.log(`Found ${sleepLogs.length} sleep logs to migrate`);
  
  for (const log of sleepLogs) {
    await prisma.sleepLog.update({
      where: { id: log.id },
      data: {
        startTime: toUTC(log.startTime),
        ...(log.endTime && { endTime: toUTC(log.endTime) }),
      },
    });
  }
  
  // Migrate other log types
  // ...
  
  console.log('Migration completed successfully');
}

migrateDatesToUTC()
  .catch(e => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### 5.2 Cleanup

Remove redundant code and files:

1. Remove `app/api/timezone/route.ts` if no longer needed
2. Remove timezone-specific functions from components
3. Update imports to use the new timezone utilities

## Conclusion

This implementation guide provides a detailed roadmap for refactoring the timezone handling in the baby tracker application. By following these steps, you'll create a more maintainable, consistent, and reliable system for handling dates and times across the application.

Remember to test thoroughly at each step, especially with users in different timezones, to ensure the changes work as expected.

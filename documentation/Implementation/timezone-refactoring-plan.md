# Timezone Handling Refactoring Plan

## Current Issues

The baby tracker application currently has several issues with timezone handling:

1. **Redundant Functionality**:
   - `app/context/timezone.tsx` provides client-side timezone utilities
   - `app/api/timezone/route.ts` offers API endpoints for timezone operations
   - `app/api/utils/timezone.ts` contains server-side timezone utilities
   - Components like `activity-tile-utils.ts` implement their own time formatting

2. **Inconsistent Usage**:
   - Some components use the timezone context directly
   - Others pass timezone as props
   - Some implement their own formatting logic
   - This creates inconsistency in how times are displayed

3. **Inconsistent Date Storage**:
   - In `feed-log/route.ts`, dates are stored as local time with `const localTime = new Date(body.time)`
   - Similarly in `sleep-log/route.ts`, dates are stored as local time with `const startTime = new Date(body.startTime)`
   - This is problematic because it doesn't properly account for timezone differences

4. **Incorrect Date Serialization**:
   - APIs use `toLocaleString()` when returning dates in responses
   - This converts dates to strings using the server's locale, not the client's
   - This creates inconsistency when clients are in different timezones

5. **Manual Duration Calculations**:
   - Sleep duration is calculated with `Math.round((endTime.getTime() - startTime.getTime()) / 60000)`
   - This doesn't account for DST changes that might occur between start and end times

## Proposed Solution

We will implement a standardized approach to timezone handling with a clear separation of concerns:

1. **Single Source of Truth**:
   - One timezone context provider that handles all client-side timezone needs
   - One server-side utility for API operations

2. **Clear Separation of Concerns**:
   - Server: Always store dates in UTC
   - Client: Convert to local timezone for display

3. **Simplified API**:
   - Provide a small set of well-named utility functions that handle common operations
   - Make these functions available through the context

## Implementation Checklist

### Phase 1: Server-Side Standardization

- [x] **1.1 Update Server-Side Timezone Utilities**
  - [x] Refactor `app/api/utils/timezone.ts` to focus on core UTC conversion functions
  - [x] Add comprehensive JSDoc comments for all functions
  - [x] Implement proper error handling for all functions
  - [ ] Add unit tests for timezone utilities

- [x] **1.2 Standardize API Date Handling**
  - [x] Update `feed-log/route.ts` to store dates in UTC
  - [x] Update `sleep-log/route.ts` to store dates in UTC
  - [x] Update all other API routes that handle dates:
    - [x] `diaper-log/route.ts`
    - [x] `note/route.ts`
    - [x] `bath-log/route.ts`
    - [x] `pump-log/route.ts`
    - [x] `timeline/route.ts`
    - [x] `baby/route.ts`
  - [x] Standardize response format to use ISO strings for dates

- [x] **1.3 Simplify API Endpoints**
  - [x] Remove `app/api/timezone/route.ts` as it is replaced by the server-side utilities

### Phase 2: Client-Side Enhancement

- [x] **2.1 Enhance Timezone Context**
  - [x] Update `app/context/timezone.tsx` with comprehensive formatting functions
  - [x] Implement proper DST handling
  - [x] Add functions for common operations (format date, calculate duration, etc.)
  - [ ] Add unit tests for timezone context

- [x] **2.2 Update Component Utilities**
  - [x] Refactor `src/components/ui/activity-tile/activity-tile-utils.ts` to use timezone context
  - [x] Remove redundant timezone handling in components
  - [ ] Ensure consistent time display across the app

### Phase 3: Component Updates

- [x] **3.1 Update UI Components**
  - [x] Update `src/components/ui/status-bubble/index.tsx` to use timezone context
  - [ ] Update `src/components/ActivityTileGroup/index.tsx` to use timezone context
  - [x] Update `src/components/ui/activity-tile/index.tsx` to use timezone context
  - [x] Update `src/components/ui/activity-tile/activity-tile-content.tsx` to use timezone context
  - [x] Update `src/components/debugTimezone/index.tsx` to:
    - [x] Fetch server timezone from settings API
    - [x] Only show in development mode

- [x] **3.2 Update Form Components**
  - [x] Update `src/components/forms/FeedForm/index.tsx` to use timezone context
  - [x] Update `src/components/forms/SleepForm/index.tsx` to use timezone context
  - [x] Update `src/components/forms/DiaperForm/index.tsx` to use timezone context
  - [x] Update `src/components/forms/BathForm/index.tsx` to use timezone context
  - [x] Update `src/components/forms/NoteForm/index.tsx` to use timezone context
  - [x] Update `src/components/forms/PumpForm/index.tsx` to use timezone context

### Phase 4: Testing and Documentation

- [x] **4.1 Documentation**
  - [x] Update `app/api/utils/timezone.README.md` with new architecture
  - [x] Update `app/context/timezone.README.md` with usage examples
  - [ ] Add inline documentation for all timezone-related functions

- [ ] **4.2 Testing**
  - [ ] Test timezone handling with users in different timezones
  - [ ] Test DST edge cases
  - [ ] Test date calculations across timezone boundaries

### Phase 5: Migration and Cleanup

- [ ] **5.1 Data Migration**
  - [ ] Create a migration script to convert existing dates to UTC
  - [ ] Test migration script with sample data
  - [ ] Run migration script on production data

- [ ] **5.2 Cleanup**
  - [x] Remove `app/api/timezone/route.ts` if no longer needed
  - [ ] Remove redundant timezone functions from components
  - [ ] Remove any unused imports or variables

## Current Status (March 20, 2025)

### Completed

1. **Server-Side Standardization**
   - ✅ Refactored `app/api/utils/timezone.ts` with new core functions:
     - `toUTC`: Converts dates to UTC for storage
     - `formatForResponse`: Formats dates as ISO strings for responses
     - `calculateDurationMinutes`: Calculates duration between dates
     - `formatDuration`: Formats duration in minutes to HH:MM format
   - ✅ Updated all API routes to store dates in UTC and use ISO strings for responses:
     - `feed-log/route.ts`
     - `sleep-log/route.ts`
     - `diaper-log/route.ts`
     - `note/route.ts`
     - `bath-log/route.ts`
     - `pump-log/route.ts`
     - `timeline/route.ts`
     - `baby/route.ts`
   - ✅ Removed redundant `app/api/timezone/route.ts` endpoint
   - ✅ Updated documentation in `app/api/utils/timezone.README.md`

2. **Client-Side Enhancement**
   - ✅ Updated `app/context/timezone.tsx` with comprehensive formatting functions:
     - `formatDate`: Formats an ISO date string with specified format options
     - `formatTime`: Formats a time-only representation
     - `formatDateOnly`: Formats a date-only representation
     - `formatDateTime`: Formats a date and time representation
     - `calculateDurationMinutes`: Calculates duration between dates
     - `formatDuration`: Formats duration in minutes to HH:MM format
     - `isToday`: Checks if a date is today
     - `isYesterday`: Checks if a date is yesterday
   - ✅ Updated documentation in `app/context/timezone.README.md`
   - ✅ Updated `src/components/ui/status-bubble/index.tsx` to use the new timezone context
   - ✅ Updated `src/components/ui/activity-tile/activity-tile-utils.ts` to use the new timezone context:
     - Created a new `useActivityDescription` hook that uses the timezone context
     - Maintained backward compatibility with a deprecated warning
   - ✅ Updated `src/components/ui/activity-tile/activity-tile-content.tsx` to use the new hook
   - ✅ Updated `src/components/ui/activity-tile/index.tsx` to remove the userTimezone prop
   - ✅ Updated `src/components/debugTimezone/index.tsx` to:
     - Fetch server timezone from settings API
     - Only show in development mode (similar to debugSessionTimer)

3. **Form Components**
   - ✅ Updated all form components to use the timezone context:
     - `src/components/forms/DiaperForm/index.tsx`
     - `src/components/forms/BathForm/index.tsx`
     - `src/components/forms/NoteForm/index.tsx`
     - `src/components/forms/PumpForm/index.tsx`
     - `src/components/forms/SleepForm/index.tsx`
     - `src/components/forms/FeedForm/index.tsx`
   - ✅ Improved form submissions to send ISO strings directly to the API
   - ✅ Updated duration calculations to use the timezone context's `calculateDurationMinutes` function

### In Progress

1. **Component Updates**
   - Next step: Update `src/components/ActivityTileGroup/index.tsx` to use timezone context

### Pending

1. **Testing and Validation**
   - Test timezone handling with users in different timezones
   - Test DST edge cases
   - Test date calculations across timezone boundaries

2. **Data Migration**
   - Create a migration script to convert existing dates to UTC if needed
   - Test and run migration script

## Expected Outcomes

After implementing this plan, we expect:

1. **Consistent Date Storage**: All dates will be stored in UTC format in the database
2. **Standardized API Responses**: All API responses will include dates in ISO format
3. **Simplified Component Code**: Components will use the timezone context for all date operations
4. **Improved User Experience**: Times will be correctly displayed in the user's timezone
5. **Better Maintainability**: Timezone logic will be centralized and easier to update
6. **Proper DST Handling**: The application will correctly handle Daylight Saving Time changes

## Success Criteria

The refactoring will be considered successful when:

1. All dates are stored in UTC in the database
2. All components use the timezone context for date formatting
3. Users in different timezones see correct times
4. DST changes are handled correctly
5. No redundant timezone code exists in components
6. All tests pass, including timezone-specific tests

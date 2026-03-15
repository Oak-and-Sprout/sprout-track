# Timezone Refactoring: File Changes

This document outlines the specific files that need to be modified as part of the timezone refactoring project, along with the changes required for each file.

## Files to Modify

### Server-Side Files

1. **`app/api/utils/timezone.ts`**
   - **Current state**: Contains a mix of server-side and client-side timezone utilities
   - **Required changes**:
     - Simplify to focus on core UTC conversion functions
     - Add proper error handling
     - Add comprehensive JSDoc comments
     - Remove client-specific functions

2. **`app/api/timezone/route.ts`**
   - **Current state**: Provides API endpoints for timezone operations and conversions
   - **Required changes**:
     - Simplify to only provide timezone information
     - Remove redundant conversion endpoints
     - Consider removing entirely if no longer needed

3. **API Route Files**:
   - **Files**:
     - `app/api/feed-log/route.ts`
     - `app/api/sleep-log/route.ts`
     - `app/api/diaper-log/route.ts`
     - `app/api/note/route.ts`
     - `app/api/bath-log/route.ts`
     - `app/api/pump-log/route.ts`
   - **Current state**: Store dates as local time and use `toLocaleString()` for responses
   - **Required changes**:
     - Update to store dates in UTC
     - Use ISO strings for date serialization in responses
     - Use the timezone utilities for all date operations

### Client-Side Files

1. **`app/context/timezone.tsx`**
   - **Current state**: Provides client-side timezone utilities but lacks comprehensive formatting functions
   - **Required changes**:
     - Enhance with comprehensive formatting functions
     - Add functions for common operations
     - Implement proper DST handling
     - Remove server-specific functions

2. **Component Utilities**:
   - **Files**:
     - `src/components/ui/activity-tile/activity-tile-utils.ts`
     - `src/components/Timeline/utils.tsx`
   - **Current state**: Implement their own timezone handling
   - **Required changes**:
     - Refactor to use timezone context
     - Remove redundant timezone handling

3. **UI Components**:
   - **Files**:
     - `src/components/ui/status-bubble/index.tsx`
     - `src/components/ActivityTileGroup/index.tsx`
     - `src/components/ui/activity-tile/index.tsx`
     - `src/components/ui/activity-tile/activity-tile-content.tsx`
   - **Current state**: Some use the timezone context, others implement their own logic
   - **Required changes**:
     - Update to consistently use timezone context
     - Remove local timezone handling

4. **Form Components**:
   - **Files**:
     - `src/components/forms/FeedForm/index.tsx`
     - `src/components/forms/SleepForm/index.tsx`
     - `src/components/forms/DiaperForm/index.tsx`
     - `src/components/forms/NoteForm/index.tsx`
     - `src/components/forms/BathForm/index.tsx`
     - `src/components/forms/PumpForm/index.tsx`
   - **Current state**: Handle dates inconsistently
   - **Required changes**:
     - Update to use timezone context for all date operations
     - Ensure consistent date handling across all forms

### Documentation Files

1. **`app/api/utils/timezone.README.md`**
   - **Current state**: May be outdated or incomplete
   - **Required changes**:
     - Update with new architecture
     - Document server-side timezone utilities
     - Add usage examples

2. **`app/context/timezone.README.md`**
   - **Current state**: May be outdated or incomplete
   - **Required changes**:
     - Update with new architecture
     - Document client-side timezone context
     - Add usage examples

## New Files to Create

1. **Migration Script**:
   - **Path**: `scripts/migrate-dates-to-utc.ts`
   - **Purpose**: Convert existing dates in the database to UTC
   - **Implementation**: Use the new timezone utilities to convert dates

## Files to Remove

1. **`app/api/timezone/route.ts`** (if no longer needed)
   - **Current state**: Provides API endpoints for timezone operations
   - **Reason for removal**: Redundant with client-side timezone detection

## Detailed Changes by Phase

### Phase 1: Server-Side Standardization

1. Update `app/api/utils/timezone.ts`
2. Update API route files to store dates in UTC
3. Simplify `app/api/timezone/route.ts`

### Phase 2: Client-Side Enhancement

1. Update `app/context/timezone.tsx`
2. Update component utilities to use timezone context

### Phase 3: Component Updates

1. Update UI components to use timezone context
2. Update form components to use timezone context

### Phase 4: Testing and Documentation

1. Create test cases for timezone handling
2. Update documentation files

### Phase 5: Migration and Cleanup

1. Create and run migration script
2. Remove redundant code and files

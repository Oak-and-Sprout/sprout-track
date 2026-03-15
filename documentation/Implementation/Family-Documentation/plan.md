# Multi-Family Support Implementation Plan

## Overview
This document outlines the implementation plan for adding multi-family support to the baby tracking application. The goal is to allow multiple families to use the application with separate URLs, babies, and caretakers.

## Phase 1: Database Schema Updates

### 1.1 Create Family Model
```prisma
model Family {
  id        String   @id @default(cuid())
  slug      String   @unique
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  isActive  Boolean  @default(true)
  
  // Relations
  babies           Baby[]
  caretakers       Caretaker[]
  settings         Settings[]
  sleepLogs        SleepLog[]
  feedLogs         FeedLog[]
  diaperLogs       DiaperLog[]
  moodLogs         MoodLog[]
  notes            Note[]
  milestones       Milestone[]
  pumpLogs         PumpLog[]
  playLogs         PlayLog[]
  bathLogs         BathLog[]
  measurements     Measurement[]
  medicines        Medicine[]
  medicineLogs     MedicineLog[]
  contacts         Contact[]
  calendarEvents   CalendarEvent[]
  units            Unit[]
  // All other relations should be included here
}
```

### 1.2 Update Existing Models
- Add `familyId` field to all models that store family-specific data:
  - **Entity models**: Baby, Caretaker, Medicine, Contact
  - **Activity logs**: SleepLog, FeedLog, DiaperLog, MoodLog, Note, Milestone, PumpLog, PlayLog, BathLog, Measurement, MedicineLog
  - **Configuration**: Settings, Unit (unless units should be shared across families)
  - **Events**: CalendarEvent
- Make `familyId` required for all these models
- Set up proper relations with the Family model
- Add indexes for better query performance on familyId fields
- Consider how junction tables (BabyEvent, CaretakerEvent, etc.) will handle family relationships

### 1.3 Example Model Update
```prisma
model Baby {
  id               String   @id @default(uuid())
  firstName        String
  lastName         String
  birthDate        DateTime
  gender           Gender?
  inactive         Boolean  @default(false)
  // Other fields...
  
  // Add family relation
  family           Family   @relation(fields: [familyId], references: [id])
  familyId         String
  
  // Existing relations...
  
  @@index([familyId])
  // Other indexes...
}
```

### 1.4 Migration Strategy
- Create migration script to:
  - Add Family model
  - Add familyId to all models
  - Create default family for existing users
  - Generate slugs for all families (based on family name)
  - Assign all existing data to default family
  - Ensure referential integrity across all tables
  - Handle edge cases where data might need to be split into multiple families

## Phase 2: Authentication & Authorization

### 2.1 Update Auth Flow
- Modify login to handle family selection
- Store selected familyId in session/token
- Update auth context to include family information
- Consider how users will be associated with multiple families (if applicable)

### 2.2 Family Membership
- Create a model for tracking family membership:
```prisma
model FamilyMember {
  family       Family    @relation(fields: [familyId], references: [id])
  familyId     String
  caretaker    Caretaker @relation(fields: [caretakerId], references: [id])
  caretakerId  String
  role         String    // e.g., "admin", "member"
  joinedAt     DateTime  @default(now())
  
  @@id([familyId, caretakerId])
  @@index([familyId])
  @@index([caretakerId])
}
```
- Define roles and permissions for family members
- Implement invitation and acceptance flow

### 2.3 Update Middleware
- Add family-based access control
- Verify user has access to requested family
- Automatically add familyId to all database queries
- Create utility functions that enforce family-based filtering
- Handle unauthorized access gracefully
- Consider implementing row-level security if your database supports it

## Phase 3: API Routes

### 3.1 Update Existing Endpoints
- Add family-based filtering to all GET endpoints
- Create middleware that automatically adds familyId to all queries
- Update input validation to include familyId
- Modify responses to be family-scoped
- Add proper error handling for family-related errors
- Ensure all database operations respect family boundaries

### 3.2 New API Endpoints
- `GET /api/families` - List all families for current user
- `POST /api/families` - Create new family
- `GET /api/families/[slug]` - Get family details
- `PATCH /api/families/[slug]` - Update family
- `DELETE /api/families/[slug]` - Delete family
- `POST /api/families/[slug]/invite` - Invite new members
- `POST /api/families/[slug]/leave` - Leave family

## Phase 4: Frontend Changes

### 4.1 App Layout
- Add family switcher in header
- Update navigation to include family slug in routes
- Add loading states

### 4.2 Routes
- Update all routes to include `[familySlug]` parameter
- Update all data-fetching to include family context
- Handle 404 for invalid family slugs

### 4.3 Settings
- Add family management section
- Allow editing family name and slug
- Show current family members
- Invite new members
- Leave family option

## Phase 5: Data Migration

### 5.1 Migration Script
- Create default family for existing users
- Generate slugs for all families
- Assign all existing data to default family
- Validate data integrity

### 5.2 Testing
- Test migration on staging with production data
- Create rollback plan
- Schedule maintenance window if needed

## Implementation Order

1. **Database Changes**
   - Add Family model
   - Add familyId to existing models
   - Create migration

2. **Auth & Middleware**
   - Update auth context
   - Add family-based access control

3. **API Updates**
   - Update read endpoints
   - Update write endpoints
   - Add family management endpoints

4. **Frontend Updates**
   - Update routing
   - Add family switcher
   - Update data fetching
   - Add family management UI

5. **Data Migration**
   - Test migration
   - Execute production migration
   - Verify data integrity

## Testing Strategy

1. **Unit Tests**
   - Test all new utility functions
   - Test API endpoints

2. **Integration Tests**
   - Test family-based access control
   - Test data isolation between families

3. **E2E Tests**
   - Test complete user flows
   - Test family management features

## Rollout Plan

1. Deploy to staging for testing
2. Test all critical paths
3. Deploy to production with feature flag
4. Enable for beta testers
5. Monitor for issues
6. Roll out to all users

## Future Enhancements

1. Advanced family member roles and permissions
2. Family activity feed
3. Family usage analytics
4. Additional family-specific settings
5. Family data export and import
6. Cross-family data sharing (for specific use cases)
7. Family templates for quick setup

## Risks & Mitigations

1. **Performance Impact**
   - Add proper indexing on all familyId fields
   - Monitor query performance with family filtering
   - Consider database sharding for very large deployments
   - Optimize queries that join across multiple tables

2. **Data Migration**
   - Backup before migration
   - Test migration thoroughly on a copy of production data
   - Create a rollback plan
   - Consider a phased migration approach for large datasets

3. **User Experience**
   - Provide clear feedback during family switching
   - Add loading states for all family-related operations
   - Handle errors gracefully with user-friendly messages
   - Ensure UI clearly indicates which family is currently active

4. **Data Isolation**
   - Regularly audit database queries to ensure proper family filtering
   - Implement automated tests that verify data isolation
   - Create monitoring for potential cross-family data leaks

# Account System Design for SaaS Transition

This document outlines the design for adding account-based authentication to support the transition to a SaaS model while preserving the existing PIN-based caretaker system.

## Overview

The account system introduces a new authentication layer that sits above the existing family structure, enabling:

1. **SaaS Account Management**: OAuth (Google, Apple, GitHub) and email/password accounts that own families
2. **Preserved PIN Access**: Existing caretaker PIN system remains unchanged
3. **Streamlined UX**: Account holders get seamless access without PIN entry
4. **Simple Billing Integration**: Clear ownership model for future billing
5. **Hybrid Authentication**: NextAuth.js for account holders, existing JWT/PIN system for caretakers

## Service Scenarios

This system is designed for a **fresh SaaS service** with the following user scenarios:

### Primary Scenario: New SaaS Users
- Users sign up with OAuth or email/password
- Immediate family creation with auto-generated PIN
- Progressive setup for baby information and caretaker invitations
- Account holders get enhanced permissions and billing access

### Secondary Scenario: Family Recovery (Future Feature)
- Account loss due to OAuth provider issues, separation, death, etc.
- Family ownership transfer process with verification
- Maintains data continuity while changing account ownership
- Documented for future implementation, not part of initial release

## System Architecture

### Core Principle: Account = Family Owner

The design follows a simple ownership model where one account owns one family, avoiding complex multi-tenancy issues while enabling SaaS features.

```
┌─────────────────────────────────────────────────────────────┐
│                    NEXTAUTH.JS v5                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   Apple     │ │   Google    │ │   GitHub    │           │
│  │    OAuth    │ │    OAuth    │ │    OAuth    │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Email/Password Auth                        │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  HYBRID AUTH SYSTEM                        │
│  - NextAuth Session Management                             │
│  - Account → Family Ownership                              │
│  - Integration with existing JWT system                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  EXISTING FAMILY SYSTEM                    │
│  - PIN-based Caretakers (unchanged)                        │
│  - All existing functionality preserved                    │
└─────────────────────────────────────────────────────────────┘
```

### Account Creation Flow (Hybrid Approach)

**New User Journey:**
```
1. User signs up via OAuth or email/password → NextAuth creates User record
2. Quick Family Creation form:
   - Family name (required)
   - Slug (auto-generated from name, editable)
   - System PIN (auto-generated, visible to user)
3. System creates:
   - Family record linked to account
   - Admin caretaker linked to account
   - Default settings with generated PIN
4. User immediately enters family dashboard
5. First login shows SimplifiedSetupWizard for:
   - Add first baby
   - Invite caretakers (optional)
   - Customize settings (optional)
```

**Benefits of This Approach:**
- **Immediate gratification**: User gets into the app quickly
- **Progressive disclosure**: Advanced setup when ready
- **PIN sharing**: Account holders can share family URL + PIN with others
- **Familiar flow**: Uses existing SetupWizard for detailed configuration

## Database Schema Changes

### 1. New Account Table

```prisma
model Account {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String   // bcrypt hashed
  verified  Boolean  @default(false)
  stripeId  String?  // Future billing integration
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // Relations
  family     Family?    @relation(fields: [familyId], references: [id])
  familyId   String?    @unique // One account owns one family
  caretaker  Caretaker? @relation(fields: [caretakerId], references: [id])
  caretakerId String?   @unique // Account linked to specific caretaker
  
  @@index([email])
}
```

### 2. Update Family Table

```prisma
model Family {
  // ... existing fields
  
  // Add account ownership
  account    Account? @relation
  accountId  String?  @unique // Family owned by account
  
  // ... existing relations
}
```

### 3. Update Caretaker Table

```prisma
model Caretaker {
  // ... existing fields
  
  // Add optional account link
  account    Account? @relation
  accountId  String?  @unique // Caretaker linked to account
  
  // ... existing relations
}
```

## Authentication Flows

### 1. Account Holder Authentication
```
Email/Password → Account → Linked Caretaker → Direct App Access
```

- No PIN required
- Seamless login experience
- Enhanced permissions as family owner

### 2. Regular Caretaker Authentication
```
Family Selection → PIN → Caretaker → App Access
```

- Existing flow unchanged
- PIN-based quick access preserved
- Standard family member permissions

### 3. System Administrator Authentication
```
Admin Password → System Access → Cross-Family Management
```

- Existing sysadmin system unchanged
- Separate from account authentication

## Enhanced Authentication Context

```typescript
interface AuthContext {
  familyId: string;
  role: 'USER' | 'ADMIN';
  
  // Authentication method
  authType: 'ACCOUNT' | 'CARETAKER' | 'SYSADMIN';
  
  // Identity (caretaker always set, account optional)
  caretakerId: string;     // Always present
  accountId?: string;      // Only for account holders
  isSysAdmin?: boolean;    // Only for system admins
  
  // Enhanced permissions for account holders
  isAccountOwner: boolean; // True if authenticated via account
}
```

## Account Setup Flow

### Fresh SaaS Service Flow
1. User signs up via OAuth or email/password → NextAuth creates User record
2. Quick Family Creation:
   - Family name (required)
   - Slug (auto-generated from name, editable)
   - System PIN (auto-generated, visible to user for sharing)
3. System creates in transaction:
   - Family record linked to account
   - Admin caretaker linked to account
   - Default settings with generated PIN
4. User immediately enters family dashboard
5. Optional SimplifiedSetupWizard for progressive enhancement:
   - Add first baby information
   - Invite additional caretakers
   - Customize family settings

### Family Recovery Flow (Future Feature)
1. User creates new account with different OAuth provider
2. Provides family slug + admin PIN + verification info
3. System sends verification to existing account email (if accessible)
4. After verification, transfers ownership to new account
5. Previous account becomes regular caretaker or is deactivated

## Special Permissions for Account Holders

Account holders get enhanced permissions beyond regular admins:

- **Billing Management**: Access to subscription and payment settings
- **Family Settings**: Core family configuration and branding
- **Data Export**: Full family data export capabilities
- **Account Management**: Invite/remove caretakers
- **Family Deletion**: Ability to permanently delete family

## API Endpoint Changes

### New Account Endpoints

```typescript
// Account management (handled by NextAuth.js)
POST /api/auth/[...nextauth]  // NextAuth.js unified endpoint
GET  /api/accounts/profile    // Account profile management
PUT  /api/accounts/profile    // Update account profile

// Quick family creation for fresh service
POST /api/accounts/create-family     // Create family after account signup
POST /api/accounts/register          // Email/password registration

// Family recovery (future feature)
POST /api/accounts/recover-family    // Family recovery process
POST /api/accounts/transfer-ownership // Ownership transfer
```

### Enhanced Auth Endpoints

```typescript
// Hybrid authentication system
POST /api/auth/[...nextauth]  // NextAuth.js handles OAuth + email/password
POST /api/auth/login          // PIN-based (existing, unchanged)
POST /api/auth/logout         // Works for both systems
GET  /api/auth/me            // Returns enhanced auth context
```

## Implementation Strategy

### Phase 1: NextAuth.js Integration
- Install and configure NextAuth.js v5
- Add NextAuth.js tables to schema (User, Account, Session, VerificationToken)
- Update existing Family and Caretaker tables with User relations
- Create hybrid authentication middleware

### Phase 2: Account Registration & Quick Family Creation
- Build OAuth login components (Google, Apple, GitHub)
- Create email/password registration flow
- Implement quick family creation API and UI
- Add auto-generated PIN display and sharing

### Phase 3: Progressive Setup Experience
- Create SimplifiedSetupWizard component
- Integrate with existing SetupWizard for advanced configuration
- Add account dashboard and family management UI
- Test complete user journey from signup to tracking

### Phase 4: Enhanced Features & Future Preparation
- Add billing integration preparation (Stripe fields)
- Implement account-only features and permissions
- Document family recovery process for future implementation
- Add comprehensive testing and deployment guides

## Benefits of This Approach

### 1. Minimal Disruption
- Existing PIN system completely unchanged
- Current users can continue without any changes
- No forced migration required

### 2. Clear Ownership Model
- One account owns one family (simple billing)
- Clear data ownership for GDPR compliance
- Straightforward subscription management

### 3. Enhanced UX for Account Holders
- Skip PIN entry for seamless access
- Account-level settings and preferences
- Professional onboarding experience

### 4. Flexible Access Control
- Account holders get enhanced permissions
- PIN users maintain existing access patterns
- System admins retain cross-family access

### 5. SaaS Ready
- Clear subscription model (account = billing entity)
- Professional account management features
- Easy to add billing, limits, and features

## Future Enhancements

### Billing Integration
```prisma
model Account {
  // ... existing fields
  
  // Billing fields
  stripeCustomerId String?
  subscriptionId   String?
  planType         String?  // basic, premium, enterprise
  planExpires      DateTime?
  trialEnds        DateTime?
}
```

### Account-Level Features
- Custom family branding
- Enhanced data analytics
- Priority support
- Advanced export formats
- API access for integrations

### Family Limits by Plan
- Number of babies per family
- Data retention periods
- Advanced features (calendar, medicine tracking)
- Storage limits for photos/attachments

## Implementation Notes

### Security Considerations
- Account passwords use bcrypt with high cost factor
- Email verification required for account activation
- Rate limiting on account creation and login attempts
- Secure password reset flow with time-limited tokens

### Data Privacy
- Account holders own all family data
- Clear data deletion policies
- GDPR-compliant data export/deletion
- Audit trail for account actions

### Performance
- Indexes on email and account lookups
- Efficient account → caretaker → family queries
- Caching for account authentication
- Minimal impact on existing PIN authentication

This design provides a clean path to SaaS functionality while preserving the simplicity and speed of the existing PIN system, giving users the best of both worlds.

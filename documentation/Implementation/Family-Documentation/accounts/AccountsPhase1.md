# Phase 1: Account System Implementation

## Overview

This document outlines the implementation plan for Phase 1 of the account system, which introduces email/password authentication that integrates with the existing family-based structure. This phase establishes the foundation for a SaaS model while preserving all existing functionality.

## Goals

1. **Email/Password Registration**: Allow users to create accounts with email verification
2. **Account-Family Linking**: Each account owns exactly one family (future-proofed for multiple)
3. **Hybrid Authentication**: Seamless integration with existing PIN-based caretaker system
4. **Account Management UI**: Form-based account management using existing components
5. **Enhanced Permissions**: Account holders get family-owner privileges
6. **Future-Proofed**: Database and API structure ready for OAuth providers

## Database Schema Changes

### 1. New Account Table

```sql
-- Add to prisma/schema.prisma

model Account {
  id            String   @id @default(cuid())
  email         String   @unique
  password      String   // bcrypt hashed
  firstName     String?
  lastName      String?
  verified      Boolean  @default(false)
  verificationToken String? @unique
  passwordResetToken String? @unique
  passwordResetExpires DateTime?
  
  // Future OAuth fields (ready for Phase 2)
  provider      String?  // 'email', 'google', 'apple', 'github'
  providerId    String?  // OAuth provider's user ID
  
  // Future billing fields
  stripeCustomerId String?
  subscriptionId   String?
  planType         String? // 'free', 'premium', 'enterprise'
  planExpires      DateTime?
  trialEnds        DateTime?
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  // Relations (one-to-one with family)
  family        Family?  @relation(fields: [familyId], references: [id])
  familyId      String?  @unique
  
  // Link to admin caretaker for seamless access
  caretaker     Caretaker? @relation(fields: [caretakerId], references: [id])
  caretakerId   String?    @unique
  
  @@index([email])
  @@index([verified])
  @@index([verificationToken])
  @@index([passwordResetToken])
}
```

### 2. Update Family Table

```sql
-- Add to existing Family model
model Family {
  // ... existing fields
  
  // Account ownership
  account       Account?
  accountId     String?  @unique
  
  // ... existing relations
}
```

### 3. Update Caretaker Table

```sql
-- Add to existing Caretaker model
model Caretaker {
  // ... existing fields
  
  // Optional account link (for account holders who are also caretakers)
  account       Account?
  accountId     String?  @unique
  
  // ... existing relations
}
```

## Authentication System Enhancements

### 1. Extended AuthResult Interface

```typescript
// Update app/api/utils/auth.ts
export interface AuthResult {
  authenticated: boolean;
  caretakerId?: string | null;
  caretakerType?: string | null;
  caretakerRole?: string;
  familyId?: string | null;
  familySlug?: string | null;
  isSysAdmin?: boolean;
  isSetupAuth?: boolean;
  setupToken?: string;
  
  // New account fields
  isAccountAuth?: boolean;  // True if authenticated via account
  accountId?: string;       // Account ID
  accountEmail?: string;    // Account email
  isAccountOwner?: boolean; // True if account owns the family
  error?: string;
}
```

### 2. Account Authentication Type

The JWT token will include a new field to distinguish account authentication:

```typescript
// New JWT payload for account authentication
{
  id: string;           // Account ID or Caretaker ID
  name: string;         // First name or full name
  type: string;         // 'ACCOUNT' | existing types
  role: string;         // 'OWNER' | existing roles
  familyId: string;     // Associated family ID
  familySlug: string;   // Associated family slug
  isAccountAuth: boolean; // True for account holders
  accountId: string;    // Account ID (for account holders)
  accountEmail: string; // Account email
}
```

## API Endpoints

### 1. Account Management Endpoints

```typescript
// /app/api/accounts/register/route.ts
POST /api/accounts/register
{
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  familyName: string;
}

// /app/api/accounts/verify/route.ts
POST /api/accounts/verify
{
  token: string;
}

// /app/api/accounts/login/route.ts
POST /api/accounts/login
{
  email: string;
  password: string;
}

// /app/api/accounts/forgot-password/route.ts
POST /api/accounts/forgot-password
{
  email: string;
}

// /app/api/accounts/reset-password/route.ts
POST /api/accounts/reset-password
{
  token: string;
  password: string;
}

// /app/api/accounts/profile/route.ts
GET /api/accounts/profile
PUT /api/accounts/profile
{
  firstName?: string;
  lastName?: string;
  email?: string;
}
```

### 2. Enhanced Auth Endpoint

Update `/app/api/auth/route.ts` to handle account authentication:

```typescript
// Add account authentication support
if (email && password && !loginId) {
  // Account authentication flow
  const account = await prisma.account.findUnique({
    where: { email },
    include: { family: true, caretaker: true }
  });
  
  if (account && account.verified && bcrypt.compareSync(password, account.password)) {
    // Generate JWT for account holder
    const token = jwt.sign({
      id: account.id,
      name: account.firstName,
      type: 'ACCOUNT',
      role: 'OWNER',
      familyId: account.familyId,
      familySlug: account.family?.slug,
      isAccountAuth: true,
      accountId: account.id,
      accountEmail: account.email,
    }, JWT_SECRET, { expiresIn: `${TOKEN_EXPIRATION}s` });
    
    // Return success response
  }
}
```

## UI Components

### 1. Account Form Component

Create `/src/components/forms/AccountForm/index.tsx`:

```typescript
interface AccountFormProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'login' | 'register' | 'profile';
  onSuccess?: () => void;
}

export default function AccountForm({
  isOpen,
  onClose,
  mode,
  onSuccess
}: AccountFormProps) {
  // Form implementation using FormPage component
  // Handles login, registration, and profile management
}
```

### 2. Account Button Component

Create `/src/components/ui/account-button/index.tsx`:

```typescript
interface AccountButtonProps {
  className?: string;
}

export function AccountButton({ className }: AccountButtonProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [accountName, setAccountName] = useState('');
  
  // Check authentication status and display appropriate button
}
```

### 3. Update Coming Soon Page

Modify `/app/coming-soon/page.tsx` to include the account button:

```typescript
// Add to the saas-nav-links section
<div className="saas-nav-links">
  <AccountButton />
  <Button size="sm" className="saas-signup-btn" asChild>
    <a href="#signup">Sign-up for the beta program!</a>
  </Button>
  <ThemeToggle variant="light" className="saas-theme-toggle" />
</div>
```

## Registration Flow

### 1. Account Creation Process

```typescript
1. User fills out registration form:
   - Email (required, validated)
   - Password (required, min 8 chars)
   - First Name (required)
   - Last Name (optional)
   - Family Name (required, auto-generates slug)

2. System creates Account record:
   - Password hashed with bcrypt
   - verified: false
   - verificationToken: generated UUID
   - No family linked yet

3. System sends verification email

4. User clicks verification link:
   - Marks account as verified
   - Automatically creates:
     - Family record with generated slug and PIN
     - Admin caretaker linked to account
     - Default settings for family

5. User is logged in and redirected to family dashboard
```

### 2. Email Verification

Email verification is handled through the existing email infrastructure with three types of emails:

1. **Verification Email**: Sent immediately after registration
2. **Password Reset Email**: Sent when user requests password reset  
3. **Welcome Email**: Sent after successful email verification with family details

All emails use responsive HTML templates with fallback text versions and include proper branding consistent with the Sprout Track design system.

## Enhanced Authentication Middleware

### 1. Account Authentication Support

Update `/app/api/utils/auth.ts` to handle account authentication:

```typescript
export async function getAuthenticatedUser(req: NextRequest): Promise<AuthResult> {
  // ... existing code

  // If we have a JWT token, verify it
  if (token) {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Handle account authentication
    if (decoded.isAccountAuth) {
      return {
        authenticated: true,
        caretakerId: decoded.id, // Use account ID as caretaker ID for family access
        caretakerType: 'ACCOUNT',
        caretakerRole: 'OWNER',
        familyId: decoded.familyId,
        familySlug: decoded.familySlug,
        isAccountAuth: true,
        accountId: decoded.accountId,
        accountEmail: decoded.accountEmail,
        isAccountOwner: true,
      };
    }
    
    // ... existing code for other auth types
  }
}
```

### 2. Account Owner Middleware

```typescript
export function withAccountOwner<T>(
  handler: (req: NextRequest, authContext: AuthResult) => Promise<NextResponse<ApiResponse<T>>>
) {
  return async (req: NextRequest): Promise<NextResponse<ApiResponse<T | null>>> => {
    const authResult = await getAuthenticatedUser(req);
    
    if (!authResult.authenticated) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    
    if (!authResult.isAccountOwner && !authResult.isSysAdmin) {
      return NextResponse.json({ success: false, error: 'Account owner access required' }, { status: 403 });
    }
    
    return handler(req, authResult);
  };
}
```

## Email System Integration

The application already has a comprehensive email system in place that supports multiple providers (SendGrid, SMTP2GO, Manual SMTP) with encryption support for credentials. We'll leverage this existing infrastructure for account verification and password reset emails.

### 1. Verification Email Service

Create `/app/api/utils/account-emails.ts`:

```typescript
import { sendEmail } from '@/src/lib/email';

export async function sendVerificationEmail(email: string, token: string, firstName: string) {
  const verificationUrl = `${process.env.ROOT_DOMAIN}/verify?token=${token}`;
  
  const result = await sendEmail({
    to: email,
    from: process.env.VERIFICATION_EMAIL || 'noreply@sprout-track.com',
    subject: 'Welcome to Sprout Track - Verify Your Account',
    text: `Hi ${firstName},

Welcome to Sprout Track! Please verify your email address by visiting this link:

${verificationUrl}

This link will expire in 24 hours.

Best regards,
The Sprout Track Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0d9488;">Welcome to Sprout Track!</h2>
        <p>Hi ${firstName},</p>
        <p>Welcome to Sprout Track! Please verify your email address by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #0d9488; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 6px; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">
          This link will expire in 24 hours. If you didn't create an account with Sprout Track, 
          please ignore this email.
        </p>
        <p>Best regards,<br>The Sprout Track Team</p>
      </div>
    `
  });

  return result;
}

export async function sendPasswordResetEmail(email: string, token: string, firstName: string) {
  const resetUrl = `${process.env.ROOT_DOMAIN}/reset-password?token=${token}`;
  
  const result = await sendEmail({
    to: email,
    from: process.env.SECURITY_EMAIL || 'security@sprout-track.com',
    subject: 'Sprout Track - Password Reset Request',
    text: `Hi ${firstName},

You requested a password reset for your Sprout Track account. Please visit this link to reset your password:

${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, please ignore this email.

Best regards,
The Sprout Track Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0d9488;">Password Reset Request</h2>
        <p>Hi ${firstName},</p>
        <p>You requested a password reset for your Sprout Track account. Click the button below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background-color: #0d9488; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 6px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">
          This link will expire in 1 hour. If you didn't request a password reset, 
          please ignore this email.
        </p>
        <p>Best regards,<br>The Sprout Track Team</p>
      </div>
    `
  });

  return result;
}

export async function sendWelcomeEmail(email: string, firstName: string, familySlug: string, familyPin: string) {
  const familyUrl = `${process.env.ROOT_DOMAIN}/${familySlug}`;
  
  const result = await sendEmail({
    to: email,
    from: process.env.ACCOUNTS_EMAIL || 'accounts@sprout-track.com',
    subject: 'Welcome to Sprout Track - Your Family is Ready!',
    text: `Hi ${firstName},

Welcome to Sprout Track! Your account has been verified and your family is ready to use.

Your Family Details:
- Family URL: ${familyUrl}
- Family PIN: ${familyPin}

You can share the family URL and PIN with other caretakers so they can access your family's data.

As the account owner, you can log in directly without needing the PIN.

Get started by adding your first baby and logging your first activities!

Best regards,
The Sprout Track Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0d9488;">Welcome to Sprout Track!</h2>
        <p>Hi ${firstName},</p>
        <p>Welcome to Sprout Track! Your account has been verified and your family is ready to use.</p>
        
        <div style="background-color: #f0fdfa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #0d9488; margin-top: 0;">Your Family Details:</h3>
          <p><strong>Family URL:</strong> <a href="${familyUrl}">${familyUrl}</a></p>
          <p><strong>Family PIN:</strong> <code style="background-color: #fff; padding: 4px 8px; border-radius: 4px;">${familyPin}</code></p>
        </div>
        
        <p>You can share the family URL and PIN with other caretakers so they can access your family's data.</p>
        <p>As the account owner, you can log in directly without needing the PIN.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${familyUrl}" 
             style="background-color: #0d9488; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 6px; display: inline-block;">
            Access Your Family Dashboard
          </a>
        </div>
        
        <p>Get started by adding your first baby and logging your first activities!</p>
        <p>Best regards,<br>The Sprout Track Team</p>
      </div>
    `
  });

  return result;
}
```

### 2. Existing Email Infrastructure

The application already includes:

- **Unified Email Service**: `/src/lib/email/index.ts` provides a `sendEmail()` function that automatically uses the configured provider
- **Multiple Provider Support**: SendGrid, SMTP2GO, and Manual SMTP configurations
- **Database Integration**: Email settings stored in `EmailConfig` table with encryption support
- **Security**: API keys and passwords are encrypted in the database
- **Error Handling**: Comprehensive error handling and logging

### 3. Environment Variables and Email Addresses

Add the following environment variables for account emails:

```bash
# Email configuration for account emails
VERIFICATION_EMAIL=noreply@sprout-track.com
SECURITY_EMAIL=security@sprout-track.com
ACCOUNTS_EMAIL=accounts@sprout-track.com
SUPPORT_EMAIL=support@sprout-track.com
ROOT_DOMAIN=https://sprout-track.com
```

### 4. Industry-Standard Email Addresses

To ensure optimal deliverability and avoid spam filters, use these specific email addresses for different types of communications:

- **`noreply@sprout-track.com`** - Email verification and notifications that don't expect replies
- **`security@sprout-track.com`** - Password resets and security-related communications
- **`accounts@sprout-track.com`** - Welcome emails and general account management
- **`support@sprout-track.com`** - Customer support and help-related emails (future use)

These addresses follow industry standards and are less likely to be flagged as spam compared to generic or test addresses.

### 5. Email Deliverability Best Practices

To ensure maximum deliverability:

1. **SPF Records**: Configure SPF records for `sprout-track.com` to authorize sending from your email provider
2. **DKIM**: Enable DKIM signing through your email provider (SendGrid, SMTP2GO, etc.)
3. **DMARC**: Set up DMARC policy to prevent spoofing
4. **Consistent From Addresses**: Always use the same from addresses for the same types of emails
5. **Reply-To Headers**: For `noreply@` emails, consider adding a `Reply-To: support@sprout-track.com` header
6. **Email Authentication**: Ensure your email provider is properly authenticated with your domain

These addresses should be configured as aliases/forwards in your domain's email settings, even if they don't need to receive replies (except `support@`).

## Security Considerations

### 1. Password Security

- Minimum 8 characters
- bcrypt hashing with cost factor 12
- Password reset tokens expire in 1 hour
- Rate limiting on login attempts (use existing IP lockout system)

### 2. Email Verification

- Verification tokens expire in 24 hours
- Unverified accounts cannot log in
- Re-send verification email option

### 3. Account Lockout Integration

Extend existing IP lockout system to include account-based authentication attempts.

## Implementation Tasks

### Phase 1.1: Database & Core Auth

1. **Update Prisma Schema**
   - Add Account model
   - Update Family and Caretaker models
   - Generate migration

2. **Create Account APIs**
   - Registration endpoint with email verification
   - Login endpoint
   - Password reset flow
   - Profile management

3. **Update Auth System**
   - Extend AuthResult interface
   - Add account authentication to existing auth endpoint
   - Create account-specific middleware

### Phase 1.2: UI Components

1. **Create AccountForm Component**
   - Login form
   - Registration form
   - Profile management form
   - Use FormPage component pattern

2. **Create AccountButton Component**
   - Display login state
   - Handle authentication status
   - Integrate with coming-soon page

3. **Email Integration**
   - Create account-emails.ts utility using existing email service
   - Implement verification, password reset, and welcome email functions
   - Configure industry-standard email addresses and environment variables
   - Set up domain authentication (SPF, DKIM, DMARC) for deliverability

### Phase 1.3: Integration & Testing

1. **Update Coming Soon Page**
   - Add account button to navigation
   - Test registration flow

2. **Family Dashboard Integration**
   - Account holders bypass PIN entry
   - Enhanced permissions for account owners
   - Family settings access

3. **Testing & Documentation**
   - Unit tests for auth functions
   - Integration tests for registration flow
   - Update API documentation

## Future-Proofing for Phase 2

### 1. OAuth Support Ready

The Account model is structured to support OAuth providers in Phase 2:

```typescript
// Ready for Phase 2 OAuth integration
provider: 'email' | 'google' | 'apple' | 'github'
providerId: string // OAuth provider's user ID
```

### 2. Multiple Families Support

While Phase 1 supports one family per account, the structure allows for future expansion:

```typescript
// Phase 1: One-to-one relationship
familyId: String? @unique

// Phase 2: One-to-many relationship (remove @unique)
families: Family[] // Through AccountFamily junction table
```

### 3. Billing Integration Ready

Account model includes billing fields for future Stripe integration:

```typescript
stripeCustomerId: String?
subscriptionId: String?
planType: String?
```

## Benefits of This Approach

1. **Minimal Disruption**: Existing PIN system completely unchanged
2. **Enhanced UX**: Account holders skip PIN entry
3. **Clear Ownership**: One account owns one family (simple billing model)
4. **Professional Onboarding**: Email verification and password reset
5. **Future-Ready**: OAuth and multiple families support planned
6. **Security-First**: bcrypt, email verification, rate limiting
7. **Leverages Existing Infrastructure**: Uses established email system with multiple provider support and encryption

This Phase 1 implementation establishes the foundation for a professional SaaS offering while preserving all existing functionality and user workflows.
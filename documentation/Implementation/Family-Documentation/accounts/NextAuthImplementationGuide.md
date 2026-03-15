# NextAuth.js Implementation Guide: Hybrid Account System

This document provides a comprehensive implementation guide for integrating NextAuth.js v5 with your existing baby tracker application, creating a hybrid authentication system that supports OAuth providers and email/password while preserving the PIN-based caretaker system.

## Overview

This implementation adds account-level authentication using NextAuth.js v5 while maintaining your existing PIN-based caretaker system. Account holders get streamlined OAuth login (Apple, Google, GitHub) and email/password authentication with enhanced permissions, while regular caretakers continue using the familiar PIN system.

## Architecture Summary

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

## Account Creation Flow (Hybrid Approach)

### New User Journey
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

### Benefits of This Approach
- **Immediate gratification**: User gets into the app quickly
- **Progressive disclosure**: Advanced setup when ready
- **PIN sharing**: Account holders can share family URL + PIN with others
- **Familiar flow**: Uses your existing SetupWizard for detailed configuration

## Phase 1: Installation & Setup

### 1.1 Install NextAuth.js v5

```bash
# Install NextAuth.js v5 (beta) and Prisma adapter
npm install next-auth@beta @auth/prisma-adapter

# Ensure Prisma is up to date
npm install @prisma/client@latest
npm install prisma@latest --save-dev
```

### 1.2 Environment Variables

Add the following to your `.env` file:

```bash
# NextAuth.js Configuration
AUTH_SECRET="your-auth-secret-here"  # Generate with: npx auth secret
AUTH_TRUST_HOST="true"  # For deployment behind proxy

# OAuth Provider Credentials (auto-detected by NextAuth.js)
AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"

AUTH_GITHUB_ID="your-github-client-id"
AUTH_GITHUB_SECRET="your-github-client-secret"

AUTH_APPLE_ID="your-apple-service-id"
AUTH_APPLE_SECRET="your-apple-private-key"

# Feature Flags
ENABLE_ACCOUNT_SYSTEM="true"
ENABLE_OAUTH_PROVIDERS="true"

# Database (update for PostgreSQL)
DATABASE_PROVIDER="postgresql"
DATABASE_URL="postgresql://username:password@localhost:5432/baby_tracker"
```

### 1.3 Generate AUTH_SECRET

```bash
# This will generate and add AUTH_SECRET to your .env file
npx auth secret
```

## Phase 2: Database Migration & Schema Updates

### 2.1 Update Prisma Schema

Add NextAuth.js tables to your existing `prisma/schema.prisma`:

```prisma
// Add to your existing schema.prisma

// NextAuth.js required tables
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  accounts      Account[]
  sessions      Session[]
  
  // Custom fields for family integration
  familyId      String?   @unique
  caretakerId   String?   @unique
  
  // Billing fields (for future use)
  stripeId       String?
  subscriptionId String?
  planType       String?
  trialEnds      DateTime?
  
  // Relations to your existing models
  family        Family?    @relation(fields: [familyId], references: [id])
  caretaker     Caretaker? @relation(fields: [caretakerId], references: [id])
  
  @@index([email])
  @@index([familyId])
  @@index([caretakerId])
}

model VerificationToken {
  identifier String
  token      String
  expires    DateTime

  @@unique([identifier, token])
}

// Update your existing Family model
model Family {
  // ... existing fields unchanged
  
  // Add account ownership
  accountUser User? @relation
  
  // ... existing relations unchanged
}

// Update your existing Caretaker model  
model Caretaker {
  // ... existing fields unchanged
  
  // Add optional account link
  accountUser User? @relation
  
  // ... existing relations unchanged
}
```

### 2.2 Database Migration

```bash
# Switch to PostgreSQL (if not already done)
# Update DATABASE_URL in .env to point to PostgreSQL

# Create and apply migration
npx prisma migrate dev --name add_nextauth_tables

# Generate Prisma client
npx prisma generate
```

### 2.3 Create Prisma Client Instance

Create or update `lib/prisma.ts`:

```typescript
// lib/prisma.ts
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

export default prisma
```

## Phase 3: NextAuth.js Configuration

### 3.1 Create Auth Configuration

Create `auth.ts` in your project root:

```typescript
// auth.ts
import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Google from "next-auth/providers/google"
import GitHub from "next-auth/providers/github"
import Apple from "next-auth/providers/apple"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    }),
    Apple({
      clientId: process.env.AUTH_APPLE_ID!,
      clientSecret: process.env.AUTH_APPLE_SECRET!,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email as string
          }
        })

        if (!user) {
          return null
        }

        // For OAuth users, password might not be set
        if (!user.password) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        }
      }
    })
  ],
  pages: {
    signIn: '/auth/signin',
    signUp: '/auth/signup',
    error: '/auth/error',
  },
  callbacks: {
    async session({ session, user }) {
      // Add custom fields to session
      if (session.user) {
        session.user.id = user.id;
        
        // Fetch user with family/caretaker info
        const userWithRelations = await prisma.user.findUnique({
          where: { id: user.id },
          include: {
            family: true,
            caretaker: true,
          },
        });
        
        if (userWithRelations) {
          session.user.familyId = userWithRelations.familyId;
          session.user.caretakerId = userWithRelations.caretakerId;
          session.user.family = userWithRelations.family;
          session.user.caretaker = userWithRelations.caretaker;
        }
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
  },
  events: {
    async createUser({ user }) {
      console.log(`New user created: ${user.email}`);
    },
  },
})
```

### 3.2 Add Password Field to User Model

Update your Prisma schema to include password for email/password auth:

```prisma
model User {
  // ... existing fields
  password      String?   // For email/password authentication
  // ... rest of fields
}
```

### 3.3 Create API Route Handler

Create `app/api/auth/[...nextauth]/route.ts`:

```typescript
// app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/auth"

export const { GET, POST } = handlers
```

### 3.4 Add Middleware (Optional)

Update or create `middleware.ts`:

```typescript
// middleware.ts
import { auth } from "@/auth"

export default auth((req) => {
  // Optional: Add custom middleware logic here
  // req.auth contains the session
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
```

## Phase 4: Enhanced Auth Middleware Integration

### 4.1 Update Your Auth Utils

Enhance `app/api/utils/auth.ts` to support NextAuth.js:

```typescript
// app/api/utils/auth.ts - Enhanced version
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '../db';
import jwt from 'jsonwebtoken';

// ... existing interfaces and JWT code ...

/**
 * Enhanced authentication that supports both NextAuth and existing JWT system
 */
export async function getAuthenticatedUser(req: NextRequest): Promise<AuthResult> {
  try {
    // 1. Try NextAuth session first (account holders)
    const session = await auth();
    
    if (session?.user) {
      // User authenticated via NextAuth (OAuth or email/password)
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
          family: true,
          caretaker: true,
        },
      });
      
      if (user && user.familyId) {
        return {
          authenticated: true,
          authType: 'ACCOUNT',
          accountId: user.id,
          caretakerId: user.caretakerId,
          caretakerType: user.caretaker?.type || 'Account Holder',
          caretakerRole: 'ADMIN', // Account holders are always admins
          familyId: user.familyId,
          familySlug: user.family?.slug,
          isAccountOwner: true,
          isSysAdmin: false,
        };
      }
    }
    
    // 2. Fall back to existing JWT/PIN system
    return getJWTAuthenticatedUser(req);
    
  } catch (error) {
    console.error('NextAuth authentication error:', error);
    // Fall back to JWT system on error
    return getJWTAuthenticatedUser(req);
  }
}

/**
 * Original JWT authentication (renamed for clarity)
 */
async function getJWTAuthenticatedUser(req: NextRequest): Promise<AuthResult> {
  // Your existing JWT authentication logic here
  // ... (keep all existing code)
}

// ... rest of existing middleware functions unchanged
```

## Phase 5: Account Registration & Quick Family Creation

### 5.1 Account Registration API

Create `app/api/accounts/register/route.ts`:

```typescript
// app/api/accounts/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { ApiResponse } from '../../types';

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password || !name) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Email, password, and name are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'User already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        emailVerified: new Date(), // Auto-verify for now, add email verification later
      },
    });

    return NextResponse.json<ApiResponse<{ id: string; email: string; name: string }>>({
      success: true,
      data: { id: user.id, email: user.email, name: user.name || '' },
    });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
```

### 5.2 Quick Family Creation API

Create `app/api/accounts/create-family/route.ts`:

```typescript
// app/api/accounts/create-family/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ApiResponse } from '../../types';

// Generate random PIN
function generateRandomPin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Generate slug from name
function generateSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { familyName, familySlug } = await req.json();

    if (!familyName) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Family name is required' },
        { status: 400 }
      );
    }

    // Generate slug if not provided
    const slug = familySlug || generateSlugFromName(familyName);

    // Check if slug is available
    const existingFamily = await prisma.family.findUnique({
      where: { slug },
    });

    if (existingFamily) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Family URL is already taken' },
        { status: 400 }
      );
    }

    // Generate random system PIN
    const systemPin = generateRandomPin();

    // Create family, settings, and caretaker in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create family
      const family = await tx.family.create({
        data: {
          name: familyName,
          slug: slug,
          isActive: true,
        },
      });

      // Create family settings with generated PIN
      await tx.settings.create({
        data: {
          familyId: family.id,
          familyName: familyName,
          securityPin: systemPin,
          defaultBottleUnit: 'OZ',
          defaultSolidsUnit: 'TBSP',
          defaultHeightUnit: 'IN',
          defaultWeightUnit: 'LB',
          defaultTempUnit: 'F',
        },
      });

      // Create admin caretaker linked to account
      const caretaker = await tx.caretaker.create({
        data: {
          loginId: '01', // First caretaker gets ID 01
          name: session.user.name || 'Account Holder',
          type: 'Account Holder',
          role: 'ADMIN',
          securityPin: systemPin,
          familyId: family.id,
          inactive: false,
        },
      });

      // Link user to family and caretaker
      await tx.user.update({
        where: { id: session.user.id },
        data: {
          familyId: family.id,
          caretakerId: caretaker.id,
        },
      });

      return { family, caretaker, systemPin };
    });

    return NextResponse.json<ApiResponse<{
      family: { id: string; name: string; slug: string };
      systemPin: string;
    }>>({
      success: true,
      data: {
        family: {
          id: result.family.id,
          name: result.family.name,
          slug: result.family.slug,
        },
        systemPin: result.systemPin,
      },
    });

  } catch (error) {
    console.error('Family creation error:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to create family' },
      { status: 500 }
    );
  }
}
```

## Phase 6: Frontend Components

### 6.1 Account Registration Component

Create `components/auth/AccountRegistration.tsx`:

```typescript
// components/auth/AccountRegistration.tsx
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function AccountRegistration() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      // Register user
      const response = await fetch('/api/accounts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Sign in the user
        const result = await signIn('credentials', {
          email: formData.email,
          password: formData.password,
          redirect: false,
        });

        if (result?.ok) {
          // Redirect to family creation
          router.push('/account/create-family');
        } else {
          setError('Registration successful but login failed. Please try logging in.');
        }
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (error) {
      setError('An error occurred during registration');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          Create Account
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Full Name
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
              minLength={8}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
              minLength={8}
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

### 6.2 OAuth Login Component

Create `components/auth/OAuthLogin.tsx`:

```typescript
// components/auth/OAuthLogin.tsx
'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';

interface OAuthLoginProps {
  callbackUrl?: string;
}

export default function OAuthLogin({ callbackUrl = '/account/setup' }: OAuthLoginProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleOAuthSignIn = async (provider: string) => {
    setIsLoading(provider);
    try {
      await signIn(provider, { callbackUrl });
    } catch (error) {
      console.error(`${provider} sign-in error:`, error);
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="space-y-3">
      <button
        onClick={() => handleOAuthSignIn('google')}
        disabled={isLoading === 'google'}
        className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {isLoading === 'google' ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
        ) : (
          <>
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </>
        )}
      </button>

      <button
        onClick={() => handleOAuthSignIn('github')}
        disabled={isLoading === 'github'}
        className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {isLoading === 'github' ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
        ) : (
          <>
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            Continue with GitHub
          </>
        )}
      </button>

      <button
        onClick={() => handleOAuthSignIn('apple')}
        disabled={isLoading === 'apple'}
        className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-black text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {isLoading === 'apple' ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
        ) : (
          <>
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            Continue with Apple
          </>
        )}
      </button>
    </div>
  );
}
```

### 6.3 Quick Family Creation Component

Create `components/account/QuickFamilyCreation.tsx`:

```typescript
// components/account/QuickFamilyCreation.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function QuickFamilyCreation() {
  const [familyName, setFamilyName] = useState('');
  const [familySlug, setFamilySlug] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  // Auto-generate slug from family name
  const generateSlugFromName = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleFamilyNameChange = (name: string) => {
    setFamilyName(name);
    if (!familySlug) {
      setFamilySlug(generateSlugFromName(name));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/accounts/create-family', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyName, familySlug }),
      });

      const data = await response.json();

      if (data.success) {
        // Show success with PIN, then redirect
        router.push(`/account/family-created?slug=${data.data.family.slug}&pin=${data.data.systemPin}`);
      } else {
        setError(data.error || 'Failed to create family');
      }
    } catch (error) {
      setError('An error occurred while creating the family');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          Create Your Family
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          Set up your family to start tracking your baby's activities.
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="familyName" className="block text-sm font-medium text-gray-700">
              Family Name
            </label>
            <input
              type="text"
              id="familyName"
              value={familyName}
              onChange={(e) => handleFamilyNameChange(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="The Smith Family"
              required
            />
          </div>

          <div>
            <label htmlFor="familySlug" className="block text-sm font-medium text-gray-700">
              Family URL
            </label>
            <input
              type="text"
              id="familySlug"
              value={familySlug}
              onChange={(e) => setFamilySlug(e.target.value.toLowerCase())}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="smith-family"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Your family will be accessible at: /{familySlug || 'your-family-url'}
            </p>
          </div>

          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={isLoading || !familyName.trim()}
            className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Creating Family...' : 'Create Family'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

### 6.4 Family Created Success Component

Create `components/account/FamilyCreatedSuccess.tsx`:

```typescript
// components/account/FamilyCreatedSuccess.tsx
'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';

export default function FamilyCreatedSuccess() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  
  const familySlug = searchParams.get('slug');
  const systemPin = searchParams.get('pin');

  const handleCopyInfo = async () => {
    const info = `Family URL: /${familySlug}\nSystem PIN: ${systemPin}`;
    await navigator.clipboard.writeText(info);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleContinue = () => {
    router.push(`/${familySlug}`);
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-center mb-6">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-medium text-gray-900 mb-2">
            Family Created Successfully!
          </h2>
          <p className="text-sm text-gray-600">
            Your family has been set up and is ready to use.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-medium text-blue-900 mb-2">
            Important Information
          </h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium text-blue-900">Family URL:</span>
              <span className="ml-2 font-mono text-blue-800">/{familySlug}</span>
            </div>
            <div>
              <span className="font-medium text-blue-900">System PIN:</span>
              <span className="ml-2 font-mono text-blue-800">{systemPin}</span>
            </div>
          </div>
          <p className="text-xs text-blue-700 mt-3">
            Share this URL and PIN with family members so they can access your family's tracker.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleCopyInfo}
            className="w-full px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50"
          >
            {copied ? 'Copied!' : 'Copy Family Info'}
          </button>
          
          <button
            onClick={handleContinue}
            className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            Continue to Family Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
```

## Phase 7: Simplified Setup Wizard

### 7.1 Create SimplifiedSetupWizard Component

Create `components/account/SimplifiedSetupWizard.tsx`:

```typescript
// components/account/SimplifiedSetupWizard.tsx
'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface SimplifiedSetupWizardProps {
  onComplete: () => void;
}

export default function SimplifiedSetupWizard({ onComplete }: SimplifiedSetupWizardProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Baby information
  const [babyData, setBabyData] = useState({
    firstName: '',
    lastName: '',
    birthDate: '',
    gender: '',
  });

  const handleBabySubmit = async () => {
    if (!babyData.firstName || !babyData.lastName || !babyData.birthDate || !babyData.gender) {
      setError('Please fill in all baby information');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/baby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: babyData.firstName,
          lastName: babyData.lastName,
          birthDate: new Date(babyData.birthDate),
          gender: babyData.gender,
          feedWarningTime: '02:00',
          diaperWarningTime: '03:00',
        }),
      });

      const data = await response.json();

      if (data.success) {
        setStep(2);
      } else {
        setError(data.error || 'Failed to add baby');
      }
    } catch (error) {
      setError('An error occurred while adding the baby');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipCaretakers = () => {
    onComplete();
  };

  const handleCompleteSetup = () => {
    onComplete();
  };

  if (step === 1) {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Add Your Baby
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            Let's start by adding information about your little one.
          </p>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  First Name
                </label>
                <input
                  type="text"
                  value={babyData.firstName}
                  onChange={(e) => setBabyData({ ...babyData, firstName: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Last Name
                </label>
                <input
                  type="text"
                  value={babyData.lastName}
                  onChange={(e) => setBabyData({ ...babyData, lastName: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Birth Date
              </label>
              <input
                type="date"
                value={babyData.birthDate}
                onChange={(e) => setBabyData({ ...babyData, birthDate: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Gender
              </label>
              <select
                value={babyData.gender}
                onChange={(e) => setBabyData({ ...babyData, gender: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select gender</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
            </div>

            {error && (
              <div className="text-red-600 text-sm">{error}</div>
            )}

            <button
              onClick={handleBabySubmit}
              disabled={isLoading}
              className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Adding Baby...' : 'Add Baby'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          Setup Complete!
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          Your baby has been added successfully. You can now start tracking activities or invite other caretakers to help.
        </p>

        <div className="space-y-3">
          <button
            onClick={handleCompleteSetup}
            className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            Start Tracking
          </button>
          
          <button
            onClick={() => router.push('/account/invite-caretakers')}
            className="w-full px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50"
          >
            Invite Caretakers
          </button>
        </div>
      </div>
    </div>
  );
}
```

## Phase 8: Family Recovery (Future Feature)

### 8.1 Family Recovery Documentation

The family recovery feature is designed for edge cases and will be implemented as a future enhancement:

#### Recovery Scenarios:
- **Account Loss**: User loses access to their OAuth account
- **Family Separation**: Ownership transfer needed during divorce/separation
- **Death/Incapacitation**: Family member needs to take over account ownership
- **Technical Issues**: Account corruption, provider problems

#### Recovery Process (Future Implementation):
```typescript
// Family Recovery Flow
1. User creates new account with different OAuth provider
2. Provides family slug + admin PIN + verification info
3. System sends verification to existing account email (if accessible)
4. After verification, transfers ownership to new account
5. Previous account becomes regular caretaker or is deactivated
```

## Phase 9: Testing & Deployment

### 9.1 OAuth Provider Setup

#### Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials
3. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://yourdomain.com/api/auth/callback/google` (production)

#### GitHub OAuth Setup
1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Set Authorization callback URL:
   - `http://localhost:3000/api/auth/callback/github` (development)
   - `https://yourdomain.com/api/auth/callback/github` (production)

#### Apple OAuth Setup
1. Go to [Apple Developer Portal](https://developer.apple.com/)
2. Create a Services ID and configure Sign in with Apple
3. Add return URLs:
   - `http://localhost:3000/api/auth/callback/apple` (development)
   - `https://yourdomain.com/api/auth/callback/apple` (production)

### 9.2 Testing Checklist

- [ ] Email/password registration and login
- [ ] Google OAuth flow
- [ ] GitHub OAuth flow  
- [ ] Apple OAuth flow
- [ ] Quick family creation
- [ ] System PIN generation and visibility
- [ ] Account holder permissions
- [ ] PIN-based caretaker access (unchanged)
- [ ] Hybrid authentication middleware
- [ ] Family dashboard access for account holders
- [ ] SimplifiedSetupWizard flow

### 9.3 Production Environment Variables

```bash
# Production .env
AUTH_SECRET="production-secret-here"
AUTH_TRUST_HOST="true"
AUTH_URL="https://yourdomain.com"

# OAuth credentials (production)
AUTH_GOOGLE_ID="prod-google-client-id"
AUTH_GOOGLE_SECRET="prod-google-client-secret"
AUTH_GITHUB_ID="prod-github-client-id"
AUTH_GITHUB_SECRET="prod-github-client-secret"
AUTH_APPLE_ID="prod-apple-service-id"
AUTH_APPLE_SECRET="prod-apple-private-key"

# Database
DATABASE_URL="postgresql://user:pass@prod-db:5432/baby_tracker_prod"
```

## Summary

This implementation provides:

1. **Hybrid Authentication**: NextAuth.js for account holders, existing PIN system for caretakers
2. **Multiple Auth Providers**: Email/password, Google, Apple, GitHub
3. **Quick Onboarding**: Immediate family creation with auto-generated PIN
4. **Progressive Setup**: SimplifiedSetupWizard for detailed configuration
5. **Zero Disruption**: Existing PIN users continue unchanged
6. **SaaS Ready**: Account ownership model ready for billing integration
7. **Family Recovery**: Documented for future implementation

The system maintains your existing architecture while adding modern account-based authentication for family owners, creating a clear path to SaaS functionality.

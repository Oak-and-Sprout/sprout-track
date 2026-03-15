# API Changes for Multi-Family Support

This document outlines the necessary changes to the API layer to support multi-family functionality. These changes ensure proper data isolation between families and provide endpoints for managing family-related operations.

## Core Principles

1. **Data Isolation**: Each API request should only access data from the family the user belongs to
2. **Automatic Filtering**: Add family-based filtering to all database queries
3. **Consistent Error Handling**: Provide clear error messages for unauthorized access
4. **Family Context**: Include family information in authentication tokens and context

## Authentication Changes

### 1. Update Auth Flow

Modify the existing authentication system in `app/api/auth/route.ts` to include family information:

```typescript
// app/api/auth/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse } from '../types';
import jwt from 'jsonwebtoken';

// Secret key for JWT signing - in production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'baby-tracker-jwt-secret';

export async function POST(req: NextRequest) {
  try {
    // Existing authentication logic...
    
    // If authentication is successful, include family information in the token
    if (caretaker) {
      // Get the user's families
      const familyMembers = await prisma.familyMember.findMany({
        where: { caretakerId: caretaker.id },
        include: { family: true },
      });
      
      // If user has families, use the first one as default
      let selectedFamilyId = null;
      if (familyMembers.length > 0) {
        selectedFamilyId = familyMembers[0].familyId;
      }
      
      // Create JWT token with family information
      const token = jwt.sign(
        {
          id: caretaker.id,
          name: caretaker.name,
          type: caretaker.type,
          role: (caretaker as any).role || 'USER',
          familyId: selectedFamilyId, // Add familyId to token
        },
        JWT_SECRET,
        { expiresIn: `${TOKEN_EXPIRATION}s` }
      );
      
      // Create response with token and families
      const response = NextResponse.json<ApiResponse<{
        id: string;
        name: string;
        type: string | null;
        role: string;
        token: string;
        families: any[];
        selectedFamilyId: string | null;
      }>>(
        {
          success: true,
          data: {
            id: caretaker.id,
            name: caretaker.name,
            type: caretaker.type,
            role: (caretaker as any).role || 'USER',
            token: token,
            families: familyMembers.map(fm => fm.family),
            selectedFamilyId,
          },
        }
      );
      
      // Set cookies as before
      response.cookies.set('caretakerId', caretaker.id, {
        httpOnly: true,
        secure: process.env.COOKIE_SECURE === 'true',
        sameSite: 'strict',
        maxAge: TOKEN_EXPIRATION,
        path: '/',
      });
      
      return response;
    }
    
    // Rest of the function...
  } catch (error) {
    // Error handling...
  }
}
```

### 2. Family Selection Endpoint

Add a new endpoint for selecting/switching families:

```typescript
// app/api/auth/select-family/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse } from '../../types';
import jwt from 'jsonwebtoken';
import { withAuthContext, AuthResult } from '../../utils/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'baby-tracker-jwt-secret';
const TOKEN_EXPIRATION = parseInt(process.env.AUTH_LIFE || '1800', 10);

async function handlePost(req: NextRequest, authContext: AuthResult) {
  try {
    const { familyId } = await req.json();
    const caretakerId = authContext.caretakerId;
    
    if (!caretakerId) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 }
      );
    }
    
    // Verify user has access to this family
    const familyMember = await prisma.familyMember.findUnique({
      where: {
        familyId_caretakerId: {
          familyId,
          caretakerId,
        },
      },
      include: { family: true },
    });
    
    if (!familyMember) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Not authorized to access this family',
        },
        { status: 403 }
      );
    }
    
    // Get user information for token
    const caretaker = await prisma.caretaker.findUnique({
      where: { id: caretakerId },
    });
    
    if (!caretaker) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Caretaker not found',
        },
        { status: 404 }
      );
    }
    
    // Create new token with selected family
    const token = jwt.sign(
      {
        id: caretaker.id,
        name: caretaker.name,
        type: caretaker.type,
        role: (caretaker as any).role || 'USER',
        familyId: familyId,
      },
      JWT_SECRET,
      { expiresIn: `${TOKEN_EXPIRATION}s` }
    );
    
    // Create response with token and selected family
    const response = NextResponse.json<ApiResponse<{
      token: string;
      family: any;
    }>>(
      {
        success: true,
        data: {
          token,
          family: familyMember.family,
        },
      }
    );
    
    return response;
  } catch (error) {
    console.error('Error selecting family:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to select family',
      },
      { status: 500 }
    );
  }
}

export const POST = withAuthContext(handlePost);
```

## Middleware Changes

### 1. Update Auth Middleware

Modify the existing auth middleware in `app/api/utils/auth.ts` to include family context:

```typescript
// app/api/utils/auth.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import jwt from 'jsonwebtoken';
import { ApiResponse } from '../types';

// Existing code...

/**
 * Authentication result with caretaker and family information
 */
export interface AuthResult {
  authenticated: boolean;
  caretakerId?: string | null;
  caretakerType?: string | null;
  caretakerRole?: string;
  familyId?: string | null; // Add familyId
  familyRole?: string | null; // Add family role
  error?: string;
}

/**
 * Gets the authenticated user information from the request
 */
export async function getAuthenticatedUser(req: NextRequest): Promise<AuthResult> {
  try {
    // First try to get the JWT token from the Authorization header
    const authHeader = req.headers.get('Authorization');
    let token: string | undefined;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // Remove 'Bearer ' prefix
    }
    
    // If no token in header, try to get caretakerId from cookies (backward compatibility)
    const caretakerId = req.cookies.get('caretakerId')?.value;
    
    // If we have a JWT token, verify it
    if (token) {
      // Check if token is blacklisted
      if (tokenBlacklist.has(token)) {
        return { authenticated: false, error: 'Token has been invalidated' };
      }
      
      try {
        // Verify and decode the token
        const decoded = jwt.verify(token, JWT_SECRET) as {
          id: string;
          name: string;
          type: string | null;
          role: string;
          familyId?: string | null; // Add familyId
        };
        
        // Return authenticated user info from token
        return {
          authenticated: true,
          caretakerId: decoded.id,
          caretakerType: decoded.type,
          caretakerRole: decoded.role,
          familyId: decoded.familyId || null, // Include familyId from token
        };
      } catch (jwtError) {
        console.error('JWT verification error:', jwtError);
        return { authenticated: false, error: 'Invalid or expired token' };
      }
    }
    
    // Rest of the function...
  } catch (error) {
    // Error handling...
  }
}

/**
 * Middleware function to require family access for API routes
 */
export function withFamilyAuth<T>(
  handler: (req: NextRequest, authContext: AuthResult) => Promise<NextResponse<ApiResponse<T>>>
) {
  return async (req: NextRequest): Promise<NextResponse<ApiResponse<T | null>>> => {
    const authResult = await getAuthenticatedUser(req);
    
    if (!authResult.authenticated) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 }
      );
    }
    
    if (!authResult.familyId) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'No family selected',
        },
        { status: 400 }
      );
    }
    
    // Verify user has access to the family
    const familyMember = await prisma.familyMember.findUnique({
      where: {
        familyId_caretakerId: {
          familyId: authResult.familyId,
          caretakerId: authResult.caretakerId || '',
        },
      },
    });
    
    if (!familyMember) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Not authorized to access this family',
        },
        { status: 403 }
      );
    }
    
    // Add family role to auth context
    authResult.familyRole = familyMember.role;
    
    return handler(req, authResult);
  };
}
```

### 2. Family Context Utility

Create a utility function to add familyId to all database queries:

```typescript
// app/api/utils/family-context.ts
import { Prisma } from '@prisma/client';

/**
 * Adds familyId to a Prisma query's where clause
 * @param query The original Prisma query object
 * @param familyId The family ID to add to the query
 * @returns A new query object with familyId added to the where clause
 */
export function withFamilyContext<T extends Prisma.PrismaClientOptions['where']>(
  query: { where?: T } = {},
  familyId: string
): { where: T & { familyId: string } } {
  return {
    ...query,
    where: {
      ...(query.where || {}),
      familyId,
    } as T & { familyId: string },
  };
}
```

## API Endpoint Updates

### 1. Update Existing Endpoints

All existing endpoints need to be updated to include family-based filtering. Here's an example pattern using the app's route handlers:

```typescript
// app/api/baby/route.ts - Before
import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse, BabyResponse } from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';

async function handleGet(req: NextRequest, authContext: AuthResult) {
  try {
    const babies = await prisma.baby.findMany({
      where: { deletedAt: null },
    });
    
    // Format response...
    
    return NextResponse.json<ApiResponse<BabyResponse[]>>({
      success: true,
      data: response,
    });
  } catch (error) {
    // Error handling...
  }
}

// Apply authentication middleware
export const GET = withAuthContext(handleGet);
```

```typescript
// app/api/baby/route.ts - After
import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse, BabyResponse } from '../types';
import { withFamilyAuth, AuthResult } from '../utils/auth';
import { withFamilyContext } from '../utils/family-context';

async function handleGet(req: NextRequest, authContext: AuthResult) {
  try {
    // Use withFamilyContext to add familyId to the query
    const babies = await prisma.baby.findMany(
      withFamilyContext(
        { where: { deletedAt: null } },
        authContext.familyId as string
      )
    );
    
    // Format response...
    
    return NextResponse.json<ApiResponse<BabyResponse[]>>({
      success: true,
      data: response,
    });
  } catch (error) {
    // Error handling...
  }
}

// Apply family authentication middleware
export const GET = withFamilyAuth(handleGet);
```

### 2. New Family Management Endpoints

Create new API routes for managing families:

```typescript
// app/api/families/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse } from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';

// GET - List all families for current user
async function handleGet(req: NextRequest, authContext: AuthResult) {
  try {
    const caretakerId = authContext.caretakerId;
    
    if (!caretakerId) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 }
      );
    }
    
    const familyMembers = await prisma.familyMember.findMany({
      where: { caretakerId },
      include: { family: true },
    });
    
    return NextResponse.json<ApiResponse<any[]>>({
      success: true,
      data: familyMembers.map(fm => fm.family),
    });
  } catch (error) {
    console.error('Error fetching families:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to fetch families',
      },
      { status: 500 }
    );
  }
}

// POST - Create new family
async function handlePost(req: NextRequest, authContext: AuthResult) {
  try {
    const { name, slug } = await req.json();
    const caretakerId = authContext.caretakerId;
    
    if (!caretakerId) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 }
      );
    }
    
    // Create family
    const family = await prisma.family.create({
      data: {
        name,
        slug,
        isActive: true,
      },
    });
    
    // Add current user as admin
    await prisma.familyMember.create({
      data: {
        familyId: family.id,
        caretakerId,
        role: 'admin',
      },
    });
    
    // Create default settings for family
    await prisma.settings.create({
      data: {
        familyId: family.id,
        familyName: name,
      },
    });
    
    return NextResponse.json<ApiResponse<any>>({
      success: true,
      data: family,
    });
  } catch (error) {
    console.error('Error creating family:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to create family',
      },
      { status: 500 }
    );
  }
}

export const GET = withAuthContext(handleGet);
export const POST = withAuthContext(handlePost);
```

```typescript
// app/api/families/[slug]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse } from '../../types';
import { withFamilyAuth, AuthResult } from '../../utils/auth';

// GET - Get family details
async function handleGet(
  req: NextRequest, 
  authContext: AuthResult, 
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    
    const family = await prisma.family.findUnique({
      where: { slug },
      include: {
        familyMembers: {
          include: { caretaker: true },
        },
      },
    });
    
    if (!family) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Family not found',
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json<ApiResponse<any>>({
      success: true,
      data: family,
    });
  } catch (error) {
    console.error('Error fetching family details:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to fetch family details',
      },
      { status: 500 }
    );
  }
}

// PATCH - Update family
async function handlePatch(
  req: NextRequest, 
  authContext: AuthResult, 
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const { name, newSlug } = await req.json();
    
    // Verify user is admin
    if (authContext.familyRole !== 'admin') {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Only admins can update family details',
        },
        { status: 403 }
      );
    }
    
    const family = await prisma.family.update({
      where: { slug },
      data: {
        name,
        slug: newSlug || slug,
      },
    });
    
    return NextResponse.json<ApiResponse<any>>({
      success: true,
      data: family,
    });
  } catch (error) {
    console.error('Error updating family:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to update family',
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete family
async function handleDelete(
  req: NextRequest, 
  authContext: AuthResult, 
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    
    // Verify user is admin
    if (authContext.familyRole !== 'admin') {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Only admins can delete families',
        },
        { status: 403 }
      );
    }
    
    await prisma.family.delete({
      where: { slug },
    });
    
    return NextResponse.json<ApiResponse<{ success: true }>>({
      success: true,
      data: { success: true },
    });
  } catch (error) {
    console.error('Error deleting family:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to delete family',
      },
      { status: 500 }
    );
  }
}

export const GET = withFamilyAuth(handleGet);
export const PATCH = withFamilyAuth(handlePatch);
export const DELETE = withFamilyAuth(handleDelete);
```

### 3. Family Member Management Endpoints

Create endpoints for managing family members:

```typescript
// app/api/families/[slug]/members/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../db';
import { ApiResponse } from '../../../types';
import { withFamilyAuth, AuthResult } from '../../../utils/auth';

// POST - Invite member to family
async function handlePost(
  req: NextRequest, 
  authContext: AuthResult, 
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const { caretakerId, role } = await req.json();
    
    // Verify user is admin
    if (authContext.familyRole !== 'admin') {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Only admins can invite members',
        },
        { status: 403 }
      );
    }
    
    const family = await prisma.family.findUnique({
      where: { slug },
    });
    
    if (!family) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Family not found',
        },
        { status: 404 }
      );
    }
    
    // Check if caretaker exists
    const caretaker = await prisma.caretaker.findUnique({
      where: { id: caretakerId },
    });
    
    if (!caretaker) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Caretaker not found',
        },
        { status: 404 }
      );
    }
    
    // Add member to family
    const familyMember = await prisma.familyMember.create({
      data: {
        familyId: family.id,
        caretakerId,
        role,
      },
      include: {
        caretaker: true,
      },
    });
    
    return NextResponse.json<ApiResponse<any>>({
      success: true,
      data: familyMember,
    });
  } catch (error) {
    console.error('Error inviting family member:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to invite family member',
      },
      { status: 500 }
    );
  }
}

export const POST = withFamilyAuth(handlePost);
```

```typescript
// app/api/families/[slug]/members/[caretakerId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../db';
import { ApiResponse } from '../../../../types';
import { withFamilyAuth, AuthResult } from '../../../../utils/auth';

// DELETE - Remove member from family
async function handleDelete(
  req: NextRequest, 
  authContext: AuthResult, 
  { params }: { params: { slug: string; caretakerId: string } }
) {
  try {
    const { slug, caretakerId } = params;
    
    // Get family
    const family = await prisma.family.findUnique({
      where: { slug },
    });
    
    if (!family) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Family not found',
        },
        { status: 404 }
      );
    }
    
    // Check if user is removing themselves or is an admin
    if (caretakerId !== authContext.caretakerId && authContext.familyRole !== 'admin') {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Only admins can remove other members',
        },
        { status: 403 }
      );
    }
    
    // Remove member from family
    await prisma.familyMember.delete({
      where: {
        familyId_caretakerId: {
          familyId: family.id,
          caretakerId,
        },
      },
    });
    
    return NextResponse.json<ApiResponse<{ success: true }>>({
      success: true,
      data: { success: true },
    });
  } catch (error) {
    console.error('Error removing family member:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to remove family member',
      },
      { status: 500 }
    );
  }
}

// PATCH - Update member role
async function handlePatch(
  req: NextRequest, 
  authContext: AuthResult, 
  { params }: { params: { slug: string; caretakerId: string } }
) {
  try {
    const { slug, caretakerId } = params;
    const { role } = await req.json();
    
    // Verify user is admin
    if (authContext.familyRole !== 'admin') {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Only admins can update member roles',
        },
        { status: 403 }
      );
    }
    
    // Get family
    const family = await prisma.family.findUnique({
      where: { slug },
    });
    
    if (!family) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Family not found',
        },
        { status: 404 }
      );
    }
    
    // Update member role
    const familyMember = await prisma.familyMember.update({
      where: {
        familyId_caretakerId: {
          familyId: family.id,
          caretakerId,
        },
      },
      data: {
        role,
      },
      include: {
        caretaker: true,
      },
    });
    
    return NextResponse.json<ApiResponse<any>>({
      success: true,
      data: familyMember,
    });
  } catch (error) {
    console.error('Error updating family member role:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to update family member role',
      },
      { status: 500 }
    );
  }
}

export const DELETE = withFamilyAuth(handleDelete);
export const PATCH = withFamilyAuth(handlePatch);
```

## Data Creation Updates

Ensure all data creation endpoints include the familyId. Here's an example using the app's route handlers:

```typescript
// app/api/baby/route.ts - Before
import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse, BabyCreate, BabyResponse } from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';

async function handlePost(req: NextRequest, authContext: AuthResult) {
  try {
    const body: BabyCreate = await req.json();
    
    const baby = await prisma.baby.create({
      data: {
        ...body,
      },
    });
    
    // Format response...
    
    return NextResponse.json<ApiResponse<BabyResponse>>({
      success: true,
      data: response,
    });
  } catch (error) {
    // Error handling...
  }
}

export const POST = withAuthContext(handlePost);
```

```typescript
// app/api/baby/route.ts - After
import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse, BabyCreate, BabyResponse } from '../types';
import { withFamilyAuth, AuthResult } from '../utils/auth';

async function handlePost(req: NextRequest, authContext: AuthResult) {
  try {
    const body: BabyCreate = await req.json();
    
    const baby = await prisma.baby.create({
      data: {
        ...body,
        familyId: authContext.familyId, // Add familyId to all created records
      },
    });
    
    // Format response...
    
    return NextResponse.json<ApiResponse<BabyResponse>>({
      success: true,
      data: response,
    });
  } catch (error) {
    // Error handling...
  }
}

export const POST = withFamilyAuth(handlePost);
```

## Frontend Route Updates

Update frontend routes to include family slug:

```typescript
// Before
/log-entry
/calendar
/full-log

// After
/[familySlug]/log-entry
/[familySlug]/calendar
/[familySlug]/full-log
```

## Implementation Strategy

1. Create middleware for family access control
2. Update authentication to include family context
3. Create utility functions for adding family filtering
4. Update GET endpoints first to ensure proper filtering
5. Update POST/PUT/DELETE endpoints to include familyId
6. Add new family management endpoints
7. Update frontend routes and components

## Testing Considerations

1. Test data isolation between families
2. Verify users can only access their own families
3. Test family switching functionality
4. Ensure all CRUD operations respect family boundaries
5. Test error handling for unauthorized access

# API Authentication Performance Optimization Guide

This document outlines performance issues in the current authentication middleware and provides specific optimizations to improve API response times and reduce database load.

## Current Performance Issues

### 1. Authentication Middleware Overhead

Every API request goes through `withAuthContext()` which creates a cascade of database queries:

```typescript
// Current flow for EVERY API request:
1. JWT token verification (good - no DB hit)
2. Database lookup for caretaker (if caretakerId exists)
3. Family context resolution for sysadmins (multiple fallback queries)
4. Permission validation
5. Business logic queries
```

**Impact**: 2-4 database queries per API request before any business logic executes.

### 2. SysAdmin Family Context Resolution

The most expensive part of the current authentication flow:

```typescript
// Current implementation in withAuthContext() - EXPENSIVE
if (authResult.isSysAdmin) {
  // 1. Check query parameters
  let familyId = searchParams.get('familyId');
  
  // 2. Parse URL path and lookup family by slug
  if (!familyId) {
    const familySlug = pathSegments[0];
    const family = await prisma.family.findUnique({
      where: { slug: familySlug }  // DATABASE QUERY #1
    });
    if (family) familyId = family.id;
  }
  
  // 3. Parse referer header and lookup family by slug AGAIN
  if (!familyId) {
    const refererUrl = new URL(referer);
    const familySlug = refererPathSegments[0];
    const family = await prisma.family.findUnique({
      where: { slug: familySlug }  // DATABASE QUERY #2
    });
    if (family) familyId = family.id;
  }
}
```

**Problem**: Every sysadmin API call potentially does 2-3 database queries just to determine family context.

### 3. Redundant Business Logic Queries

Many endpoints perform unnecessary existence checks:

```typescript
// Example from baby/route.ts - INEFFICIENT
const existingBaby = await prisma.baby.findFirst({
  where: { id, familyId: targetFamilyId }  // DATABASE QUERY #1
});

if (!existingBaby) {
  return NextResponse.json({ error: 'Baby not found' }, { status: 404 });
}

const baby = await prisma.baby.update({
  where: { id },                           // DATABASE QUERY #2
  data: updateData
});
```

**Problem**: Two separate queries when Prisma can handle the existence check automatically.

## Optimization Solutions

### 1. Family Slug Caching

Implement in-memory caching for family slug lookups:

```typescript
// lib/cache.ts
interface FamilyCacheEntry {
  familyId: string;
  expires: number;
}

class FamilySlugCache {
  private cache = new Map<string, FamilyCacheEntry>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes

  async getFamilyId(slug: string): Promise<string | null> {
    // Check cache first
    const cached = this.cache.get(slug);
    if (cached && cached.expires > Date.now()) {
      return cached.familyId;
    }

    // Cache miss - query database
    const family = await prisma.family.findUnique({
      where: { slug },
      select: { id: true } // Only select what we need
    });

    if (family) {
      // Cache the result
      this.cache.set(slug, {
        familyId: family.id,
        expires: Date.now() + this.TTL
      });
      return family.id;
    }

    return null;
  }

  // Clean expired entries periodically
  private cleanup() {
    const now = Date.now();
    for (const [slug, entry] of this.cache.entries()) {
      if (entry.expires <= now) {
        this.cache.delete(slug);
      }
    }
  }

  constructor() {
    // Cleanup every 10 minutes
    setInterval(() => this.cleanup(), 10 * 60 * 1000);
  }
}

export const familySlugCache = new FamilySlugCache();
```

### 2. Optimized SysAdmin Context Resolution

Replace the waterfall approach with a more efficient strategy:

```typescript
// app/api/utils/auth.ts - OPTIMIZED VERSION
import { familySlugCache } from '@/lib/cache';

async function getSysAdminFamilyContext(req: NextRequest): Promise<string | null> {
  // 1. URL path is most reliable and common - check first
  const pathname = new URL(req.url).pathname;
  const pathSegments = pathname.split('/').filter(Boolean);
  
  if (pathSegments.length > 0) {
    const familySlug = pathSegments[0];
    
    // Skip known system paths
    if (!['api', 'family-manager', 'setup', 'auth'].includes(familySlug)) {
      const familyId = await familySlugCache.getFamilyId(familySlug);
      if (familyId) return familyId;
    }
  }
  
  // 2. Check query parameters (for direct API calls)
  const { searchParams } = new URL(req.url);
  const familyId = searchParams.get('familyId');
  if (familyId) return familyId;
  
  // 3. Skip referer parsing - it's rarely needed and expensive
  // If needed, implement as a separate fallback function
  
  return null;
}

// Enhanced getAuthenticatedUser function
export async function getAuthenticatedUser(req: NextRequest): Promise<AuthResult> {
  try {
    // ... existing JWT verification logic ...
    
    // For sysadmins, use optimized family context resolution
    if (authResult.isSysAdmin) {
      const familyId = await getSysAdminFamilyContext(req);
      
      return {
        ...authResult,
        familyId: familyId || authResult.familyId
      };
    }
    
    // ... rest of existing logic ...
  } catch (error) {
    console.error('Authentication error:', error);
    return { authenticated: false, error: 'Authentication failed' };
  }
}
```

### 3. Request-Level Caching

Avoid repeated database lookups within the same request:

```typescript
// Enhanced AuthResult interface
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
  error?: string;
  
  // Request-level cache
  _requestCache?: {
    caretaker?: any;
    family?: any;
    timestamp: number;
  };
}

// Helper function for cached caretaker lookup
async function getCaretakerWithCache(
  caretakerId: string, 
  authResult: AuthResult
): Promise<any> {
  // Check request-level cache
  if (authResult._requestCache?.caretaker?.id === caretakerId) {
    return authResult._requestCache.caretaker;
  }
  
  // Query database
  const caretaker = await prisma.caretaker.findFirst({
    where: { id: caretakerId, deletedAt: null },
    include: { family: true }
  });
  
  // Cache for this request
  if (!authResult._requestCache) {
    authResult._requestCache = { timestamp: Date.now() };
  }
  authResult._requestCache.caretaker = caretaker;
  
  return caretaker;
}
```

### 4. Eliminate Redundant Business Logic Queries

Use Prisma's built-in error handling instead of separate existence checks:

```typescript
// BEFORE: Two queries
async function handlePut(req: NextRequest, authContext: AuthResult) {
  const { id, ...updateData } = await req.json();
  
  // Query #1: Check if exists
  const existingBaby = await prisma.baby.findFirst({
    where: { id, familyId: authContext.familyId }
  });
  
  if (!existingBaby) {
    return NextResponse.json({ error: 'Baby not found' }, { status: 404 });
  }
  
  // Query #2: Update
  const baby = await prisma.baby.update({
    where: { id },
    data: updateData
  });
  
  return NextResponse.json({ success: true, data: baby });
}

// AFTER: Single query with error handling
async function handlePut(req: NextRequest, authContext: AuthResult) {
  const { id, ...updateData } = await req.json();
  
  try {
    // Single query with family constraint
    const baby = await prisma.baby.update({
      where: { 
        id,
        familyId: authContext.familyId // Prisma will enforce this constraint
      },
      data: updateData
    });
    
    return NextResponse.json({ success: true, data: baby });
  } catch (error) {
    // Handle Prisma errors
    if (error.code === 'P2025') { // Record not found
      return NextResponse.json({ error: 'Baby not found' }, { status: 404 });
    }
    if (error.code === 'P2002') { // Unique constraint violation
      return NextResponse.json({ error: 'Duplicate entry' }, { status: 409 });
    }
    
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
```

### 5. Batch Database Operations

For endpoints that need multiple related queries, use transactions and includes:

```typescript
// BEFORE: Multiple separate queries
async function getBabyWithRecentActivities(babyId: string, familyId: string) {
  const baby = await prisma.baby.findFirst({
    where: { id: babyId, familyId }
  });
  
  const recentFeeds = await prisma.feedLog.findMany({
    where: { babyId, familyId },
    orderBy: { time: 'desc' },
    take: 5
  });
  
  const recentSleep = await prisma.sleepLog.findMany({
    where: { babyId, familyId },
    orderBy: { startTime: 'desc' },
    take: 5
  });
  
  return { baby, recentFeeds, recentSleep };
}

// AFTER: Single query with includes
async function getBabyWithRecentActivities(babyId: string, familyId: string) {
  return await prisma.baby.findFirst({
    where: { id: babyId, familyId },
    include: {
      feedLogs: {
        orderBy: { time: 'desc' },
        take: 5
      },
      sleepLogs: {
        orderBy: { startTime: 'desc' },
        take: 5
      }
    }
  });
}
```

## Implementation Plan

### Phase 1: Immediate Optimizations (Low Risk)
1. **Implement family slug caching** - Reduces sysadmin query overhead
2. **Add request-level caching** - Prevents duplicate lookups in same request
3. **Optimize business logic queries** - Replace existence checks with error handling

### Phase 2: Authentication Middleware Refactor (Medium Risk)
1. **Refactor sysadmin context resolution** - Streamline the lookup strategy
2. **Add performance monitoring** - Track query counts and response times
3. **Implement query result caching** - Cache frequently accessed data

### Phase 3: Advanced Optimizations (Higher Risk)
1. **Database connection pooling** - Optimize connection management
2. **Read replica support** - Separate read/write operations
3. **Redis caching layer** - External cache for session and lookup data

## Performance Metrics to Track

### Before Optimization (Current State)
- **Average API Response Time**: 200-300ms
- **Database Queries per Request**: 3-4 queries
- **SysAdmin Request Overhead**: 2-3 additional family lookups
- **Cache Hit Rate**: 0% (no caching)

### After Optimization (Target State)
- **Average API Response Time**: 50-100ms
- **Database Queries per Request**: 1-2 queries
- **SysAdmin Request Overhead**: 0-1 family lookups (cached)
- **Cache Hit Rate**: 80%+ for family slug lookups

## Monitoring and Alerting

Add performance monitoring to track the effectiveness of optimizations:

```typescript
// lib/monitoring.ts
interface PerformanceMetrics {
  endpoint: string;
  method: string;
  responseTime: number;
  queryCount: number;
  cacheHits: number;
  cacheMisses: number;
  timestamp: number;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  
  startRequest(endpoint: string, method: string) {
    return {
      endpoint,
      method,
      startTime: Date.now(),
      queryCount: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }
  
  endRequest(context: any) {
    const metric: PerformanceMetrics = {
      ...context,
      responseTime: Date.now() - context.startTime,
      timestamp: Date.now()
    };
    
    this.metrics.push(metric);
    
    // Alert on slow requests
    if (metric.responseTime > 500) {
      console.warn(`Slow API request: ${metric.endpoint} took ${metric.responseTime}ms`);
    }
    
    // Alert on high query count
    if (metric.queryCount > 3) {
      console.warn(`High query count: ${metric.endpoint} made ${metric.queryCount} queries`);
    }
  }
  
  getAverageResponseTime(endpoint?: string): number {
    const filtered = endpoint 
      ? this.metrics.filter(m => m.endpoint === endpoint)
      : this.metrics;
    
    return filtered.reduce((sum, m) => sum + m.responseTime, 0) / filtered.length;
  }
}

export const performanceMonitor = new PerformanceMonitor();
```

## Testing Strategy

### Performance Testing
1. **Load Testing**: Use tools like Artillery or k6 to simulate concurrent users
2. **Database Query Analysis**: Monitor Prisma query logs
3. **Memory Usage**: Track cache memory consumption
4. **Response Time Benchmarks**: Compare before/after optimization

### Regression Testing
1. **Authentication Flow Tests**: Ensure all auth scenarios still work
2. **Permission Tests**: Verify family-scoped access controls
3. **SysAdmin Tests**: Test cross-family access patterns
4. **Error Handling Tests**: Ensure proper error responses

## Conclusion

These optimizations should reduce API response times by 60-70% and significantly decrease database load. The improvements are particularly important before implementing the NextAuth system, as the additional authentication complexity will compound existing performance issues.

The optimizations maintain backward compatibility while providing a solid foundation for the upcoming account system implementation.

# Supabase Integration Plan: Hybrid Account System

This document outlines the integration of Supabase for account-level management while preserving the existing PIN-based caretaker system, including support for OAuth providers (Apple, Google, GitHub).

## Overview

The hybrid approach leverages Supabase Auth for family owners while maintaining the existing PIN system for caretakers, providing:

1. **OAuth Support**: Apple, Google, GitHub, and email/password authentication
2. **Zero Disruption**: Existing PIN-based caretakers continue unchanged
3. **Family Ownership**: Clear account → family ownership model
4. **SaaS Ready**: Built-in billing integration and enhanced features

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE AUTH                            │
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
│                    ACCOUNT SYSTEM                           │
│  - Account ID (Supabase user.id)                           │
│  - Email (from OAuth or direct)                            │
│  - Provider (apple/google/github/email)                    │
│  - Family Ownership                                        │
│  - Billing Integration                                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  EXISTING FAMILY SYSTEM                    │
│  - Family Structure (unchanged)                            │
│  - PIN-based Caretakers (unchanged)                        │
│  - All existing functionality preserved                    │
└─────────────────────────────────────────────────────────────┘
```

## Authentication Flow Hierarchy

### 1. Account Owner Authentication (New)
```
OAuth Provider → Supabase Auth → Account Lookup → Family Access
```
- **Providers**: Apple, Google, GitHub, Email/Password
- **Experience**: One-click login, no PIN required
- **Permissions**: Family owner privileges + billing access

### 2. Regular Caretaker Authentication (Unchanged)
```
Family Selection → PIN Entry → Caretaker Lookup → Family Access
```
- **Experience**: Existing PIN-based flow
- **Permissions**: Standard caretaker access
- **No Changes**: Zero disruption to current users

### 3. System Administrator (Unchanged)
```
Admin Password → System Access → Cross-Family Management
```
- **Experience**: Existing admin flow
- **Permissions**: Cross-family system management

## Database Schema Changes

### 1. Account Table (Supabase Managed)
```prisma
model Account {
  id          String   @id // Supabase auth.users.id
  email       String   @unique
  provider    String   // 'apple', 'google', 'github', 'email'
  verified    Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // Billing fields
  stripeId       String?
  subscriptionId String?
  planType       String?
  trialEnds      DateTime?
  
  // Family ownership (1:1)
  familyId    String?  @unique
  caretakerId String?  @unique
  
  // Relations
  family      Family?    @relation(fields: [familyId], references: [id])
  caretaker   Caretaker? @relation(fields: [caretakerId], references: [id])
  
  @@index([email])
  @@index([provider])
}
```

### 2. Update Existing Tables
```prisma
model Family {
  // ... existing fields unchanged
  
  // Add account ownership
  accountId String? @unique
  account   Account? @relation
  
  // ... existing relations unchanged
}

model Caretaker {
  // ... existing fields unchanged
  
  // Add optional account link
  accountId String? @unique
  account   Account? @relation
  
  // ... existing relations unchanged
}
```

## Supabase Configuration

### 1. Project Setup
```bash
# Create Supabase project
# Enable Auth providers in Supabase dashboard:
# - Apple OAuth
# - Google OAuth  
# - GitHub OAuth
# - Email/Password
```

### 2. OAuth Provider Configuration

#### Apple OAuth
```javascript
// Supabase Dashboard → Authentication → Providers → Apple
{
  "client_id": "your.app.bundle.id",
  "team_id": "YOUR_TEAM_ID",
  "key_id": "YOUR_KEY_ID",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
}
```

#### Google OAuth
```javascript
// Supabase Dashboard → Authentication → Providers → Google
{
  "client_id": "your-google-client-id.googleusercontent.com",
  "client_secret": "your-google-client-secret"
}
```

#### GitHub OAuth
```javascript
// Supabase Dashboard → Authentication → Providers → GitHub
{
  "client_id": "your-github-client-id",
  "client_secret": "your-github-client-secret"
}
```

### 3. Environment Variables
```bash
# .env
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Feature flags
ENABLE_ACCOUNT_SYSTEM="true"
ENABLE_OAUTH_PROVIDERS="true"

# OAuth redirect URLs
OAUTH_REDIRECT_URL="https://your-domain.com/auth/callback"
```

## Implementation Phases

### Phase 1: Supabase Infrastructure Setup
**Duration**: 1-2 weeks

1. **Supabase Project Creation**
   - Create Supabase project
   - Configure PostgreSQL database
   - Set up Row Level Security (RLS) policies

2. **Database Migration**
   - Migrate from SQLite to Supabase PostgreSQL
   - Add Account table to schema
   - Update existing tables with account relations

3. **OAuth Provider Setup**
   - Configure Apple, Google, GitHub OAuth apps
   - Set up redirect URLs and credentials
   - Test OAuth flows in Supabase dashboard

### Phase 2: Backend Integration
**Duration**: 2-3 weeks

1. **Supabase Client Setup**
   ```typescript
   // lib/supabase.ts
   import { createClient } from '@supabase/supabase-js'
   
   export const supabase = createClient(
     process.env.SUPABASE_URL!,
     process.env.SUPABASE_ANON_KEY!
   )
   
   export const supabaseAdmin = createClient(
     process.env.SUPABASE_URL!,
     process.env.SUPABASE_SERVICE_ROLE_KEY!
   )
   ```

2. **Enhanced Auth Middleware**
   ```typescript
   // app/api/utils/auth.ts - Enhanced version
   export async function getAuthenticatedUser(req: NextRequest): Promise<AuthResult> {
     // 1. Try Supabase auth first (account holders)
     const supabaseAuth = await getSupabaseAuth(req);
     if (supabaseAuth.authenticated) {
       return {
         ...supabaseAuth,
         authType: 'ACCOUNT',
         isAccountOwner: true
       };
     }
     
     // 2. Fall back to existing JWT/PIN system
     return getJWTAuth(req);
   }
   ```

3. **Account Management APIs**
   ```typescript
   // New API endpoints
   // app/api/accounts/profile/route.ts
   // app/api/accounts/claim-family/route.ts
   // app/api/accounts/billing/route.ts
   ```

### Phase 3: Frontend Account Features
**Duration**: 2-3 weeks

1. **OAuth Login Components**
   ```typescript
   // components/auth/OAuthLogin.tsx
   const OAuthLogin = () => {
     const handleOAuthLogin = async (provider: 'apple' | 'google' | 'github') => {
       const { error } = await supabase.auth.signInWithOAuth({
         provider,
         options: {
           redirectTo: `${window.location.origin}/auth/callback`
         }
       });
     };
     
     return (
       <div className="oauth-buttons">
         <button onClick={() => handleOAuthLogin('apple')}>
           Continue with Apple
         </button>
         <button onClick={() => handleOAuthLogin('google')}>
           Continue with Google
         </button>
         <button onClick={() => handleOAuthLogin('github')}>
           Continue with GitHub
         </button>
       </div>
     );
   };
   ```

2. **Account Dashboard**
   ```typescript
   // components/account/AccountDashboard.tsx
   const AccountDashboard = () => {
     const { user } = useAuth();
     
     return (
       <div className="account-dashboard">
         <FamilySettings />
         <CaretakerManagement />
         <BillingSection />
         <DataExport />
       </div>
     );
   };
   ```

3. **Family Claiming Flow**
   ```typescript
   // components/account/FamilyClaiming.tsx
   const FamilyClaiming = () => {
     const claimFamily = async (familySlug: string, adminPin: string) => {
       const response = await fetch('/api/accounts/claim-family', {
         method: 'POST',
         body: JSON.stringify({ familySlug, adminPin })
       });
     };
   };
   ```

### Phase 4: Enhanced Features & Billing
**Duration**: 2-3 weeks

1. **Stripe Integration**
   ```typescript
   // lib/stripe.ts
   import Stripe from 'stripe';
   
   export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
     apiVersion: '2023-10-16'
   });
   
   // Account-based billing
   export async function createCustomer(account: Account) {
     return await stripe.customers.create({
       email: account.email,
       metadata: {
         accountId: account.id,
         familyId: account.familyId
       }
     });
   }
   ```

2. **Account-Only Features**
   - Enhanced family settings
   - Advanced data analytics
   - Priority support access
   - Custom family branding

## OAuth Provider Implementation Details

### Apple Sign-In
```typescript
// components/auth/AppleSignIn.tsx
const AppleSignIn = () => {
  const handleAppleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'name email'
      }
    });
    
    if (error) console.error('Apple sign-in error:', error);
  };
  
  return (
    <button 
      onClick={handleAppleSignIn}
      className="apple-signin-btn"
    >
      <AppleIcon />
      Continue with Apple
    </button>
  );
};
```

### Google Sign-In
```typescript
// components/auth/GoogleSignIn.tsx
const GoogleSignIn = () => {
  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'email profile'
      }
    });
    
    if (error) console.error('Google sign-in error:', error);
  };
  
  return (
    <button 
      onClick={handleGoogleSignIn}
      className="google-signin-btn"
    >
      <GoogleIcon />
      Continue with Google
    </button>
  );
};
```

### GitHub Sign-In
```typescript
// components/auth/GitHubSignIn.tsx
const GitHubSignIn = () => {
  const handleGitHubSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'user:email'
      }
    });
    
    if (error) console.error('GitHub sign-in error:', error);
  };
  
  return (
    <button 
      onClick={handleGitHubSignIn}
      className="github-signin-btn"
    >
      <GitHubIcon />
      Continue with GitHub
    </button>
  );
};
```

## Authentication Callback Handling

```typescript
// app/auth/callback/page.tsx
export default function AuthCallback() {
  useEffect(() => {
    const handleAuthCallback = async () => {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Auth callback error:', error);
        router.push('/login?error=auth_failed');
        return;
      }
      
      if (data.session) {
        // Check if account exists in our system
        const account = await fetchAccount(data.session.user.id);
        
        if (account && account.familyId) {
          // Existing account with family - direct access
          router.push(`/${account.family.slug}`);
        } else {
          // New account - needs family setup or claiming
          router.push('/account/setup');
        }
      }
    };
    
    handleAuthCallback();
  }, []);
  
  return <div>Completing sign-in...</div>;
}
```

## Account Setup Flow

### New Account → New Family
```typescript
// app/account/setup/page.tsx
const AccountSetup = () => {
  const [step, setStep] = useState<'family' | 'caretaker' | 'complete'>('family');
  
  const createFamilyAndAccount = async (familyData: FamilyData) => {
    // 1. Create family
    const family = await createFamily(familyData);
    
    // 2. Create admin caretaker
    const caretaker = await createCaretaker({
      ...caretakerData,
      familyId: family.id,
      role: 'ADMIN'
    });
    
    // 3. Link account to family and caretaker
    await linkAccountToFamily(user.id, family.id, caretaker.id);
    
    // 4. Redirect to family dashboard
    router.push(`/${family.slug}`);
  };
};
```

### Existing Account → Claim Family
```typescript
// app/account/claim/page.tsx
const FamilyClaim = () => {
  const claimExistingFamily = async (familySlug: string, adminPin: string) => {
    const response = await fetch('/api/accounts/claim-family', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familySlug, adminPin })
    });
    
    if (response.ok) {
      router.push(`/${familySlug}`);
    }
  };
};
```

## Security Considerations

### Row Level Security (RLS)
```sql
-- Supabase RLS policies
CREATE POLICY "Users can only access their own account data" 
ON accounts FOR ALL 
USING (auth.uid() = id);

CREATE POLICY "Account owners can access their family data" 
ON families FOR ALL 
USING (account_id = auth.uid());
```

### API Security
```typescript
// Middleware to verify Supabase JWT
export async function verifySupabaseAuth(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  
  if (!token) return null;
  
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  
  if (error || !user) return null;
  
  return user;
}
```

## Benefits of This Approach

### 1. **Seamless OAuth Integration**
- One-click login with popular providers
- No password management for users
- Secure, industry-standard authentication

### 2. **Zero Disruption to Existing Users**
- PIN-based caretakers continue unchanged
- No forced migration required
- Gradual adoption possible

### 3. **Enhanced Security**
- Supabase handles OAuth complexity
- Built-in security best practices
- Regular security updates

### 4. **SaaS Ready**
- Clear account → billing relationship
- Professional onboarding experience
- Scalable authentication infrastructure

### 5. **Developer Experience**
- Supabase handles auth complexity
- Built-in user management
- Real-time subscriptions available

## Migration Strategy

### For New Deployments
1. Set up Supabase from the start
2. Configure OAuth providers
3. Enable account system features

### For Existing Deployments
1. **Phase 1**: Set up Supabase alongside existing system
2. **Phase 2**: Migrate database to Supabase PostgreSQL
3. **Phase 3**: Enable account features for new users
4. **Phase 4**: Allow existing admin caretakers to claim families

## Testing Strategy

### OAuth Provider Testing
```typescript
// Test each OAuth provider
describe('OAuth Authentication', () => {
  test('Apple OAuth flow', async () => {
    // Test Apple sign-in flow
  });
  
  test('Google OAuth flow', async () => {
    // Test Google sign-in flow
  });
  
  test('GitHub OAuth flow', async () => {
    // Test GitHub sign-in flow
  });
});
```

### Integration Testing
```typescript
// Test hybrid auth system
describe('Hybrid Authentication', () => {
  test('Account holder direct access', async () => {
    // Test account → family access
  });
  
  test('Caretaker PIN access unchanged', async () => {
    // Test existing PIN flow still works
  });
  
  test('Family claiming process', async () => {
    // Test account claiming existing family
  });
});
```

This integration plan provides a comprehensive roadmap for implementing Supabase Auth with OAuth providers while maintaining the existing PIN-based system, ensuring a smooth transition to a SaaS-ready architecture.

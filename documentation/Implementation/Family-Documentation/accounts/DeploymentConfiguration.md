# Deployment Configuration: Self-Hosted vs SaaS

This document outlines the configuration differences between self-hosted and SaaS deployments of the baby tracker application, including environment variables, feature toggles, and deployment-specific considerations.

## Deployment Modes

The application supports two primary deployment modes:

1. **Self-Hosted Mode**: Single family or organization deployment
2. **SaaS Mode**: Multi-tenant platform with account management and billing

## Environment Variables

### Core Configuration

```bash
# .env file

# =============================================================================
# DEPLOYMENT MODE CONFIGURATION
# =============================================================================

# Deployment mode: 'selfhosted' or 'saas'
DEPLOYMENT_MODE=selfhosted

# Application URL (used for redirects, emails, etc.)
APP_URL=http://localhost:3000

# =============================================================================
# DATABASE CONFIGURATION
# =============================================================================

# Database provider: 'sqlite' or 'postgresql'
DATABASE_PROVIDER=sqlite

# SQLite (Development/Self-hosted)
DATABASE_URL="file:../db/baby-tracker.db"

# PostgreSQL (Production/SaaS) - uncomment and configure for production
# DATABASE_URL="postgresql://username:password@localhost:5432/baby_tracker_prod"

# PostgreSQL Connection Pool (Production only)
# DATABASE_CONNECTION_LIMIT=10
# DATABASE_POOL_TIMEOUT=20

# Database migration settings
# AUTO_MIGRATE_ON_START=false  # Set to true for development only

# =============================================================================
# AUTHENTICATION & SECURITY
# =============================================================================

# JWT Secret for regular user authentication
JWT_SECRET=your-jwt-secret-here

# System administrator secret (for cross-family management)
SUPER_ADMIN_SECRET=your-super-admin-secret-here

# Authentication token lifetime in seconds (default: 30 minutes)
AUTH_LIFE=1800

# Idle timeout in seconds (default: 30 minutes)
IDLE_TIME=1800

# Cookie security settings
COOKIE_SECURE=false

# =============================================================================
# ACCOUNT SYSTEM (SaaS MODE ONLY)
# =============================================================================

# Enable account-based authentication
ENABLE_ACCOUNTS=false

# Account registration settings
ALLOW_ACCOUNT_REGISTRATION=false
REQUIRE_EMAIL_VERIFICATION=false

# Password requirements
MIN_PASSWORD_LENGTH=8
REQUIRE_PASSWORD_COMPLEXITY=false

# =============================================================================
# EMAIL CONFIGURATION (SaaS MODE)
# =============================================================================

# Email service provider
EMAIL_PROVIDER=smtp

# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Sending email addresses
FROM_EMAIL=noreply@your-domain.com
SUPPORT_EMAIL=support@your-domain.com

# =============================================================================
# BILLING INTEGRATION (SaaS MODE)
# =============================================================================

# Stripe configuration
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Subscription plans
STRIPE_BASIC_PLAN_ID=price_basic_plan_id
STRIPE_PREMIUM_PLAN_ID=price_premium_plan_id
STRIPE_ENTERPRISE_PLAN_ID=price_enterprise_plan_id

# =============================================================================
# FEATURE FLAGS
# =============================================================================

# Family management features
ENABLE_MULTI_FAMILY=false
ENABLE_FAMILY_INVITATIONS=false

# Advanced features
ENABLE_CALENDAR=true
ENABLE_MEDICINE_TRACKING=true
ENABLE_CONTACT_MANAGEMENT=true

# Data export features
ENABLE_DATA_EXPORT=true
ENABLE_PDF_REPORTS=false

# =============================================================================
# MONITORING & ANALYTICS
# =============================================================================

# Application monitoring
SENTRY_DSN=your-sentry-dsn
ENABLE_ANALYTICS=false

# Performance monitoring
ENABLE_PERFORMANCE_MONITORING=false
```

## Mode-Specific Configurations

### Self-Hosted Mode (.env.selfhosted)

```bash
# Self-hosted deployment configuration
DEPLOYMENT_MODE=selfhosted
APP_URL=https://your-domain.com

# Authentication
ENABLE_ACCOUNTS=false
ALLOW_ACCOUNT_REGISTRATION=false

# Features
ENABLE_MULTI_FAMILY=false
ENABLE_FAMILY_INVITATIONS=false

# No billing integration needed
# STRIPE_* variables not required

# Email optional (only needed for notifications)
EMAIL_PROVIDER=none

```

### SaaS Mode (.env.saas)

```bash
# SaaS deployment configuration
DEPLOYMENT_MODE=saas
APP_URL=https://your-saas-domain.com

# PostgreSQL for production
DATABASE_PROVIDER=postgresql
DATABASE_URL=postgresql://baby_tracker_user:secure_password@prod-db:5432/baby_tracker_prod
DATABASE_CONNECTION_LIMIT=20
DATABASE_POOL_TIMEOUT=30

# Account system enabled
ENABLE_ACCOUNTS=true
ALLOW_ACCOUNT_REGISTRATION=true
REQUIRE_EMAIL_VERIFICATION=true

# Multi-family features
ENABLE_MULTI_FAMILY=true
ENABLE_FAMILY_INVITATIONS=true

# Billing integration required
STRIPE_PUBLISHABLE_KEY=pk_live_your_live_key
STRIPE_SECRET_KEY=sk_live_your_live_key
STRIPE_WEBHOOK_SECRET=whsec_your_live_webhook

# Email required for account management
EMAIL_PROVIDER=smtp
REQUIRE_EMAIL_VERIFICATION=true

# Enhanced security
REQUIRE_PASSWORD_COMPLEXITY=true
COOKIE_SECURE=true

# Monitoring enabled
ENABLE_ANALYTICS=true
ENABLE_PERFORMANCE_MONITORING=true
```

## Database Setup

### SQLite (Development/Self-hosted)

SQLite requires no additional setup and works out of the box:

```bash
# .env
DATABASE_PROVIDER=sqlite
DATABASE_URL="file:../db/baby-tracker.db"
```

### PostgreSQL (Production/SaaS)

For production deployments, PostgreSQL is recommended for better performance and concurrent access.

#### 1. Environment Configuration

```bash
# .env.production
DATABASE_PROVIDER=postgresql
DATABASE_URL="postgresql://username:password@localhost:5432/baby_tracker_prod"
DATABASE_CONNECTION_LIMIT=10
DATABASE_POOL_TIMEOUT=20
```

#### 2. Prisma Schema Update

Update `prisma/schema.prisma` to conditionally use PostgreSQL:

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = env("DATABASE_PROVIDER")
  url      = env("DATABASE_URL")
}
```

#### 3. Database Migration for PostgreSQL

When switching to PostgreSQL, you'll need to:

1. **Create the PostgreSQL database:**
   ```sql
   CREATE DATABASE baby_tracker_prod;
   CREATE USER baby_tracker_user WITH PASSWORD 'secure_password';
   GRANT ALL PRIVILEGES ON DATABASE baby_tracker_prod TO baby_tracker_user;
   ```

2. **Generate new migrations for PostgreSQL:**
   ```bash
   # Remove existing SQLite migrations (backup first!)
   rm -rf prisma/migrations/*
   
   # Generate fresh migrations for PostgreSQL
   npx prisma migrate dev --name init
   ```

3. **Or migrate existing data:**
   ```bash
   # Export data from SQLite
   npx prisma db pull --schema=prisma/schema.sqlite.prisma
   
   # Import to PostgreSQL (custom script needed)
   node scripts/migrate-sqlite-to-postgres.js
   ```

#### 4. Docker PostgreSQL Setup

For containerized deployments:

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: baby_tracker_prod
      POSTGRES_USER: baby_tracker_user
      POSTGRES_PASSWORD: secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
      
  app:
    build: .
    environment:
      DATABASE_PROVIDER: postgresql
      DATABASE_URL: postgresql://baby_tracker_user:secure_password@postgres:5432/baby_tracker_prod
    depends_on:
      - postgres

volumes:
  postgres_data:
```

### Database Connection Handling

The existing `prisma/db.ts` file will work with both SQLite and PostgreSQL without changes:

```typescript
// prisma/db.ts - No changes needed!
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['error'],
});

export default prisma;
```

### Environment-Specific Database URLs

For different environments:

```bash
# Development
DATABASE_URL="file:../db/baby-tracker.db"

# Staging  
DATABASE_URL="postgresql://user:pass@staging-db:5432/baby_tracker_staging"

# Production
DATABASE_URL="postgresql://user:pass@prod-db:5432/baby_tracker_prod"
```

## Application Behavior Changes

### Homepage Routing

The homepage behavior changes based on deployment mode:

```typescript
// app/page.tsx
export default function HomePage() {
  const deploymentMode = process.env.DEPLOYMENT_MODE;
  
  if (deploymentMode === 'saas') {
    // SaaS mode: Show marketing page or account login
    return <SaaSHomePage />;
  } else {
    // Self-hosted mode: Direct to family login/setup
    return <SelfHostedHomePage />;
  }
}
```

### Authentication Flow

```typescript
// Different auth components based on mode
const getAuthComponent = () => {
  if (process.env.ENABLE_ACCOUNTS === 'true') {
    return <AccountLogin />; // Email/password + PIN option
  } else {
    return <PinLogin />;     // PIN only
  }
};
```

### Feature Availability

```typescript
// Feature flags control UI elements
const FeatureWrapper = ({ feature, children }) => {
  const isEnabled = process.env[`ENABLE_${feature.toUpperCase()}`] === 'true';
  return isEnabled ? children : null;
};

// Usage
<FeatureWrapper feature="calendar">
  <CalendarComponent />
</FeatureWrapper>
```

## Database Considerations

### Self-Hosted
- SQLite database (file-based)
- Single database file
- Automatic backups to local filesystem
- No scaling concerns for single family

### SaaS
- PostgreSQL or MySQL (recommended)
- Connection pooling
- Database backups to cloud storage
- Horizontal scaling considerations
- Row-level security for data isolation

## Security Differences

### Self-Hosted
- Simplified security model
- Admin access through system PIN
- Local file-based sessions
- Basic rate limiting

### SaaS
- Enhanced security requirements
- Account-based permissions
- Secure session management
- Advanced rate limiting
- GDPR compliance features
- Audit logging

## Deployment Scripts

### Self-Hosted Setup Script

```bash
#!/bin/bash
# scripts/setup-selfhosted.sh

echo "Setting up self-hosted baby tracker..."

# Copy self-hosted environment
cp .env.selfhosted .env

# Generate secrets
JWT_SECRET=$(openssl rand -base64 32)
SUPER_ADMIN_SECRET=$(openssl rand -base64 32)

# Update .env file
sed -i "s/your-jwt-secret-here/$JWT_SECRET/" .env
sed -i "s/your-super-admin-secret-here/$SUPER_ADMIN_SECRET/" .env

# Setup database
npx prisma migrate deploy
npx prisma generate

# Create initial admin
node scripts/create-initial-admin.js

echo "Self-hosted setup complete!"
```

### SaaS Setup Script

```bash
#!/bin/bash
# scripts/setup-saas.sh

echo "Setting up SaaS baby tracker..."

# Copy SaaS environment
cp .env.saas .env

# Generate secrets (user must provide Stripe keys)
JWT_SECRET=$(openssl rand -base64 32)
SUPER_ADMIN_SECRET=$(openssl rand -base64 32)

# Update .env file
sed -i "s/your-jwt-secret-here/$JWT_SECRET/" .env
sed -i "s/your-super-admin-secret-here/$SUPER_ADMIN_SECRET/" .env

echo "Please update .env with your Stripe keys and SMTP settings"
echo "Then run: npm run setup:saas:finalize"

echo "SaaS setup initialized!"
```

## Configuration Validation

```typescript
// lib/config-validator.ts
export function validateConfiguration() {
  const mode = process.env.DEPLOYMENT_MODE;
  
  if (mode === 'saas') {
    // Validate SaaS requirements
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY required for SaaS mode');
    }
    
    if (!process.env.SMTP_HOST && process.env.REQUIRE_EMAIL_VERIFICATION === 'true') {
      throw new Error('SMTP configuration required when email verification is enabled');
    }
  }
  
  // Validate common requirements
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
  }
  
  console.log(`Configuration validated for ${mode} mode`);
}
```

## Monitoring and Analytics

### Self-Hosted
- Optional basic monitoring
- Local log files
- Simple health checks

### SaaS
- Comprehensive monitoring required
- User analytics and usage tracking
- Performance monitoring
- Error tracking with Sentry
- Business metrics dashboard

## Backup Strategies

### Self-Hosted
```bash
# Simple SQLite backup
cp data/baby-tracker.db backups/baby-tracker-$(date +%Y%m%d).db
```

### SaaS
```bash
# PostgreSQL backup with encryption
pg_dump $DATABASE_URL | gpg --encrypt > backups/backup-$(date +%Y%m%d).sql.gpg
```

## Environment-Specific Components

### Marketing Pages (SaaS only)
- Landing page with pricing
- Feature comparison
- Customer testimonials
- Account registration forms

### Admin Interface
- Self-hosted: Simple family management
- SaaS: Multi-tenant admin dashboard with analytics

This configuration approach allows the same codebase to serve both deployment modes while optimizing the experience for each use case. 
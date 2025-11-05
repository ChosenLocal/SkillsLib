# 🔐 Authentication Setup Guide

This guide explains how to enable and configure authentication for production deployment.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [OAuth Provider Setup](#oauth-provider-setup)
4. [Enabling Authentication](#enabling-authentication)
5. [Testing Authentication](#testing-authentication)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before enabling authentication, ensure you have:

- [ ] Production database configured
- [ ] Redis instance running
- [ ] Production domain with SSL/TLS
- [ ] OAuth provider accounts (Google, GitHub)

---

## Environment Variables

### Required Variables

#### API Server (`apps/api/.env`)

```bash
# Node Environment
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Redis
REDIS_URL=redis://host:6379

# Authentication
DISABLE_AUTH=false  # CRITICAL: Must be false in production
NEXTAUTH_SECRET=<your-production-secret>  # Generate with: openssl rand -base64 64

# API Configuration
API_PORT=3001
CORS_ORIGIN=https://app.yourcompany.com  # Your production frontend URL
```

#### Web App (`apps/web/.env`)

```bash
# Node Environment
NODE_ENV=production

# Database (for server-side queries)
DATABASE_URL=postgresql://user:password@host:5432/database

# NextAuth Configuration
NEXTAUTH_SECRET=<same-as-api-server>  # Must match API server secret
NEXTAUTH_URL=https://app.yourcompany.com

# API URLs
NEXT_PUBLIC_APP_URL=https://app.yourcompany.com
NEXT_PUBLIC_API_URL=https://api.yourcompany.com/trpc

# Authentication
DISABLE_AUTH=false  # CRITICAL: Must be false in production
NEXT_PUBLIC_DISABLE_AUTH=false  # CRITICAL: Must be false in production

# OAuth Providers
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

### Generating Secrets

```bash
# Generate NEXTAUTH_SECRET (use the same value in both API and Web)
openssl rand -base64 64

# Example output:
# h+BHQx9Cu9j3Q5lnOFZDUrBPP2rzHPmVYxSPEJ475f8=cRtK...

# Copy this value to both:
# - apps/api/.env -> NEXTAUTH_SECRET=
# - apps/web/.env -> NEXTAUTH_SECRET=
```

---

## OAuth Provider Setup

### Google OAuth Setup

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com

2. **Create or Select a Project**
   - Create a new project or select an existing one

3. **Enable Google+ API**
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it

4. **Create OAuth Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Application type: "Web application"
   - Name: Your app name (e.g., "Business Automation Platform")

5. **Configure Authorized Redirect URIs**
   Add these URLs:
   ```
   http://localhost:3000/api/auth/callback/google  (for local testing)
   https://app.yourcompany.com/api/auth/callback/google  (for production)
   ```

6. **Save Credentials**
   - Copy the "Client ID" and "Client secret"
   - Add to your `.env` file:
     ```
     GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
     GOOGLE_CLIENT_SECRET=xxx-xxx-xxx
     ```

---

### GitHub OAuth Setup

1. **Go to GitHub Settings**
   - Visit: https://github.com/settings/developers

2. **Create New OAuth App**
   - Click "New OAuth App"
   - Application name: Your app name
   - Homepage URL: `https://app.yourcompany.com`
   - Authorization callback URL: `https://app.yourcompany.com/api/auth/callback/github`

3. **Save Credentials**
   - Copy the "Client ID"
   - Generate a new "Client secret"
   - Add to your `.env` file:
     ```
     GITHUB_CLIENT_ID=xxx
     GITHUB_CLIENT_SECRET=xxx
     ```

---

## Enabling Authentication

### Step 1: Update Environment Variables

**In both API and Web `.env` files**:

```bash
# Remove or set to false
DISABLE_AUTH=false
NEXT_PUBLIC_DISABLE_AUTH=false  # Web only

# DO NOT SET THESE IN PRODUCTION:
# MOCK_TENANT_ID=...  <- Remove this line
```

### Step 2: Verify Production Safety Checks

The following checks will automatically prevent deployment with auth disabled:

**API Server** (`apps/api/src/server.ts`):
```typescript
if (process.env.NODE_ENV === 'production' && process.env.DISABLE_AUTH === 'true') {
  console.error('🚨 CRITICAL SECURITY ERROR');
  process.exit(1);
}
```

**Web App** (`apps/web/middleware.ts`):
```typescript
if (process.env.NODE_ENV === 'production' && process.env.DISABLE_AUTH === 'true') {
  throw new Error('DISABLE_AUTH must be false in production');
}
```

### Step 3: Test Locally with Auth Enabled

```bash
# 1. Update local .env files
cd apps/api
echo "DISABLE_AUTH=false" > .env.local

cd ../apps/web
echo "DISABLE_AUTH=false" >> .env.local
echo "NEXT_PUBLIC_DISABLE_AUTH=false" >> .env.local

# 2. Restart servers
# Kill current servers (Ctrl+C)

# Start API
cd apps/api
pnpm dev

# Start Web (in another terminal)
cd apps/web
pnpm dev

# 3. Test authentication
# Visit http://localhost:3000
# Try to register a new user
# Verify login works
```

### Step 4: Run Auth Tests

```bash
# Run auth tests with auth enabled
DISABLE_AUTH=false pnpm test:auth

# Expected: All tests should pass
# If tests fail, DO NOT deploy to production
```

---

## Testing Authentication

### Manual Testing Checklist

- [ ] **Registration Flow**
  - Register a new user with email/password
  - Verify user is created in database
  - Verify user is logged in after registration

- [ ] **Login Flow**
  - Logout after registration
  - Login with email/password
  - Verify redirected to dashboard

- [ ] **OAuth Flow (Google)**
  - Click "Continue with Google"
  - Complete Google OAuth
  - Verify user is logged in
  - Verify user data is saved

- [ ] **OAuth Flow (GitHub)**
  - Click "Continue with GitHub"
  - Complete GitHub OAuth
  - Verify user is logged in

- [ ] **Protected Routes**
  - Logout
  - Try to access `/dashboard` directly
  - Verify redirected to login page

- [ ] **Session Persistence**
  - Login
  - Reload page
  - Verify still logged in

- [ ] **Logout**
  - Click logout
  - Verify redirected to home
  - Verify cannot access dashboard

- [ ] **API Authentication**
  - Try to call API without token (should return 401)
  - Login and call API (should work)

---

## Testing Tenant Isolation

```bash
# 1. Create two test users
User A: usera@test.com (in TenantA)
User B: userb@test.com (in TenantB)

# 2. Login as User A
# 3. Create a project
# 4. Logout

# 5. Login as User B
# 6. Try to access User A's project
# Expected: Should NOT see User A's project

# 7. Verify in database
psql $DATABASE_URL
SELECT id, email, "tenantId" FROM users;
SELECT id, name, "tenantId" FROM projects;

# Verify projects are scoped to correct tenant
```

---

## Troubleshooting

### Issue: "Authentication is DISABLED" warning in production

**Cause**: `DISABLE_AUTH=true` in production environment

**Fix**:
```bash
# Update production environment variables
DISABLE_AUTH=false
NEXT_PUBLIC_DISABLE_AUTH=false

# Redeploy application
```

---

### Issue: OAuth "redirect_uri_mismatch" error

**Cause**: OAuth callback URL not configured correctly

**Fix**:
1. Go to OAuth provider settings (Google/GitHub)
2. Add production callback URL:
   - Google: `https://app.yourcompany.com/api/auth/callback/google`
   - GitHub: `https://app.yourcompany.com/api/auth/callback/github`
3. Save and redeploy

---

### Issue: "Invalid JWT" errors

**Cause**: JWT secret mismatch between API and Web

**Fix**:
```bash
# Ensure NEXTAUTH_SECRET is IDENTICAL in both:
# apps/api/.env
# apps/web/.env

# Generate a new secret if needed:
openssl rand -base64 64

# Update both files with the same value
# Restart both servers
```

---

### Issue: Users can see other tenants' data

**Cause**: Tenant isolation not working correctly

**Fix**:
1. Check middleware sets tenant context:
   ```typescript
   // apps/web/middleware.ts
   response.headers.set('x-tenant-id', session.user.tenantId);
   ```

2. Check API uses tenant context:
   ```typescript
   // All Prisma queries should filter by tenantId
   await prisma.project.findMany({
     where: { tenantId: ctx.user.tenantId }
   });
   ```

3. Run tenant isolation tests
4. Verify RLS policies in database

---

### Issue: Infinite redirect loop

**Cause**: Middleware redirect logic issue

**Fix**:
1. Check middleware public routes:
   ```typescript
   const publicRoutes = ['/', '/register', '/api/auth'];
   ```
2. Ensure auth pages redirect to dashboard when logged in
3. Clear cookies and try again

---

## Verification Commands

```bash
# 1. Check no DISABLE_AUTH=true in production
grep -r "DISABLE_AUTH.*true" .env.production* apps/*/src/

# 2. Verify production safety checks exist
grep "DISABLE_AUTH.*production" apps/api/src/server.ts
grep "DISABLE_AUTH.*production" apps/web/middleware.ts

# 3. Run all tests
pnpm test

# 4. Build for production
pnpm build

# 5. Check no console warnings about disabled auth
# (Start servers and check logs)
```

---

## Weekly Auth Health Checks

Even when developing with `DISABLE_AUTH=true` locally, run these checks weekly:

```bash
# Run the auth testing script
./scripts/test-with-auth.sh

# This will:
# 1. Temporarily enable auth
# 2. Run auth tests
# 3. Restore DISABLE_AUTH setting
# 4. Report any failures
```

---

## Support

If you encounter issues not covered in this guide:

1. Check the [Pre-Launch Checklist](../PRE_LAUNCH_CHECKLIST.md)
2. Review auth test results in CI/CD
3. Check server logs for specific errors
4. Contact the technical lead

---

## Summary

### Before Production Deployment:

✅ Set `DISABLE_AUTH=false` in all production env files
✅ Configure OAuth providers (Google, GitHub)
✅ Generate strong `NEXTAUTH_SECRET` (same in API and Web)
✅ Set correct production URLs
✅ Run auth tests with `DISABLE_AUTH=false`
✅ Complete manual testing checklist
✅ Verify tenant isolation
✅ Complete [Pre-Launch Checklist](../PRE_LAUNCH_CHECKLIST.md)

---

**Last Updated**: 2025-11-04
**Version**: 1.0.0

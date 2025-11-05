# 🚀 Pre-Launch Checklist

**IMPORTANT**: Complete ALL items in this checklist before deploying to production.

## 🔒 Critical Security Items

### 1. Authentication Configuration
- [ ] **DISABLE_AUTH** is set to `false` in production `.env`
- [ ] **NEXT_PUBLIC_DISABLE_AUTH** is set to `false` or removed
- [ ] **NEXTAUTH_SECRET** is a strong, production-grade secret (64+ characters)
  - Generate with: `openssl rand -base64 64`
  - Never reuse development secrets
- [ ] **NEXTAUTH_URL** is set to production domain (e.g., `https://app.yourcompany.com`)

### 2. OAuth Providers
- [ ] **Google OAuth** credentials configured
  - `GOOGLE_CLIENT_ID` set
  - `GOOGLE_CLIENT_SECRET` set
  - Authorized redirect URIs include production domain
- [ ] **GitHub OAuth** credentials configured (if using)
  - `GITHUB_CLIENT_ID` set
  - `GITHUB_CLIENT_SECRET` set
  - Authorization callback URL updated

### 3. API Keys & Secrets
- [ ] All API keys are production keys (not development/test keys)
- [ ] **DATABASE_URL** points to production database
- [ ] **REDIS_URL** points to production Redis instance
- [ ] **CLAUDE_API_KEY** / **ANTHROPIC_API_KEY** are production keys
- [ ] No secrets are hardcoded in source code
- [ ] All secrets are stored in secure environment variable management (Vercel, AWS Secrets Manager, etc.)

### 4. CORS & Security
- [ ] **CORS_ORIGIN** is set to production frontend URL only
- [ ] **RATE_LIMIT_WINDOW_MS** and **RATE_LIMIT_MAX_REQUESTS** are appropriate for production
- [ ] Helmet security headers are enabled (already configured)
- [ ] **NODE_ENV** is set to `production`

---

## ✅ Authentication & Authorization Testing

### 5. Authentication Flow
- [ ] User registration works with real email
- [ ] Email verification works (if implemented)
- [ ] Password reset flow works
- [ ] OAuth login works (Google, GitHub)
- [ ] Session persistence works across page reloads
- [ ] Session expiration works correctly (30-day timeout)
- [ ] Logout works and clears session

### 6. Authorization & Tenant Isolation
- [ ] Users can only see their own tenant's data
- [ ] **OWNER** role can access admin endpoints
- [ ] **ADMIN** role can access admin endpoints
- [ ] **MEMBER** role cannot access admin endpoints
- [ ] Cross-tenant data leakage test passed:
  - Create User A in Tenant A
  - Create User B in Tenant B
  - Verify User A cannot see User B's projects/data
- [ ] Row-Level Security (RLS) is enforced in database queries

### 7. Protected Endpoints
- [ ] All `protectedProcedure` endpoints return 401 without valid JWT
- [ ] All `adminProcedure` endpoints return 403 for MEMBER role
- [ ] All `ownerProcedure` endpoints return 403 for non-OWNER roles
- [ ] Invalid JWT tokens are rejected
- [ ] Expired JWT tokens are rejected

---

## 🧪 Testing

### 8. Automated Tests
- [ ] All Playwright tests pass with `DISABLE_AUTH=false`
- [ ] Auth E2E tests pass (from `tests/auth/full-flow.spec.ts`)
- [ ] API integration tests pass
- [ ] No failing tests in CI/CD pipeline

### 9. Manual Testing
- [ ] Complete user registration flow manually
- [ ] Complete OAuth login flow manually
- [ ] Create a project as OWNER
- [ ] Try to access admin page as MEMBER (should fail)
- [ ] Logout and verify cannot access protected pages

---

## 🗄️ Database & Infrastructure

### 10. Database
- [ ] Production database is backed up
- [ ] Database migrations have been run
- [ ] Database connection pooling is configured
- [ ] `pgvector` extension is enabled (if using)
- [ ] Row-Level Security policies are enabled

### 11. Redis & Caching
- [ ] Redis is running in production
- [ ] Redis persistence is enabled (RDB or AOF)
- [ ] Redis connection limits are appropriate

### 12. Monitoring & Logging
- [ ] Error tracking is set up (Sentry, etc.)
- [ ] Performance monitoring is configured (Datadog, New Relic, etc.)
- [ ] Log aggregation is set up (CloudWatch, Logtail, etc.)
- [ ] Alerts are configured for:
  - Server errors (500s)
  - High error rates
  - Authentication failures
  - Database connection failures

---

## 🚀 Deployment

### 13. Environment Variables
- [ ] All production environment variables are set in deployment platform
- [ ] No development/test values in production env vars
- [ ] Sensitive values are encrypted at rest
- [ ] Environment variables are documented in `.env.example`

### 14. Deployment Platform
- [ ] Health check endpoint is configured: `/health`
- [ ] Auto-scaling is configured (if needed)
- [ ] SSL/TLS certificates are valid
- [ ] Domain DNS is pointing to production servers
- [ ] CDN is configured (if using)

### 15. Final Checks
- [ ] Run `pnpm build` locally to verify build succeeds
- [ ] Run `pnpm test` to verify all tests pass
- [ ] Check that no `console.warn` about disabled auth appears in production logs
- [ ] Verify production deployment does not accept `DISABLE_AUTH=true`
  - Test: Set `DISABLE_AUTH=true` in production and verify server refuses to start

---

## 📚 Documentation

### 16. Team Documentation
- [ ] OAuth setup guide is complete (`docs/AUTH_SETUP.md`)
- [ ] Environment variables are documented
- [ ] Deployment process is documented
- [ ] Rollback procedure is documented

---

## ⚠️ Pre-Launch Verification

### Run these commands before deploying:

```bash
# 1. Verify DISABLE_AUTH is false
grep -r "DISABLE_AUTH.*true" .env* && echo "❌ DISABLE_AUTH is still true!" || echo "✅ DISABLE_AUTH check passed"

# 2. Run all tests with auth enabled
DISABLE_AUTH=false pnpm test

# 3. Build for production
pnpm build

# 4. Check for TODO/FIXME in critical files
grep -r "TODO\|FIXME" apps/api/src/server.ts apps/api/src/trpc.ts apps/web/middleware.ts apps/web/lib/auth.ts

# 5. Verify production environment variables are set
echo "Check your deployment platform (Vercel, Railway, etc.) to ensure all env vars are configured"
```

---

## 🔐 Post-Deployment Verification

After deploying to production, immediately verify:

- [ ] Visit production URL and verify it loads
- [ ] Register a new user account
- [ ] Login with the new account
- [ ] Create a test project
- [ ] Logout and verify cannot access dashboard
- [ ] Check production logs for any errors
- [ ] Verify no "Authentication is DISABLED" warnings in logs

---

## 🚨 Emergency Rollback

If authentication issues are discovered post-launch:

1. **DO NOT** enable `DISABLE_AUTH=true` in production
2. Roll back to previous deployment
3. Investigate issue in staging environment
4. Fix authentication bug
5. Complete this checklist again
6. Redeploy

---

## ✅ Sign-Off

Before deploying to production, have these roles sign off:

- [ ] **Developer**: All code changes tested
- [ ] **Tech Lead**: Architecture reviewed
- [ ] **Security**: Authentication & authorization verified
- [ ] **DevOps**: Infrastructure configured
- [ ] **Product Owner**: Feature acceptance

**Date**: _______________

**Deployed By**: _______________

**Deployment URL**: _______________

---

## 📞 Emergency Contacts

- Tech Lead: ______________
- On-Call Engineer: ______________
- Database Admin: ______________

---

**Remember**: If in doubt, DO NOT DEPLOY. Authentication bugs can lead to catastrophic data breaches.

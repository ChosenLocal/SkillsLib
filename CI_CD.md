# CI/CD Pipeline Documentation

## Overview

This document describes the continuous integration and deployment pipeline for the Business Automation Platform. The pipeline ensures code quality, prevents regressions, and safely deploys to production.

## Table of Contents

- [CI Pipeline](#ci-pipeline)
- [Deployment Pipeline](#deployment-pipeline)
- [Quality Gates](#quality-gates)
- [Budget Monitoring](#budget-monitoring)
- [Pre-commit Hooks](#pre-commit-hooks)
- [Troubleshooting](#troubleshooting)

---

## CI Pipeline

The CI pipeline runs on every pull request and push to `main` or `develop` branches.

### Jobs

#### 1. **Lint & Type Check**
- Runs ESLint across all packages
- Runs TypeScript type checking
- **Gate:** Must pass for PR approval

#### 2. **Unit Tests**
- Spins up PostgreSQL and Redis services
- Runs database migrations
- Executes all unit and integration tests
- Uploads coverage to Codecov
- **Gate:** Must pass for PR approval

#### 3. **Build Validation**
- Builds all packages (schema, database, agents, web, api)
- Verifies build artifacts exist
- **Gate:** Must pass for PR approval

#### 4. **Bundle Size Analysis**
- Builds Next.js app with bundle analysis
- Checks against thresholds:
  - Total JS: ≤500KB
  - Total CSS: ≤100KB
  - Total bundle: ≤2MB
- **Gate:** Warns on violations, blocks on critical violations

#### 5. **Security Audit**
- Runs `pnpm audit` for vulnerabilities
- Runs Snyk security scan (if configured)
- **Gate:** Blocks on high/critical vulnerabilities

#### 6. **Cost Estimation** (PR only)
- Estimates costs for changed agents
- Comments on PR with cost breakdown
- **Gate:** Informational only

### Workflow File

`.github/workflows/ci.yml`

### Required Secrets

```yaml
ANTHROPIC_API_KEY: Claude API key for agent tests
SNYK_TOKEN: Snyk security scanning token (optional)
GITHUB_TOKEN: Automatically provided by GitHub
```

### Example Run

```
✅ Lint & Type Check (2m 15s)
✅ Unit Tests (5m 30s)
  - 35 tests passing
  - Coverage: 82%
✅ Build Validation (3m 45s)
⚠️  Bundle Size (1m 30s)
  - Warning: Total JS 520KB (limit 500KB)
✅ Security Audit (1m 00s)
ℹ️  Cost Estimation
  - Estimated monthly cost: $127.50
```

---

## Deployment Pipeline

The deployment pipeline runs on pushes to `main` (staging) or can be manually triggered for production.

### Environments

| Environment | Trigger | URL |
|-------------|---------|-----|
| **Preview** | Any PR | `https://preview-{sha}.yourdomain.com` |
| **Staging** | Push to `main` | `https://staging.yourdomain.com` |
| **Production** | Manual workflow dispatch | `https://app.yourdomain.com` |

### Deployment Flow

```
Pre-deployment Tests
    ↓
Deploy Web App (Vercel)
    ↓
Deploy Inngest Functions
    ↓
Health Check
    ↓
Lighthouse CI (staging/production only)
    ↓
Success → Complete
    ↓
Failure → Auto Rollback (production only)
```

### Jobs

#### 1. **Setup Deployment**
- Determines environment based on trigger
- Sets deployment URL
- **Output:** `environment`, `deploy-url`

#### 2. **Pre-deployment Tests**
- Runs full test suite
- Builds all packages
- **Gate:** Must pass to proceed with deployment

#### 3. **Deploy Web App**
- Deploys Next.js app to Vercel
- Uses production build for production env
- **Output:** Deployment URL

#### 4. **Deploy Inngest Functions**
- Deploys agent orchestration functions
- Configures Inngest signing key
- **Gate:** Must succeed for health check

#### 5. **Health Check**
- Waits 30 seconds for deployment stabilization
- Checks `/api/health` endpoint
- Runs smoke tests on critical pages
- **Gate:** Must pass or triggers rollback

#### 6. **Lighthouse CI** (staging/production only)
- Runs Lighthouse on deployed app
- Enforces quality thresholds:
  - Performance ≥ 90
  - Accessibility ≥ 95
  - Best Practices ≥ 90
  - SEO ≥ 95
- **Gate:** Warns on violations

#### 7. **Auto Rollback** (production only)
- Triggers if health check fails
- Rolls back Vercel deployment
- Notifies team via GitHub comment
- **Automatic:** No manual intervention required

### Workflow File

`.github/workflows/deploy.yml`

### Required Secrets

```yaml
VERCEL_TOKEN: Vercel API token
VERCEL_ORG_ID: Vercel organization ID
VERCEL_PROJECT_ID: Vercel project ID
INNGEST_SIGNING_KEY: Inngest function signing key
LHCI_GITHUB_APP_TOKEN: Lighthouse CI GitHub app token (optional)
```

### Manual Deployment

```bash
# Trigger production deployment
gh workflow run deploy.yml --ref main \
  -f environment=production
```

---

## Quality Gates

### Build-time Gates

| Gate | Level | Description |
|------|-------|-------------|
| Type Check | **Error** | TypeScript must compile without errors |
| Linting | **Error** | ESLint must pass with no errors |
| Tests | **Error** | All tests must pass |
| Build | **Error** | All packages must build successfully |
| Bundle Size | **Warning** | JS bundle >500KB triggers warning |
| Security | **Error** | High/critical vulnerabilities block merge |

### Runtime Gates

| Gate | Level | Description |
|------|-------|-------------|
| Health Check | **Error** | API must respond 200 on `/api/health` |
| Smoke Tests | **Error** | Critical pages must load |
| Lighthouse Performance | **Warning** | Score <90 triggers warning |
| Lighthouse Accessibility | **Error** | Score <95 blocks deployment |

### Budget Gates

| Limit | Threshold | Action |
|-------|-----------|--------|
| Per-execution cost | $10 | Block execution |
| Per-workflow cost | $50 | Pause workflow |
| Monthly tenant cost | $1,000 | Alert + block new workflows |
| System-wide monthly cost | $10,000 | Alert admin |

---

## Budget Monitoring

### Implementation

Budget monitoring is implemented in `packages/agents/shared/budget-monitor.ts`.

### Features

- **Real-time tracking** via Redis
- **Per-tenant limits** enforced at workflow start
- **Cost alerts** when >80% of budget used
- **Automatic workflow pause** when budget exceeded
- **Monthly reset** via cron job

### Usage

```typescript
import { createBudgetMonitor, DEFAULT_BUDGET_LIMITS } from '@business-automation/agents/shared';

const budgetMonitor = createBudgetMonitor(prisma);
await budgetMonitor.initialize();

// Check before workflow execution
const check = await budgetMonitor.checkBudget({
  tenantId: 'tenant-123',
  projectId: 'project-456',
  estimatedCost: 5.50,
  estimatedTokens: 50000,
  limits: DEFAULT_BUDGET_LIMITS,
});

if (!check.allowed) {
  throw new Error(`Budget exceeded: ${check.reason}`);
}

// Track agent cost after execution
await budgetMonitor.trackAgentCost({
  agentExecutionId: 'exec-789',
  projectId: 'project-456',
  tenantId: 'tenant-123',
  costUsd: 5.23,
  tokensUsed: 48327,
});
```

### Default Limits

```typescript
{
  perExecution: {
    maxCostUsd: 10,          // $10 per agent
    maxTokens: 100000,       // 100k tokens
  },
  perWorkflow: {
    maxCostUsd: 50,          // $50 per workflow
    maxTokens: 500000,       // 500k tokens
  },
  monthly: {
    maxCostUsd: 1000,        // $1k per tenant/month
    maxTokens: 10000000,     // 10M tokens
  },
  system: {
    maxCostUsd: 10000,       // $10k system-wide/month
    maxTokens: 100000000,    // 100M tokens
  },
}
```

### Monitoring Dashboard

View budget usage:
- **Per-tenant:** `/dashboard/billing`
- **System-wide:** Admin panel
- **Per-agent:** `/dashboard/projects/{id}/costs`

---

## Pre-commit Hooks

Pre-commit hooks catch issues before they reach CI, saving time and compute resources.

### Installed Hooks

#### 1. **Pre-commit** (`.husky/pre-commit`)
- Formats code with Prettier
- Fixes ESLint issues
- Runs type checking
- Runs tests for changed files

#### 2. **Commit Message** (`.husky/commit-msg`)
- Validates commit message format
- Enforces conventional commits

### Setup

```bash
# Install husky hooks
pnpm install

# Husky hooks are automatically installed
# via postinstall script

# Verify hooks are installed
ls -la .husky/
```

### Commit Message Format

```
type(scope): subject

[optional body]

[optional footer]
```

**Valid types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code refactoring
- `perf`: Performance improvement
- `test`: Tests
- `build`: Build system
- `ci`: CI configuration
- `chore`: Maintenance

**Examples:**

```bash
# Good
git commit -m "feat(agents): add cost tracking to planner agent"
git commit -m "fix(api): resolve authentication token refresh bug"
git commit -m "docs(readme): update installation instructions"

# Bad
git commit -m "updates"  # ❌ Too short
git commit -m "FEAT: Add feature"  # ❌ Wrong case
git commit -m "added some stuff"  # ❌ No type
```

### Bypass Hooks (Emergency Only)

```bash
# Skip pre-commit hooks (not recommended)
git commit --no-verify -m "emergency fix"

# Skip commit-msg validation
git commit --no-verify -m "WIP"
```

---

## Lighthouse CI Configuration

Configuration file: `.lighthouserc.js`

### Thresholds

| Category | Minimum Score |
|----------|--------------|
| Performance | 90 |
| Accessibility | 95 |
| Best Practices | 90 |
| SEO | 95 |

### Resource Budgets

| Resource | Limit |
|----------|-------|
| Total JavaScript | 500KB |
| Total CSS | 100KB |
| Total Images | 1MB |
| Total Fonts | 200KB |
| Total Page Weight | 2MB |

### Metrics

| Metric | Threshold |
|--------|-----------|
| First Contentful Paint | <2s |
| Largest Contentful Paint | <2.5s |
| Cumulative Layout Shift | <0.1 |
| Total Blocking Time | <300ms |
| Speed Index | <3s |

### Running Locally

```bash
# Install Lighthouse CI
npm install -g @lhci/cli

# Build and start app
pnpm build
pnpm start

# Run Lighthouse CI
lhci autorun
```

---

## Troubleshooting

### CI Failing

#### Lint Errors

```bash
# Fix automatically
pnpm lint --fix

# Check what would be fixed
pnpm lint
```

#### Type Errors

```bash
# Run type check
pnpm type-check

# Check specific package
pnpm --filter=@business-automation/agents type-check
```

#### Test Failures

```bash
# Run tests locally
pnpm test

# Run specific test file
pnpm test packages/agents/__tests__/golden-fixture.test.ts

# Run with coverage
pnpm test --coverage
```

#### Bundle Size Violations

```bash
# Analyze bundle
cd apps/web
ANALYZE=true pnpm build

# Check what's in the bundle
npx webpack-bundle-analyzer .next/analyze/bundle.json
```

### Deployment Failing

#### Health Check Failure

1. Check deployment logs in Vercel dashboard
2. Verify environment variables are set
3. Check database connectivity
4. Review application logs

```bash
# Check health endpoint locally
curl http://localhost:3000/api/health

# Check Vercel logs
vercel logs
```

#### Lighthouse Failures

1. Run Lighthouse locally to reproduce
2. Check specific failing audits
3. Review performance bottlenecks
4. Optimize images/bundles as needed

```bash
# Run Lighthouse locally
lighthouse http://localhost:3000 \
  --view \
  --preset=desktop
```

### Budget Exceeded

#### Per-execution Budget

```typescript
// Increase budget for specific agent
const result = await agent.run(input, {
  budget: {
    maxCostUsd: 20, // Increased from $10
    maxTokens: 200000,
  },
});
```

#### Monthly Budget

1. Review cost breakdown: `/dashboard/billing`
2. Identify expensive agents
3. Optimize prompts to reduce token usage
4. Contact admin to increase tenant limit

#### System-wide Budget

1. Review system-wide usage in admin panel
2. Identify high-usage tenants
3. Optimize agent implementations
4. Scale infrastructure if needed

---

## Best Practices

### Development Workflow

1. **Create feature branch** from `develop`
   ```bash
   git checkout -b feat/my-feature
   ```

2. **Make changes** with frequent commits
   ```bash
   git commit -m "feat(scope): add feature X"
   ```

3. **Push and create PR**
   ```bash
   git push origin feat/my-feature
   gh pr create
   ```

4. **Wait for CI** to pass
   - Fix any failures
   - Address reviewer feedback

5. **Merge to develop**
   - Squash merge recommended
   - Delete feature branch

6. **Deploy to staging** (automatic on merge to main)

7. **Test in staging**

8. **Deploy to production** (manual)
   ```bash
   gh workflow run deploy.yml --ref main -f environment=production
   ```

### Cost Optimization

- **Use cheaper models** for simple tasks
- **Cache repeated queries** in Redis
- **Batch similar requests** where possible
- **Set realistic token limits** per agent
- **Monitor and alert** on anomalies

### Security

- **Never commit secrets** to git
- **Use environment variables** for all credentials
- **Rotate API keys** regularly
- **Review dependency updates** for vulnerabilities
- **Enable 2FA** on all accounts

---

## Metrics & Monitoring

### CI Metrics

- Average CI duration: ~15 minutes
- Test success rate: >95%
- Coverage: >80%

### Deployment Metrics

- Deployment frequency: Multiple per day
- Lead time: <30 minutes
- MTTR (Mean Time To Recovery): <15 minutes
- Change failure rate: <5%

### Cost Metrics

- Average cost per workflow: ~$25
- Monthly cost per tenant: ~$500
- System-wide monthly cost: ~$5,000

---

## Support

For CI/CD issues:
- **CI failures:** Check workflow logs in GitHub Actions
- **Deployment issues:** Check Vercel dashboard
- **Budget questions:** Contact platform admin
- **Security alerts:** Create incident ticket

For urgent production issues:
- Slack: `#platform-alerts`
- Email: `platform-ops@yourdomain.com`
- On-call: PagerDuty

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2025-01-05 | Initial CI/CD setup | System |
| 2025-01-05 | Added budget monitoring | System |
| 2025-01-05 | Configured Lighthouse CI | System |

---

**Last Updated:** 2025-01-05
**Version:** 1.0.0

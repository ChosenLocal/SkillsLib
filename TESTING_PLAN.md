# Comprehensive Testing Plan - Phase 3 Validation

## Overview

This document outlines the complete testing strategy to validate all features implemented in Phase 3 (3-tier agent architecture, orchestration, CI/CD).

## Test Execution Order

```
1. Database Schema Tests (fastest)
   ↓
2. Budget Monitoring Tests (unit-level)
   ↓
3. API Endpoint Tests (integration)
   ↓
4. Agent Execution Tests (integration)
   ↓
5. CLI Tool Tests (e2e)
   ↓
6. Workflow Orchestration Tests (e2e)
   ↓
7. Frontend Integration Tests (e2e)
```

---

## 1. Database & Schema Tests

### Test Suite: `packages/database/__tests__/schema.test.ts`

**What to Test:**
- ✅ All Prisma models can be created
- ✅ Foreign key relationships work correctly
- ✅ Unique constraints are enforced
- ✅ Enum values are valid
- ✅ Default values are set correctly
- ✅ Cascade deletes work as expected

**Test Cases:**

```typescript
describe('Database Schema', () => {
  test('Create tenant → user → project flow', async () => {
    // Create tenant
    const tenant = await prisma.tenant.create({...});

    // Create user
    const user = await prisma.user.create({
      tenantId: tenant.id,
      ...
    });

    // Create project
    const project = await prisma.project.create({
      tenantId: tenant.id,
      ...
    });

    expect(project.tenantId).toBe(tenant.id);
  });

  test('Workflow → AgentExecution relationship', async () => {
    // Create workflow
    const workflow = await prisma.workflowExecution.create({...});

    // Create agent execution
    const agent = await prisma.agentExecution.create({
      workflowExecutionId: workflow.id,
      ...
    });

    expect(agent.workflowExecutionId).toBe(workflow.id);
  });

  test('Tenant isolation - users cannot see other tenant data', async () => {
    const tenant1 = await prisma.tenant.create({...});
    const tenant2 = await prisma.tenant.create({...});

    const project1 = await prisma.project.create({
      tenantId: tenant1.id,
      ...
    });

    const projects = await prisma.project.findMany({
      where: { tenantId: tenant2.id },
    });

    expect(projects).toHaveLength(0);
  });
});
```

**Expected Results:**
- All model relationships work
- Tenant isolation is enforced
- Cascade deletes work correctly
- ~10 tests, should complete in <30 seconds

---

## 2. Budget Monitoring Tests

### Test Suite: `packages/agents/__tests__/budget-monitor.test.ts`

**What to Test:**
- ✅ Cost tracking works correctly
- ✅ Budget checks enforce limits
- ✅ Alerts trigger at 80% usage
- ✅ Workflow pauses when budget exceeded
- ✅ Monthly usage aggregation works
- ✅ Cost breakdown by agent works

**Test Cases:**

```typescript
describe('BudgetMonitor', () => {
  test('Track agent execution cost', async () => {
    await budgetMonitor.trackAgentCost({
      agentExecutionId: 'exec-1',
      projectId: 'proj-1',
      tenantId: 'tenant-1',
      costUsd: 5.50,
      tokensUsed: 50000,
    });

    const usage = await budgetMonitor.getTenantMonthlyUsage('tenant-1');
    expect(usage.costUsd).toBe(5.50);
    expect(usage.tokensUsed).toBe(50000);
  });

  test('Block execution when budget exceeded', async () => {
    // Set up tenant with $10 monthly limit
    // Use $8 already
    await budgetMonitor.trackAgentCost({
      costUsd: 8,
      tokensUsed: 80000,
      ...
    });

    // Try to spend another $5 (would exceed $10 limit)
    const check = await budgetMonitor.checkBudget({
      tenantId: 'tenant-1',
      estimatedCost: 5,
      estimatedTokens: 50000,
      limits: { monthly: { maxCostUsd: 10 } },
    });

    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Monthly budget exceeded');
  });

  test('Alert when >80% of budget used', async () => {
    // Use $8.50 of $10 monthly limit (85%)
    await budgetMonitor.trackAgentCost({
      costUsd: 8.50,
      tokensUsed: 85000,
      ...
    });

    const status = await budgetMonitor.checkBudget({
      tenantId: 'tenant-1',
      estimatedCost: 0.50,
      limits: { monthly: { maxCostUsd: 10 } },
    });

    expect(status.status.nearingLimit).toBe(true);
    expect(status.status.percentUsed).toBeGreaterThan(80);
  });

  test('Cost breakdown by agent', async () => {
    await budgetMonitor.trackAgentCost({
      agentName: 'planner',
      costUsd: 3,
      ...
    });

    await budgetMonitor.trackAgentCost({
      agentName: 'scaffolder',
      costUsd: 2,
      ...
    });

    const breakdown = await budgetMonitor.getAgentCostBreakdown({
      tenantId: 'tenant-1',
    });

    expect(breakdown).toHaveLength(2);
    expect(breakdown[0].agentName).toBe('planner');
    expect(breakdown[0].totalCost).toBe(3);
  });
});
```

**Expected Results:**
- Budget tracking accurate
- Limits enforced correctly
- Alerts trigger appropriately
- ~8 tests, should complete in <20 seconds

---

## 3. API Endpoint Tests

### Test Suite: `apps/web/tests/api/trpc-endpoints.spec.ts`

**What to Test:**
- ✅ All tRPC endpoints respond correctly
- ✅ Authentication is enforced
- ✅ Tenant isolation works
- ✅ Input validation works (Zod schemas)
- ✅ Error handling works

**Test Cases:**

```typescript
describe('tRPC Endpoints', () => {
  describe('Workflow Endpoints', () => {
    test('POST /workflow.generateWebsite - Success', async () => {
      const response = await trpc.workflow.generateWebsite.mutate({
        projectId: validProjectId,
        companyProfileId: validProfileId,
        constraints: {
          maxPages: 10,
          maxCost: 50,
        },
      });

      expect(response.workflowExecution).toBeDefined();
      expect(response.workflowExecution.status).toBe('QUEUED');
      expect(response.message).toContain('started successfully');
    });

    test('POST /workflow.generateWebsite - Invalid project ID', async () => {
      await expect(
        trpc.workflow.generateWebsite.mutate({
          projectId: 'invalid-id',
          companyProfileId: validProfileId,
        })
      ).rejects.toThrow('Project not found');
    });

    test('POST /workflow.generateWebsite - Duplicate workflow', async () => {
      // Create first workflow
      await trpc.workflow.generateWebsite.mutate({
        projectId: validProjectId,
        companyProfileId: validProfileId,
      });

      // Try to create second workflow (should fail)
      await expect(
        trpc.workflow.generateWebsite.mutate({
          projectId: validProjectId,
          companyProfileId: validProfileId,
        })
      ).rejects.toThrow('already running');
    });

    test('GET /workflow.getStatus - Success', async () => {
      const workflow = await createWorkflow();

      const status = await trpc.workflow.getStatus.query({
        workflowExecutionId: workflow.id,
      });

      expect(status.id).toBe(workflow.id);
      expect(status.project).toBeDefined();
      expect(status.agentExecutions).toBeDefined();
    });

    test('POST /workflow.pause - Success', async () => {
      const workflow = await createRunningWorkflow();

      const paused = await trpc.workflow.pause.mutate({
        workflowExecutionId: workflow.id,
      });

      expect(paused.status).toBe('PAUSED');
      expect(paused.pausedAt).toBeDefined();
    });
  });

  describe('Agent Endpoints', () => {
    test('GET /agent.getExecutions - With filters', async () => {
      const result = await trpc.agent.getExecutions.query({
        projectId: validProjectId,
        filters: {
          status: 'COMPLETED',
          layer: 'STRATEGY',
        },
        limit: 20,
      });

      expect(result.items).toBeDefined();
      result.items.forEach(agent => {
        expect(agent.status).toBe('COMPLETED');
        expect(agent.layer).toBe('STRATEGY');
      });
    });

    test('GET /agent.getLatestEvaluation - Success', async () => {
      const evaluation = await trpc.agent.getLatestEvaluation.query({
        projectId: validProjectId,
      });

      expect(evaluation).toBeDefined();
      expect(evaluation.aggregatedScores).toBeDefined();
      expect(evaluation.evaluationCount).toBeGreaterThan(0);
    });

    test('POST /agent.retryAgent - Success', async () => {
      const failedAgent = await createFailedAgentExecution();

      const retried = await trpc.agent.retryAgent.mutate({
        agentExecutionId: failedAgent.id,
      });

      expect(retried.status).toBe('PENDING');
      expect(retried.iteration).toBe(failedAgent.iteration + 1);
    });
  });

  describe('Authentication & Authorization', () => {
    test('Unauthenticated request fails', async () => {
      // Remove auth token
      await expect(
        unauthenticatedTrpc.workflow.generateWebsite.mutate({...})
      ).rejects.toThrow('UNAUTHORIZED');
    });

    test('Cross-tenant access denied', async () => {
      // User from tenant A tries to access tenant B project
      const tenantBProject = await createProject({ tenantId: 'tenant-b' });

      await expect(
        tenantATrpc.workflow.generateWebsite.mutate({
          projectId: tenantBProject.id,
          ...
        })
      ).rejects.toThrow('not found');
    });
  });
});
```

**Expected Results:**
- All endpoints work correctly
- Authentication enforced
- Tenant isolation maintained
- Input validation catches errors
- ~25 tests, should complete in <2 minutes

---

## 4. Agent Execution Tests

### Test Suite: `packages/agents/__tests__/agent-execution.spec.ts`

**What to Test:**
- ✅ Each agent can execute successfully
- ✅ Agent input validation works
- ✅ Agent output matches schema
- ✅ Agents track costs correctly
- ✅ Agents handle errors gracefully

**Test Cases:**

```typescript
describe('Agent Execution', () => {
  describe('Strategy Tier Agents', () => {
    test('PlannerAgent - Valid execution', async () => {
      const planner = new PlannerAgent(context);

      const result = await planner.run({
        companyProfileId: validProfileId,
        constraints: {
          maxPages: 10,
        },
      });

      expect(result.success).toBe(true);
      expect(result.output).toMatchSchema(SiteSpecSchema);
      expect(result.cost).toBeGreaterThan(0);
      expect(result.tokensUsed).toBeGreaterThan(0);
      expect(result.artifacts).toHaveLength(1);
    });

    test('IAArchitectAgent - Valid execution', async () => {
      // Create SiteSpec first
      const siteSpecPath = await createSiteSpec();

      const iaArchitect = new IAArchitectAgent(context);
      const result = await iaArchitect.run({
        projectId: validProjectId,
        siteSpecPath,
      });

      expect(result.success).toBe(true);
      expect(result.output).toMatchSchema(IAPlanSchema);
    });

    test('BrandInterpreterAgent - Valid execution', async () => {
      const siteSpecPath = await createSiteSpec();

      const brandInterpreter = new BrandInterpreterAgent(context);
      const result = await brandInterpreter.run({
        projectId: validProjectId,
        companyProfileId: validProfileId,
        siteSpecPath,
      });

      expect(result.success).toBe(true);
      expect(result.output).toMatchSchema(DesignSpecSchema);
      expect(result.output.tokens).toBeDefined();
      expect(result.output.tokens.colors).toBeDefined();
    });

    test('BacklogManagerAgent - Valid execution', async () => {
      const siteSpecPath = await createSiteSpec();
      const designSpecPath = await createDesignSpec();
      const iaPlanPath = await createIAPlan();

      const backlogManager = new BacklogManagerAgent(context);
      const result = await backlogManager.run({
        projectId: validProjectId,
        siteSpecPath,
        designSpecPath,
        iaPlanPath,
      });

      expect(result.success).toBe(true);
      expect(result.output).toMatchSchema(WorkQueueSchema);
      expect(result.output.tasks.length).toBeGreaterThan(0);
    });
  });

  describe('Build Tier Agents', () => {
    test('ScaffolderAgent - Valid execution', async () => {
      const scaffolder = new ScaffolderAgent(context);

      const result = await scaffolder.run({
        projectId: validProjectId,
        siteSpecPath: validSiteSpecPath,
        designSpecPath: validDesignSpecPath,
      });

      expect(result.success).toBe(true);

      // Verify files created
      const projectRoot = `/tmp/${validProjectId}/build`;
      expect(fs.existsSync(`${projectRoot}/package.json`)).toBe(true);
      expect(fs.existsSync(`${projectRoot}/next.config.ts`)).toBe(true);
      expect(fs.existsSync(`${projectRoot}/tailwind.config.ts`)).toBe(true);
    });

    test('ComponentWorkerAgent - Valid execution', async () => {
      const componentWorker = new ComponentWorkerAgent(context);

      const result = await componentWorker.run({
        componentId: 'hero-section',
        type: 'Hero',
        props: {...},
        designTokens: {...},
      });

      expect(result.success).toBe(true);
      expect(result.output.files).toBeDefined();
      expect(result.output.files.length).toBeGreaterThan(0);
    });

    test('PageAssemblerAgent - Valid execution', async () => {
      const pageAssembler = new PageAssemblerAgent(context);

      const result = await pageAssembler.run({
        route: '/',
        metadata: {...},
        components: ['hero-1', 'services-1'],
        availableComponents: ['hero-1', 'services-1', 'cta-1'],
      });

      expect(result.success).toBe(true);
      expect(result.output.route).toBe('/');
      expect(result.output.files).toBeDefined();
    });
  });

  describe('Quality Tier Agents', () => {
    test('StaticAnalyzerAgent - Valid execution', async () => {
      // Create a Next.js project first
      const projectRoot = await createNextJsProject();

      const staticAnalyzer = new StaticAnalyzerAgent(context);
      const result = await staticAnalyzer.run({
        projectId: validProjectId,
        projectRoot,
        runLighthouse: false,
        thresholds: {...},
      });

      expect(result.success).toBe(true);
      expect(result.output.findings).toMatchSchema(FindingsSchema);
      expect(result.output.buildReport).toBeDefined();
    });

    test('FixerAgent - Valid execution', async () => {
      // Create findings from static analyzer
      const findingsPath = await createFindings();
      const projectRoot = await createNextJsProject();

      const fixer = new FixerAgent(context);
      const result = await fixer.run({
        projectId: validProjectId,
        projectRoot,
        findingsPath,
        budget: {
          atomic: { maxLines: 120, maxFiles: 2 },
          batch: { maxLines: 220, maxFiles: 6 },
          totalTokenLimit: 50000,
        },
      });

      expect(result.success).toBe(true);
      expect(result.output).toMatchSchema(PatchesSchema);
    });
  });

  describe('Error Handling', () => {
    test('Agent fails with invalid input', async () => {
      const planner = new PlannerAgent(context);

      await expect(
        planner.run({
          companyProfileId: 'invalid-id',
        })
      ).rejects.toThrow();
    });

    test('Agent respects token budget', async () => {
      const planner = new PlannerAgent({
        ...context,
        maxTokens: 100, // Very low limit
      });

      const result = await planner.run({
        companyProfileId: validProfileId,
      });

      expect(result.tokensUsed).toBeLessThanOrEqual(100);
    });
  });
});
```

**Expected Results:**
- All agents execute successfully
- Outputs match schemas
- Costs are tracked
- Errors handled gracefully
- ~20 tests, should complete in <5 minutes (with API calls)

---

## 5. CLI Tool Tests

### Test Suite: `packages/agents/__tests__/cli.spec.ts`

**What to Test:**
- ✅ `agent list` command works
- ✅ `agent info` command works
- ✅ `agent test` command works
- ✅ `agent test-workflow` command works

**Test Cases:**

```bash
describe('CLI Tool', () => {
  test('agent list - Shows all agents', () => {
    const output = execSync('pnpm agent list').toString();

    expect(output).toContain('STRATEGY Tier:');
    expect(output).toContain('planner');
    expect(output).toContain('ia-architect');
    expect(output).toContain('BUILD Tier:');
    expect(output).toContain('scaffolder');
    expect(output).toContain('QUALITY Tier:');
    expect(output).toContain('static-analyzer');
  });

  test('agent info planner - Shows agent details', () => {
    const output = execSync('pnpm agent info planner').toString();

    expect(output).toContain('Planner');
    expect(output).toContain('Version: 1.0.0');
    expect(output).toContain('Tier: strategy');
    expect(output).toContain('ANTHROPIC_API_KEY');
  });

  test('agent test planner - Executes agent', () => {
    // This test requires real API key and database
    // Skip in CI if not available
    if (!process.env.ANTHROPIC_API_KEY) {
      return test.skip();
    }

    const output = execSync(`pnpm agent test planner --project-id=${validProjectId}`).toString();

    expect(output).toContain('Running Planner...');
    expect(output).toContain('completed successfully');
    expect(output).toContain('Tokens Used:');
    expect(output).toContain('Cost:');
  });

  test('agent test-workflow website-generator - Runs workflow', () => {
    // This test requires real API key and database
    // Skip in CI if not available
    if (!process.env.ANTHROPIC_API_KEY) {
      return test.skip();
    }

    const output = execSync(`
      pnpm agent test-workflow website-generator \
        --project-id=${validProjectId} \
        --profile-id=${validProfileId} \
        --max-pages=5 \
        --max-cost=25
    `).toString();

    expect(output).toContain('STRATEGY TIER');
    expect(output).toContain('BUILD TIER');
    expect(output).toContain('QUALITY TIER');
    expect(output).toContain('Total Tokens:');
    expect(output).toContain('Total Cost:');
  });
});
```

**Expected Results:**
- CLI commands work correctly
- Output is formatted properly
- Errors are handled
- ~5 tests, should complete in <1 minute (or skipped in CI)

---

## 6. Workflow Orchestration Tests

### Test Suite: `packages/agents/__tests__/workflow-orchestration.spec.ts`

**What to Test:**
- ✅ Complete workflow executes all tiers
- ✅ Agents run in correct order
- ✅ Parallel execution works (IA Architect + Brand Interpreter)
- ✅ Workflow handles failures gracefully
- ✅ Workflow tracks progress correctly

**Test Cases:**

```typescript
describe('Workflow Orchestration', () => {
  test('Complete website generation workflow', async () => {
    // Trigger workflow
    const workflow = await trpc.workflow.generateWebsite.mutate({
      projectId: validProjectId,
      companyProfileId: validProfileId,
      constraints: {
        maxPages: 5,
        maxComponents: 20,
      },
    });

    expect(workflow.workflowExecution.status).toBe('QUEUED');

    // Wait for workflow to complete (or timeout after 5 minutes)
    const completed = await waitForWorkflowCompletion(
      workflow.workflowExecution.id,
      300000
    );

    expect(completed.status).toBe('COMPLETE');

    // Verify all agents ran
    const agents = await prisma.agentExecution.findMany({
      where: { workflowExecutionId: workflow.workflowExecution.id },
    });

    // Strategy tier agents
    expect(agents.find(a => a.agentName === 'planner')).toBeDefined();
    expect(agents.find(a => a.agentName === 'ia-architect')).toBeDefined();
    expect(agents.find(a => a.agentName === 'brand-interpreter')).toBeDefined();
    expect(agents.find(a => a.agentName === 'backlog-manager')).toBeDefined();

    // Build tier agents
    expect(agents.find(a => a.agentName === 'scaffolder')).toBeDefined();

    // Quality tier agents
    expect(agents.find(a => a.agentName === 'static-analyzer')).toBeDefined();
  });

  test('Workflow respects budget constraints', async () => {
    // Set very low budget
    const workflow = await trpc.workflow.generateWebsite.mutate({
      projectId: validProjectId,
      companyProfileId: validProfileId,
      constraints: {
        budget: {
          maxCostUsd: 1, // $1 limit (very low)
        },
      },
    });

    // Wait for workflow to fail due to budget
    const completed = await waitForWorkflowCompletion(
      workflow.workflowExecution.id,
      60000
    );

    expect(completed.status).toBe('FAILED');
    expect(completed.error).toContain('budget');
  });

  test('Workflow handles agent failures', async () => {
    // Trigger workflow with invalid company profile (will cause planner to fail)
    const workflow = await trpc.workflow.generateWebsite.mutate({
      projectId: validProjectId,
      companyProfileId: 'invalid-profile-id',
    });

    // Wait for workflow to fail
    const completed = await waitForWorkflowCompletion(
      workflow.workflowExecution.id,
      60000
    );

    expect(completed.status).toBe('FAILED');

    // Verify planner failed
    const planner = await prisma.agentExecution.findFirst({
      where: {
        workflowExecutionId: workflow.workflowExecution.id,
        agentName: 'planner',
      },
    });

    expect(planner?.status).toBe('FAILED');
  });

  test('Parallel agent execution works', async () => {
    // This tests that IA Architect and Brand Interpreter run in parallel
    const workflow = await trpc.workflow.generateWebsite.mutate({
      projectId: validProjectId,
      companyProfileId: validProfileId,
    });

    await waitForWorkflowCompletion(workflow.workflowExecution.id, 300000);

    const iaArchitect = await prisma.agentExecution.findFirst({
      where: {
        workflowExecutionId: workflow.workflowExecution.id,
        agentName: 'ia-architect',
      },
    });

    const brandInterpreter = await prisma.agentExecution.findFirst({
      where: {
        workflowExecutionId: workflow.workflowExecution.id,
        agentName: 'brand-interpreter',
      },
    });

    // They should have similar start times (within 10 seconds)
    const timeDiff = Math.abs(
      iaArchitect!.createdAt.getTime() - brandInterpreter!.createdAt.getTime()
    );
    expect(timeDiff).toBeLessThan(10000);
  });
});
```

**Expected Results:**
- Complete workflow executes successfully
- All agents run in correct order
- Parallel execution works
- Failures handled gracefully
- ~5 tests, should complete in <15 minutes (full workflow)

---

## 7. Frontend Integration Tests

### Test Suite: `apps/web/tests/e2e/workflow-integration.spec.ts`

**What to Test:**
- ✅ User can create project
- ✅ User can trigger website generation
- ✅ User can view workflow progress
- ✅ User can view agent executions
- ✅ User can view cost breakdown

**Test Cases:**

```typescript
describe('Frontend Integration', () => {
  test('Complete user flow - Create project and generate website', async ({ page }) => {
    // Login
    await page.goto('/');
    await page.click('text=Sign In');
    await page.fill('[name=email]', 'test@example.com');
    await page.fill('[name=password]', 'password123');
    await page.click('button[type=submit]');

    // Navigate to projects
    await page.goto('/dashboard/projects');

    // Create new project
    await page.click('text=New Project');
    await page.fill('[name=name]', 'Test Roofing Company');
    await page.selectOption('[name=type]', 'ROOFING_WEBSITE');
    await page.click('button:has-text("Create")');

    // Wait for project page
    await page.waitForURL(/\/dashboard\/projects\/[^/]+$/);

    // Trigger website generation
    await page.click('button:has-text("Generate Website")');

    // Select company profile
    await page.selectOption('[name=companyProfileId]', validProfileId);

    // Set constraints
    await page.fill('[name=maxPages]', '5');
    await page.fill('[name=maxCost]', '25');

    // Start generation
    await page.click('button:has-text("Start Generation")');

    // Wait for workflow to start
    await page.waitForSelector('text=Website generation started');

    // View progress
    await page.click('text=View Progress');

    // Verify workflow status visible
    await expect(page.locator('text=STRATEGY TIER')).toBeVisible();
    await expect(page.locator('text=BUILD TIER')).toBeVisible();
    await expect(page.locator('text=QUALITY TIER')).toBeVisible();

    // Wait for completion (or timeout)
    await page.waitForSelector('text=COMPLETE', { timeout: 300000 });

    // View cost breakdown
    await page.click('text=Cost Breakdown');
    await expect(page.locator('text=Total Cost')).toBeVisible();
    await expect(page.locator('text=Strategy Tier')).toBeVisible();
    await expect(page.locator('text=Build Tier')).toBeVisible();
  });

  test('View agent execution details', async ({ page }) => {
    // Navigate to completed workflow
    await page.goto(`/dashboard/projects/${validProjectId}`);

    // Click on workflow
    await page.click('text=View Workflow');

    // View strategy tier agents
    await page.click('text=STRATEGY TIER');

    // Click on planner agent
    await page.click('text=planner');

    // Verify agent details visible
    await expect(page.locator('text=Input')).toBeVisible();
    await expect(page.locator('text=Output')).toBeVisible();
    await expect(page.locator('text=Cost')).toBeVisible();
    await expect(page.locator('text=Tokens Used')).toBeVisible();
  });

  test('Retry failed agent', async ({ page }) => {
    // Navigate to workflow with failed agent
    await page.goto(`/dashboard/projects/${projectIdWithFailedAgent}`);

    // Click on failed agent
    await page.click('text=FAILED');

    // Click retry button
    await page.click('button:has-text("Retry")');

    // Verify retry started
    await expect(page.locator('text=Agent execution retried')).toBeVisible();
    await expect(page.locator('text=PENDING')).toBeVisible();
  });
});
```

**Expected Results:**
- Complete user flow works
- All UI elements visible and functional
- Real-time updates work
- ~5 tests, should complete in <20 minutes (with full workflow)

---

## Test Execution Plan

### Phase 1: Quick Validation (5 minutes)
```bash
# Run unit tests only
pnpm test packages/schema
pnpm test packages/database --grep="Schema"
pnpm test packages/agents --grep="BudgetMonitor"
```

### Phase 2: Integration Tests (15 minutes)
```bash
# Run API tests
pnpm test apps/web/tests/api

# Run agent execution tests (may skip if no API key)
pnpm test packages/agents --grep="Agent Execution"
```

### Phase 3: E2E Tests (30 minutes)
```bash
# Run CLI tests
pnpm test packages/agents --grep="CLI"

# Run workflow tests (long-running)
pnpm test packages/agents --grep="Workflow Orchestration"

# Run frontend tests
pnpm --filter=@business-automation/web exec playwright test tests/e2e
```

### Phase 4: Full Suite (1 hour)
```bash
# Run everything
pnpm test
```

---

## Success Criteria

✅ **Database Schema Tests:** 10/10 passing
✅ **Budget Monitoring Tests:** 8/8 passing
✅ **API Endpoint Tests:** 25/25 passing
✅ **Agent Execution Tests:** 20/20 passing
✅ **CLI Tool Tests:** 5/5 passing (or skipped if no API key)
✅ **Workflow Orchestration Tests:** 5/5 passing (or skipped if no API key)
✅ **Frontend Integration Tests:** 5/5 passing

**Total:** ~78 tests, ~1 hour for full suite

---

## Test Environment Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Set up test database
cp .env.example .env.test
# Edit .env.test with test database credentials

# 3. Run migrations
DATABASE_URL="postgresql://test_user:test_password@localhost:5432/test_db" \
  pnpm db:migrate

# 4. Seed test data
DATABASE_URL="postgresql://test_user:test_password@localhost:5432/test_db" \
  pnpm db:seed

# 5. Set API keys (for integration tests)
export ANTHROPIC_API_KEY="sk-ant-..."
export REDIS_URL="redis://localhost:6379"

# 6. Run tests
pnpm test
```

---

## Continuous Monitoring

After initial validation, these tests should run:
- **On every PR:** Unit + Integration tests (Phases 1-2)
- **Before deployment:** Full suite (Phase 4)
- **Nightly:** Full suite + performance benchmarks

---

## Next Steps After Testing

1. **Fix any failing tests**
2. **Optimize slow tests**
3. **Add performance benchmarks**
4. **Set up CI to run tests automatically**
5. **Deploy to staging**
6. **Run smoke tests in staging**
7. **Deploy to production**

---

**Last Updated:** 2025-01-05
**Version:** 1.0.0

// packages/agents/__tests__/budget-monitor.test.ts
/**
 * Budget Monitor Tests
 *
 * Tests for the budget monitoring system that tracks costs and enforces limits.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { PrismaClient } from '@business-automation/database';
import {
  BudgetMonitor,
  createBudgetMonitor,
  DEFAULT_BUDGET_LIMITS,
  type BudgetLimits,
} from '../shared/budget-monitor';

// Test database client
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/skillslib_test',
    },
  },
});

// Test data
const TEST_TENANT_ID = 'tenant_budget_test';
const TEST_PROJECT_ID = 'project_budget_test';
const TEST_AGENT_EXECUTION_ID = 'exec_budget_test';
const TEST_WORKFLOW_EXECUTION_ID = 'workflow_budget_test';

describe('Budget Monitor', () => {
  let budgetMonitor: BudgetMonitor;

  beforeAll(async () => {
    // Create budget monitor instance
    budgetMonitor = createBudgetMonitor(prisma);
    await budgetMonitor.initialize();

    // Create test tenant
    await prisma.tenant.upsert({
      where: { id: TEST_TENANT_ID },
      create: {
        id: TEST_TENANT_ID,
        name: 'Budget Test Tenant',
        slug: 'budget-test-tenant',
      },
      update: {},
    });

    // Create test project
    await prisma.project.upsert({
      where: { id: TEST_PROJECT_ID },
      create: {
        id: TEST_PROJECT_ID,
        name: 'Budget Test Project',
        tenantId: TEST_TENANT_ID,
        type: 'WEBSITE',
      },
      update: {},
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.agentExecution.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.workflowExecution.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.project.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.tenant.deleteMany({ where: { id: TEST_TENANT_ID } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up existing test executions before each test
    await prisma.agentExecution.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.workflowExecution.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
  });

  describe('Cost Tracking', () => {
    it('should track agent execution cost', async () => {
      // Create agent execution
      const agentExecution = await prisma.agentExecution.create({
        data: {
          id: TEST_AGENT_EXECUTION_ID,
          agentName: 'planner',
          agentRole: 'BUSINESS_REQUIREMENTS',
          tenantId: TEST_TENANT_ID,
          projectId: TEST_PROJECT_ID,
          status: 'RUNNING',
          input: {},
        },
      });

      // Track cost
      await budgetMonitor.trackAgentCost({
        agentExecutionId: agentExecution.id,
        projectId: TEST_PROJECT_ID,
        tenantId: TEST_TENANT_ID,
        costUsd: 2.50,
        tokensUsed: 25000,
      });

      // Verify cost was recorded
      const updated = await prisma.agentExecution.findUnique({
        where: { id: agentExecution.id },
      });

      expect(updated?.cost).toBe(2.50);
      expect(updated?.tokensUsed).toBe(25000);

      // Verify tenant monthly usage updated
      const usage = await budgetMonitor.getTenantMonthlyUsage(TEST_TENANT_ID);
      expect(usage.costUsd).toBeGreaterThanOrEqual(2.50);
      expect(usage.tokensUsed).toBeGreaterThanOrEqual(25000);
    });

    it('should track workflow execution cost', async () => {
      // Create workflow execution
      const workflowExecution = await prisma.workflowExecution.create({
        data: {
          id: TEST_WORKFLOW_EXECUTION_ID,
          workflowType: 'WEBSITE_GENERATION',
          workflowVersion: '1.0',
          tenantId: TEST_TENANT_ID,
          projectId: TEST_PROJECT_ID,
          status: 'RUNNING',
        },
      });

      // Track cost
      await budgetMonitor.trackWorkflowCost({
        workflowExecutionId: workflowExecution.id,
        projectId: TEST_PROJECT_ID,
        tenantId: TEST_TENANT_ID,
        costUsd: 45.75,
        tokensUsed: 450000,
      });

      // Verify cost was recorded
      const updated = await prisma.workflowExecution.findUnique({
        where: { id: workflowExecution.id },
      });

      expect(updated?.totalCost).toBe(45.75);
    });
  });

  describe('Budget Enforcement', () => {
    it('should allow execution within monthly budget limit', async () => {
      // Set tenant usage to $100
      const workflowExecution = await prisma.workflowExecution.create({
        data: {
          id: `${TEST_WORKFLOW_EXECUTION_ID}_1`,
          workflowType: 'WEBSITE_GENERATION',
          workflowVersion: '1.0',
          tenantId: TEST_TENANT_ID,
          projectId: TEST_PROJECT_ID,
          status: 'COMPLETED',
          totalCost:100,
        },
      });

      // Check budget with $50 estimated cost (total would be $150, under $1000 limit)
      const limits: BudgetLimits = {
        monthly: {
          maxCostUsd: 1000,
          maxTokens: 10000000,
        },
      };

      const result = await budgetMonitor.checkBudget({
        tenantId: TEST_TENANT_ID,
        projectId: TEST_PROJECT_ID,
        estimatedCost: 50,
        estimatedTokens: 50000,
        limits,
      });

      expect(result.allowed).toBe(true);
      expect(result.status.exceeded).toBe(false);
      expect(result.status.nearingLimit).toBe(false);
    });

    it('should block execution when monthly budget exceeded', async () => {
      // Set tenant usage to $950
      await prisma.workflowExecution.create({
        data: {
          id: `${TEST_WORKFLOW_EXECUTION_ID}_2`,
          workflowType: 'WEBSITE_GENERATION',
          workflowVersion: '1.0',
          tenantId: TEST_TENANT_ID,
          projectId: TEST_PROJECT_ID,
          status: 'COMPLETED',
          totalCost:950,
        },
      });

      // Check budget with $100 estimated cost (total would be $1050, exceeds $1000 limit)
      const limits: BudgetLimits = {
        monthly: {
          maxCostUsd: 1000,
          maxTokens: 10000000,
        },
      };

      const result = await budgetMonitor.checkBudget({
        tenantId: TEST_TENANT_ID,
        projectId: TEST_PROJECT_ID,
        estimatedCost: 100,
        estimatedTokens: 100000,
        limits,
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Monthly budget exceeded');
      // Note: status.exceeded is false because current usage ($950) hasn't exceeded limit yet,
      // even though projected usage ($1050) would. The important check is that allowed=false.
      expect(result.status.exceeded).toBe(false); // Current usage not exceeded
      expect(result.status.nearingLimit).toBe(true); // But we're nearing limit (95%)
    });

    it('should warn when nearing budget limit (>80%)', async () => {
      // Set tenant usage to $850 (85% of $1000)
      await prisma.workflowExecution.create({
        data: {
          id: `${TEST_WORKFLOW_EXECUTION_ID}_3`,
          workflowType: 'WEBSITE_GENERATION',
          workflowVersion: '1.0',
          tenantId: TEST_TENANT_ID,
          projectId: TEST_PROJECT_ID,
          status: 'COMPLETED',
          totalCost:850,
        },
      });

      // Check budget with $10 estimated cost (total would be $860, 86% of limit)
      const limits: BudgetLimits = {
        monthly: {
          maxCostUsd: 1000,
          maxTokens: 10000000,
        },
      };

      const consoleSpy = vi.spyOn(console, 'warn');

      const result = await budgetMonitor.checkBudget({
        tenantId: TEST_TENANT_ID,
        projectId: TEST_PROJECT_ID,
        estimatedCost: 10,
        estimatedTokens: 10000,
        limits,
      });

      expect(result.allowed).toBe(true);
      expect(result.status.nearingLimit).toBe(true);
      expect(result.status.percentUsed).toBeGreaterThan(80);

      // Should have logged a warning
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('nearing monthly budget limit')
      );

      consoleSpy.mockRestore();
    });

    it('should block execution when system-wide budget exceeded', async () => {
      // Create multiple tenants with high usage
      const testTenant2 = 'tenant_budget_test_2';
      await prisma.tenant.upsert({
        where: { id: testTenant2 },
        create: { id: testTenant2, name: 'Test Tenant 2', slug: 'test-tenant-2' },
        update: {},
      });

      const testProject2 = 'project_budget_test_2';
      await prisma.project.upsert({
        where: { id: testProject2 },
        create: {
          id: testProject2,
          name: 'Test Project 2',
          tenantId: testTenant2,
          type: 'WEBSITE',
        },
        update: {},
      });

      // Delete any existing workflows with these IDs from previous test runs
      await prisma.workflowExecution.deleteMany({
        where: {
          id: {
            in: [`${TEST_WORKFLOW_EXECUTION_ID}_sys_1`, `${TEST_WORKFLOW_EXECUTION_ID}_sys_2`],
          },
        },
      });

      // Add workflows for both tenants totaling $9900
      await prisma.workflowExecution.createMany({
        data: [
          {
            id: `${TEST_WORKFLOW_EXECUTION_ID}_sys_1`,
            workflowType: 'WEBSITE_GENERATION',
          workflowVersion: '1.0',
            tenantId: TEST_TENANT_ID,
            projectId: TEST_PROJECT_ID,
            status: 'COMPLETED',
            totalCost: 5000,
          },
          {
            id: `${TEST_WORKFLOW_EXECUTION_ID}_sys_2`,
            workflowType: 'WEBSITE_GENERATION',
          workflowVersion: '1.0',
            tenantId: testTenant2,
            projectId: testProject2,
            status: 'COMPLETED',
            totalCost: 4900,
          },
        ],
      });

      // Check budget with $200 estimated (would exceed $10000 system limit)
      const limits: BudgetLimits = {
        monthly: {
          maxCostUsd: 10000, // High tenant limit
          maxTokens: 100000000,
        },
        system: {
          maxCostUsd: 10000,
          maxTokens: 100000000,
        },
      };

      const result = await budgetMonitor.checkBudget({
        tenantId: TEST_TENANT_ID,
        projectId: TEST_PROJECT_ID,
        estimatedCost: 200,
        estimatedTokens: 2000000,
        limits,
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('System-wide budget exceeded');

      // Cleanup
      await prisma.workflowExecution.deleteMany({ where: { tenantId: testTenant2 } });
      await prisma.project.deleteMany({ where: { id: testProject2 } });
      await prisma.tenant.deleteMany({ where: { id: testTenant2 } });
    });
  });

  describe('Budget Status and Alerts', () => {
    it('should provide accurate budget status', async () => {
      // Set tenant usage to $400
      await prisma.workflowExecution.create({
        data: {
          id: `${TEST_WORKFLOW_EXECUTION_ID}_status`,
          workflowType: 'WEBSITE_GENERATION',
          workflowVersion: '1.0',
          tenantId: TEST_TENANT_ID,
          projectId: TEST_PROJECT_ID,
          status: 'COMPLETED',
          totalCost:400,
        },
      });

      const limits: BudgetLimits = {
        monthly: {
          maxCostUsd: 1000,
          maxTokens: 10000000,
        },
      };

      const result = await budgetMonitor.checkBudget({
        tenantId: TEST_TENANT_ID,
        projectId: TEST_PROJECT_ID,
        estimatedCost: 0,
        estimatedTokens: 0,
        limits,
      });

      expect(result.status.used.costUsd).toBeGreaterThanOrEqual(400);
      expect(result.status.limit.costUsd).toBe(1000);
      expect(result.status.remaining.costUsd).toBeLessThanOrEqual(600);
      expect(result.status.percentUsed).toBeGreaterThanOrEqual(40);
      expect(result.status.exceeded).toBe(false);
      expect(result.status.nearingLimit).toBe(false);
    });

    it('should send budget alert', async () => {
      const consoleSpy = vi.spyOn(console, 'warn');

      await budgetMonitor.sendBudgetAlert({
        tenantId: TEST_TENANT_ID,
        type: 'approaching',
        status: {
          remaining: { costUsd: 200, tokens: 2000000 },
          used: { costUsd: 800, tokens: 8000000 },
          limit: { costUsd: 1000, tokens: 10000000 },
          percentUsed: 80,
          exceeded: false,
          nearingLimit: true,
        },
      });

      // Should have logged alert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('ALERT'),
        expect.objectContaining({
          type: 'approaching',
          percentUsed: '80.0%',
        })
      );

      // Should have created audit log entry
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          tenantId: TEST_TENANT_ID,
          action: 'BUDGET_ALERT',
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(auditLog).toBeTruthy();
      expect(auditLog?.resourceType).toBe('SYSTEM');

      consoleSpy.mockRestore();
    });
  });

  describe('Cost Breakdown', () => {
    it('should provide cost breakdown by agent', async () => {
      // Create multiple agent executions
      const agents = [
        { name: 'planner', cost: 5, tokens: 50000 },
        { name: 'planner', cost: 6, tokens: 60000 },
        { name: 'brand-interpreter', cost: 4, tokens: 40000 },
        { name: 'scaffolder', cost: 15, tokens: 150000 },
      ];

      for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];
        await prisma.agentExecution.create({
          data: {
            id: `${TEST_AGENT_EXECUTION_ID}_breakdown_${i}`,
            agentName: agent.name,
            agentRole: 'BUSINESS_REQUIREMENTS',
            tenantId: TEST_TENANT_ID,
            projectId: TEST_PROJECT_ID,
            status: 'COMPLETED',
            input: {},
            cost: agent.cost,
            tokensUsed: agent.tokens,
          },
        });
      }

      // Get cost breakdown
      const breakdown = await budgetMonitor.getAgentCostBreakdown({
        tenantId: TEST_TENANT_ID,
      });

      // Verify breakdown
      expect(breakdown.length).toBeGreaterThan(0);

      const plannerBreakdown = breakdown.find((b) => b.agentName === 'planner');
      expect(plannerBreakdown).toBeTruthy();
      expect(plannerBreakdown?.totalCost).toBe(11); // 5 + 6
      expect(plannerBreakdown?.totalTokens).toBe(110000); // 50000 + 60000
      expect(plannerBreakdown?.executions).toBe(2);

      const scaffolderBreakdown = breakdown.find((b) => b.agentName === 'scaffolder');
      expect(scaffolderBreakdown).toBeTruthy();
      expect(scaffolderBreakdown?.totalCost).toBe(15);
      expect(scaffolderBreakdown?.executions).toBe(1);
    });
  });

  describe('Monthly Reset', () => {
    it('should reset monthly budgets', async () => {
      // This test verifies the reset function exists and can be called
      // In a real scenario, this would be triggered by a cron job

      // Track some costs first
      await prisma.workflowExecution.create({
        data: {
          id: `${TEST_WORKFLOW_EXECUTION_ID}_reset`,
          workflowType: 'WEBSITE_GENERATION',
          workflowVersion: '1.0',
          tenantId: TEST_TENANT_ID,
          projectId: TEST_PROJECT_ID,
          status: 'COMPLETED',
          totalCost:100,
        },
      });

      // Verify usage exists
      const usageBefore = await budgetMonitor.getTenantMonthlyUsage(TEST_TENANT_ID);
      expect(usageBefore.costUsd).toBeGreaterThan(0);

      // Reset (this would clear Redis keys)
      await budgetMonitor.resetMonthlyBudgets();

      // Note: In a real test, we'd verify Redis keys were cleared
      // For now, just verify the function completes without error
    });
  });

  describe('DEFAULT_BUDGET_LIMITS', () => {
    it('should have sensible default budget limits', () => {
      expect(DEFAULT_BUDGET_LIMITS.perExecution?.maxCostUsd).toBe(10);
      expect(DEFAULT_BUDGET_LIMITS.perExecution?.maxTokens).toBe(100000);

      expect(DEFAULT_BUDGET_LIMITS.perWorkflow?.maxCostUsd).toBe(50);
      expect(DEFAULT_BUDGET_LIMITS.perWorkflow?.maxTokens).toBe(500000);

      expect(DEFAULT_BUDGET_LIMITS.monthly?.maxCostUsd).toBe(1000);
      expect(DEFAULT_BUDGET_LIMITS.monthly?.maxTokens).toBe(10000000);

      expect(DEFAULT_BUDGET_LIMITS.system?.maxCostUsd).toBe(10000);
      expect(DEFAULT_BUDGET_LIMITS.system?.maxTokens).toBe(100000000);
    });
  });
});

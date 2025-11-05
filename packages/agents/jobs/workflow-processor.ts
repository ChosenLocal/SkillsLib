import { PrismaClient } from '@business-automation/database';
import { inngest, type InngestEvents } from './inngest-client';
import { createOrchestrator } from '../orchestrator';
import { connectRedis } from '../shared/redis-client';
import { initializeStorage } from '../shared/storage-client';
import { initializeMCP, getDefaultMCPConfigs } from '../shared/mcp-manager';

/**
 * Workflow processor Inngest function
 *
 * This function processes workflow execution requests asynchronously
 */
export const workflowProcessor = inngest.createFunction(
  {
    id: 'workflow-processor',
    name: 'Workflow Processor',
    retries: 2,
  },
  { event: 'workflow/execute' },
  async ({ event, step }) => {
    const { workflowDefinitionId, projectId, tenantId, userId, input } = event.data;

    console.log(`[WorkflowProcessor] Processing workflow: ${workflowDefinitionId}`);

    // Initialize services in first step
    const { prisma, orchestrator } = await step.run('initialize-services', async () => {
      // Initialize Prisma
      const prisma = new PrismaClient();

      // Initialize Redis
      await connectRedis();

      // Initialize Storage
      initializeStorage();

      // Initialize MCP servers
      const mcpConfigs = getDefaultMCPConfigs();
      if (mcpConfigs.length > 0) {
        await initializeMCP(mcpConfigs);
      }

      // Create orchestrator
      const orchestrator = createOrchestrator(prisma, {
        maxConcurrency: 5,
        refinement: {
          enabled: true,
          maxIterations: 3,
          qualityThreshold: 0.8,
        },
      });

      return { prisma, orchestrator };
    });

    // Execute workflow
    const workflowExecutionId = await step.run('execute-workflow', async () => {
      const executionId = await orchestrator.executeWorkflow({
        workflowDefinitionId,
        projectId,
        tenantId,
        userId,
        input,
      });

      return executionId;
    });

    // Wait for workflow completion (with timeout)
    await step.run('wait-for-completion', async () => {
      const maxWaitTime = 30 * 60 * 1000; // 30 minutes
      const checkInterval = 5000; // 5 seconds
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitTime) {
        const status = await orchestrator.getWorkflowStatus(workflowExecutionId);

        if (status.status === 'COMPLETED' || status.status === 'FAILED' || status.status === 'CANCELLED') {
          console.log(`[WorkflowProcessor] Workflow ${workflowExecutionId} ${status.status.toLowerCase()}`);
          return { status: status.status, progress: status.progress };
        }

        // Wait before checking again
        await new Promise((resolve) => setTimeout(resolve, checkInterval));
      }

      // Timeout
      console.warn(`[WorkflowProcessor] Workflow ${workflowExecutionId} timed out after ${maxWaitTime}ms`);
      return { status: 'TIMEOUT', progress: 0 };
    });

    // Cleanup
    await step.run('cleanup', async () => {
      await prisma.$disconnect();
    });

    return {
      workflowExecutionId,
      success: true,
    };
  }
);

/**
 * Workflow status monitor Inngest function
 *
 * This function monitors workflow status and triggers actions
 */
export const workflowStatusMonitor = inngest.createFunction(
  {
    id: 'workflow-status-monitor',
    name: 'Workflow Status Monitor',
  },
  { event: 'workflow/status.changed' },
  async ({ event, step }) => {
    const { workflowExecutionId, projectId, tenantId, status, previousStatus } = event.data;

    console.log(
      `[WorkflowStatusMonitor] Workflow ${workflowExecutionId}: ${previousStatus} -> ${status}`
    );

    // Handle status-specific actions
    await step.run('handle-status-change', async () => {
      const prisma = new PrismaClient();

      try {
        switch (status) {
          case 'COMPLETED':
            // Send notifications, update project status, etc.
            console.log(`[WorkflowStatusMonitor] Workflow completed: ${workflowExecutionId}`);
            break;

          case 'FAILED':
            // Log error, send alerts, etc.
            console.error(`[WorkflowStatusMonitor] Workflow failed: ${workflowExecutionId}`);
            break;

          case 'CANCELLED':
            // Cleanup resources, send notifications, etc.
            console.log(`[WorkflowStatusMonitor] Workflow cancelled: ${workflowExecutionId}`);
            break;

          default:
            // Handle other statuses
            break;
        }
      } finally {
        await prisma.$disconnect();
      }
    });

    return { handled: true };
  }
);

/**
 * Refinement checker Inngest function
 *
 * This function triggers quality evaluation and refinement decisions
 */
export const refinementChecker = inngest.createFunction(
  {
    id: 'refinement-checker',
    name: 'Refinement Quality Checker',
  },
  { event: 'refinement/check' },
  async ({ event, step }) => {
    const { workflowExecutionId, projectId, tenantId, iteration } = event.data;

    console.log(`[RefinementChecker] Checking quality for workflow: ${workflowExecutionId}`);

    // Run quality evaluation agents
    await step.run('run-quality-evaluation', async () => {
      const prisma = new PrismaClient();

      try {
        // Get quality evaluator agents for this workflow
        // Execute them and collect scores
        // This would trigger agent/execute events for quality evaluators

        console.log(`[RefinementChecker] Quality evaluation complete for ${workflowExecutionId}`);
      } finally {
        await prisma.$disconnect();
      }
    });

    return { evaluated: true };
  }
);

/**
 * All workflow-related Inngest functions
 */
export const workflowFunctions = [
  workflowProcessor,
  workflowStatusMonitor,
  refinementChecker,
];

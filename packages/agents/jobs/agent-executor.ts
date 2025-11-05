import { PrismaClient, type AgentRole } from '@business-automation/database';
import { inngest, type InngestEvents } from './inngest-client';
import { createAgent } from '../orchestrator/registry';
import { createAgentContext } from '../shared/base-agent';
import { connectRedis } from '../shared/redis-client';
import { initializeStorage } from '../shared/storage-client';

/**
 * Agent executor Inngest function
 *
 * This function executes individual agents asynchronously
 */
export const agentExecutor = inngest.createFunction(
  {
    id: 'agent-executor',
    name: 'Agent Executor',
    retries: 3,
    rateLimit: {
      limit: 10, // Max 10 concurrent agent executions
      period: '1s',
    },
  },
  { event: 'agent/execute' },
  async ({ event, step }) => {
    const {
      agentRole,
      agentExecutionId,
      workflowExecutionId,
      projectId,
      tenantId,
      userId,
      input,
      config,
    } = event.data;

    console.log(`[AgentExecutor] Executing agent: ${agentRole} (${agentExecutionId})`);

    // Initialize services
    await step.run('initialize-services', async () => {
      await connectRedis();
      initializeStorage();
    });

    // Execute agent
    const result = await step.run('execute-agent', async () => {
      const prisma = new PrismaClient();

      try {
        // Create agent context
        const context = createAgentContext({
          tenantId,
          projectId,
          workflowExecutionId,
          agentExecutionId,
          userId,
          traceId: `trace_${Date.now()}`,
          spanId: `span_${Date.now()}`,
          prisma,
          redis: null, // Will be populated by shared utilities
          storage: null,
          orchestrator: null, // Standalone execution
          clientSchema: {} as any,
          config: {},
        });

        // Create and run agent
        const agent = createAgent(agentRole as AgentRole, context, config);
        const executionResult = await agent.run(input);

        return executionResult;
      } finally {
        await prisma.$disconnect();
      }
    });

    return {
      agentExecutionId,
      success: result.success,
      output: result.output,
      error: result.error,
    };
  }
);

/**
 * Agent status monitor Inngest function
 *
 * This function monitors agent status changes and triggers actions
 */
export const agentStatusMonitor = inngest.createFunction(
  {
    id: 'agent-status-monitor',
    name: 'Agent Status Monitor',
  },
  { event: 'agent/status.changed' },
  async ({ event, step }) => {
    const {
      agentExecutionId,
      agentRole,
      workflowExecutionId,
      projectId,
      tenantId,
      status,
      previousStatus,
    } = event.data;

    console.log(`[AgentStatusMonitor] Agent ${agentRole} (${agentExecutionId}): ${previousStatus} -> ${status}`);

    // Handle status-specific actions
    await step.run('handle-status-change', async () => {
      const prisma = new PrismaClient();

      try {
        switch (status) {
          case 'COMPLETED':
            // Check if this was the last agent in workflow
            const workflow = await prisma.workflowExecution.findUnique({
              where: { id: workflowExecutionId },
              include: {
                agentExecutions: {
                  select: { status: true },
                },
              },
            });

            if (workflow) {
              const allCompleted = workflow.agentExecutions.every(
                (a) => a.status === 'COMPLETED' || a.status === 'FAILED'
              );

              if (allCompleted) {
                console.log(`[AgentStatusMonitor] All agents completed for workflow: ${workflowExecutionId}`);
              }
            }
            break;

          case 'FAILED':
            // Log failure, potentially retry or alert
            console.error(`[AgentStatusMonitor] Agent failed: ${agentRole} (${agentExecutionId})`);
            break;

          case 'RETRYING':
            // Track retry attempts
            console.warn(`[AgentStatusMonitor] Agent retrying: ${agentRole} (${agentExecutionId})`);
            break;

          default:
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
 * Batch agent executor for parallel execution
 */
export const batchAgentExecutor = inngest.createFunction(
  {
    id: 'batch-agent-executor',
    name: 'Batch Agent Executor',
    retries: 2,
  },
  { event: 'agent/execute.batch' },
  async ({ event, step }) => {
    const { agents, workflowExecutionId, projectId, tenantId } = event.data as {
      agents: Array<{
        agentRole: string;
        agentExecutionId: string;
        input: any;
        config?: any;
      }>;
      workflowExecutionId: string;
      projectId: string;
      tenantId: string;
    };

    console.log(`[BatchAgentExecutor] Executing ${agents.length} agents in parallel`);

    // Initialize services once
    await step.run('initialize-services', async () => {
      await connectRedis();
      initializeStorage();
    });

    // Execute agents in parallel
    const results = await step.run('execute-agents-parallel', async () => {
      const prisma = new PrismaClient();

      try {
        const executions = agents.map(async (agentData) => {
          const context = createAgentContext({
            tenantId,
            projectId,
            workflowExecutionId,
            agentExecutionId: agentData.agentExecutionId,
            traceId: `trace_${Date.now()}`,
            spanId: `span_${Date.now()}`,
            prisma,
            redis: null,
            storage: null,
            orchestrator: null,
            clientSchema: {} as any,
            config: {},
          });

          const agent = createAgent(agentData.agentRole as AgentRole, context, agentData.config);
          const result = await agent.run(agentData.input);

          return {
            agentExecutionId: agentData.agentExecutionId,
            agentRole: agentData.agentRole,
            success: result.success,
            output: result.output,
            error: result.error,
          };
        });

        return Promise.all(executions);
      } finally {
        await prisma.$disconnect();
      }
    });

    return {
      totalAgents: agents.length,
      completedAgents: results.filter((r) => r.success).length,
      failedAgents: results.filter((r) => !r.success).length,
      results,
    };
  }
);

/**
 * All agent-related Inngest functions
 */
export const agentFunctions = [
  agentExecutor,
  agentStatusMonitor,
  batchAgentExecutor,
];

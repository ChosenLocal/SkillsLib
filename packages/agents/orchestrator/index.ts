import { PrismaClient, type AgentRole, type WorkflowStatus } from '@business-automation/database';
import type { WorkflowDefinition, ClientSchema } from '@business-automation/schema';
import { randomUUID } from 'crypto';
import { buildDAGFromWorkflow, buildDAGFromRoles, optimizeExecutionPlan } from './dag-builder';
import { createExecutionEngine, type WorkflowExecutionResult } from './executor';
import { createContextBuilder, type ContextBuilder } from './context-builder';
import { createRefinementEngine, type RefinementConfig, type RefinementDecision } from './refinement';
import { getEventBus, WorkflowEventType, type WorkflowEventBus } from './events';
import { getRegistry } from './registry';

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  maxConcurrency?: number;
  refinement?: Partial<RefinementConfig>;
  maxRefinementIterations?: number;
}

/**
 * Workflow execution configuration
 */
export interface WorkflowExecutionConfig {
  workflowDefinitionId: string;
  projectId: string;
  tenantId: string;
  userId?: string;
  clientSchema?: ClientSchema;
  input?: any;
}

/**
 * Main orchestrator for managing agent workflows
 */
export class Orchestrator {
  private prisma: PrismaClient;
  private config: OrchestratorConfig;

  constructor(prisma: PrismaClient, config: OrchestratorConfig = {}) {
    this.prisma = prisma;
    this.config = {
      maxConcurrency: config.maxConcurrency || 5,
      refinement: config.refinement || {},
      maxRefinementIterations: config.maxRefinementIterations || 3,
    };
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(executionConfig: WorkflowExecutionConfig): Promise<string> {
    // Load workflow definition
    const workflowDef = await this.prisma.workflowDefinition.findUnique({
      where: { id: executionConfig.workflowDefinitionId },
    });

    if (!workflowDef) {
      throw new Error(`Workflow definition not found: ${executionConfig.workflowDefinitionId}`);
    }

    // Create workflow execution record
    const workflowExecutionId = `workflow_${randomUUID()}`;
    const traceId = `trace_${randomUUID()}`;

    await this.prisma.workflowExecution.create({
      data: {
        id: workflowExecutionId,
        tenantId: executionConfig.tenantId,
        projectId: executionConfig.projectId,
        workflowDefinitionId: executionConfig.workflowDefinitionId,
        status: 'RUNNING',
        traceId,
        input: executionConfig.input as any,
        startedAt: new Date(),
      },
    });

    // Get event bus
    const eventBus = getEventBus(executionConfig.tenantId, workflowExecutionId);

    // Emit started event
    await eventBus.emitWorkflowEvent(WorkflowEventType.WORKFLOW_STARTED, {
      workflowDefinitionId: executionConfig.workflowDefinitionId,
      projectId: executionConfig.projectId,
    });

    // Execute workflow in background (don't await)
    this.runWorkflow(workflowExecutionId, workflowDef, executionConfig, traceId, eventBus).catch(
      (error) => {
        console.error(`[Orchestrator] Workflow execution failed: ${workflowExecutionId}`, error);
      }
    );

    return workflowExecutionId;
  }

  /**
   * Internal workflow execution with refinement loop
   */
  private async runWorkflow(
    workflowExecutionId: string,
    workflowDef: any,
    executionConfig: WorkflowExecutionConfig,
    traceId: string,
    eventBus: WorkflowEventBus
  ): Promise<void> {
    try {
      // Build DAG from workflow definition
      const dag = buildDAGFromWorkflow(workflowDef as WorkflowDefinition);
      const plan = optimizeExecutionPlan(dag, this.config.maxConcurrency);

      console.log(
        `[Orchestrator] Executing workflow ${workflowExecutionId}: ` +
          `${plan.totalAgents} agents in ${plan.stages.length} stages`
      );

      // Create context builder
      const contextBuilder = createContextBuilder(this.prisma, {
        tenantId: executionConfig.tenantId,
        projectId: executionConfig.projectId,
        workflowExecutionId,
        userId: executionConfig.userId,
        traceId,
        clientSchema: executionConfig.clientSchema,
      });

      // Set orchestrator reference for agent-to-agent calls
      contextBuilder.setOrchestrator(this);

      // Create refinement engine
      const refinementEngine = createRefinementEngine(this.prisma, this.config.refinement);

      // Refinement loop
      let iteration = 0;
      let shouldContinue = true;
      let lastResult: WorkflowExecutionResult | null = null;

      while (shouldContinue && iteration <= this.config.maxRefinementIterations!) {
        if (iteration > 0) {
          await eventBus.emitWorkflowEvent(WorkflowEventType.REFINEMENT_STARTED, { iteration });
        }

        // Execute workflow
        lastResult = await this.executeWorkflowOnce(
          workflowExecutionId,
          dag,
          contextBuilder,
          executionConfig,
          eventBus,
          iteration
        );

        // Check for refinement (skip on last iteration)
        if (iteration < this.config.maxRefinementIterations!) {
          const decision = await refinementEngine.decideRefinement(workflowExecutionId, lastResult);

          await eventBus.emitWorkflowEvent(WorkflowEventType.REFINEMENT_DECISION, {
            decision: decision.shouldRefine ? 'refine' : 'accept',
            reason: decision.reason,
            iteration: decision.iteration,
            metrics: {
              overallScore: decision.metrics.overallScore,
              failedDimensions: decision.metrics.failedDimensions.length,
            },
          });

          if (decision.shouldRefine) {
            console.log(
              `[Orchestrator] Refinement needed (iteration ${iteration + 1}): ${decision.reason}`
            );
            refinementEngine.incrementIteration();
            iteration++;
          } else {
            console.log(`[Orchestrator] Quality acceptable: ${decision.reason}`);
            shouldContinue = false;
          }
        } else {
          shouldContinue = false;
        }
      }

      // Update workflow execution with final result
      const finalStatus: WorkflowStatus = lastResult!.success ? 'COMPLETED' : 'FAILED';

      await this.prisma.workflowExecution.update({
        where: { id: workflowExecutionId },
        data: {
          status: finalStatus,
          output: Object.fromEntries(lastResult!.outputs) as any,
          error: lastResult!.errors.size > 0 ? Array.from(lastResult!.errors.values()).join('; ') : null,
          completedAt: new Date(),
          iteration,
        },
      });

      // Emit completed event
      await eventBus.emitWorkflowEvent(
        lastResult!.success ? WorkflowEventType.WORKFLOW_COMPLETED : WorkflowEventType.WORKFLOW_FAILED,
        {
          totalAgents: lastResult!.totalAgents,
          completedAgents: lastResult!.completedAgents.length,
          failedAgents: lastResult!.failedAgents.length,
          totalDuration: lastResult!.totalDuration,
          iterations: iteration + 1,
        }
      );

      console.log(
        `[Orchestrator] Workflow ${workflowExecutionId} ${finalStatus.toLowerCase()} after ${iteration + 1} iteration(s)`
      );
    } catch (error: any) {
      console.error(`[Orchestrator] Workflow execution error: ${workflowExecutionId}`, error);

      // Update workflow execution with error
      await this.prisma.workflowExecution.update({
        where: { id: workflowExecutionId },
        data: {
          status: 'FAILED',
          error: error.message,
          completedAt: new Date(),
        },
      });

      // Emit failed event
      await eventBus.emitWorkflowEvent(WorkflowEventType.WORKFLOW_FAILED, {
        error: error.message,
      });
    }
  }

  /**
   * Execute workflow once (single iteration)
   */
  private async executeWorkflowOnce(
    workflowExecutionId: string,
    dag: any,
    contextBuilder: ContextBuilder,
    executionConfig: WorkflowExecutionConfig,
    eventBus: WorkflowEventBus,
    iteration: number
  ): Promise<WorkflowExecutionResult> {
    // Create execution engine
    const executor = createExecutionEngine(
      {
        tenantId: executionConfig.tenantId,
        workflowExecutionId,
        projectId: executionConfig.projectId,
        userId: executionConfig.userId,
        traceId: contextBuilder.getBaseConfig().traceId,
      },
      this.config.maxConcurrency
    );

    // Execute workflow with DAG
    const result = await executor.executeWorkflow(
      dag,
      (role, parentSpanId) => contextBuilder.build(role, parentSpanId),
      (role, previousOutputs) => {
        // Build input for agent from previous outputs and workflow input
        return {
          ...executionConfig.input,
          previousOutputs: Object.fromEntries(previousOutputs),
          iteration,
        };
      },
      (role) => {
        // Get agent-specific config from workflow definition
        return {};
      }
    );

    return result;
  }

  /**
   * Execute specific agents (not full workflow)
   */
  async executeAgents(
    tenantId: string,
    projectId: string,
    roles: AgentRole[],
    input: any,
    options: { userId?: string; clientSchema?: ClientSchema } = {}
  ): Promise<WorkflowExecutionResult> {
    const workflowExecutionId = `adhoc_${randomUUID()}`;
    const traceId = `trace_${randomUUID()}`;

    // Build DAG from roles
    const dag = buildDAGFromRoles(roles);

    // Create context builder
    const contextBuilder = createContextBuilder(this.prisma, {
      tenantId,
      projectId,
      workflowExecutionId,
      userId: options.userId,
      traceId,
      clientSchema: options.clientSchema,
    });

    contextBuilder.setOrchestrator(this);

    // Create execution engine
    const executor = createExecutionEngine(
      {
        tenantId,
        workflowExecutionId,
        projectId,
        userId: options.userId,
        traceId,
      },
      this.config.maxConcurrency
    );

    // Execute
    const result = await executor.executeWorkflow(
      dag,
      (role, parentSpanId) => contextBuilder.build(role, parentSpanId),
      (role, previousOutputs) => ({
        ...input,
        previousOutputs: Object.fromEntries(previousOutputs),
      })
    );

    return result;
  }

  /**
   * Dispatch agent (for agent-to-agent calls)
   */
  async dispatch(role: AgentRole, input: any): Promise<any> {
    // This is called from within an agent context
    // For now, throw error - agents should be coordinated by orchestrator
    throw new Error('Agent-to-agent dispatch not yet implemented. Use orchestrator coordination.');
  }

  /**
   * Pause workflow execution
   */
  async pauseWorkflow(workflowExecutionId: string): Promise<void> {
    await this.prisma.workflowExecution.update({
      where: { id: workflowExecutionId },
      data: { status: 'PAUSED' },
    });

    const workflow = await this.prisma.workflowExecution.findUnique({
      where: { id: workflowExecutionId },
      select: { tenantId: true },
    });

    if (workflow) {
      const eventBus = getEventBus(workflow.tenantId, workflowExecutionId);
      await eventBus.emitWorkflowEvent(WorkflowEventType.WORKFLOW_PAUSED, {});
    }
  }

  /**
   * Resume workflow execution
   */
  async resumeWorkflow(workflowExecutionId: string): Promise<void> {
    await this.prisma.workflowExecution.update({
      where: { id: workflowExecutionId },
      data: { status: 'RUNNING' },
    });

    const workflow = await this.prisma.workflowExecution.findUnique({
      where: { id: workflowExecutionId },
      select: { tenantId: true },
    });

    if (workflow) {
      const eventBus = getEventBus(workflow.tenantId, workflowExecutionId);
      await eventBus.emitWorkflowEvent(WorkflowEventType.WORKFLOW_RESUMED, {});
    }
  }

  /**
   * Cancel workflow execution
   */
  async cancelWorkflow(workflowExecutionId: string): Promise<void> {
    await this.prisma.workflowExecution.update({
      where: { id: workflowExecutionId },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });

    const workflow = await this.prisma.workflowExecution.findUnique({
      where: { id: workflowExecutionId },
      select: { tenantId: true },
    });

    if (workflow) {
      const eventBus = getEventBus(workflow.tenantId, workflowExecutionId);
      await eventBus.emitWorkflowEvent(WorkflowEventType.WORKFLOW_CANCELLED, {});
    }
  }

  /**
   * Get workflow status
   */
  async getWorkflowStatus(workflowExecutionId: string): Promise<{
    status: WorkflowStatus;
    progress: number;
    completedAgents: number;
    totalAgents: number;
  }> {
    const workflow = await this.prisma.workflowExecution.findUnique({
      where: { id: workflowExecutionId },
      include: {
        agentExecutions: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowExecutionId}`);
    }

    const totalAgents = workflow.agentExecutions.length;
    const completedAgents = workflow.agentExecutions.filter(
      (a) => a.status === 'COMPLETED'
    ).length;

    const progress = totalAgents > 0 ? completedAgents / totalAgents : 0;

    return {
      status: workflow.status,
      progress,
      completedAgents,
      totalAgents,
    };
  }

  /**
   * Get registry statistics
   */
  getRegistryStats() {
    return getRegistry().getStats();
  }
}

/**
 * Create orchestrator instance
 */
export function createOrchestrator(
  prisma: PrismaClient,
  config?: OrchestratorConfig
): Orchestrator {
  return new Orchestrator(prisma, config);
}

// Re-export key types and functions
export * from './registry';
export * from './dag-builder';
export * from './executor';
export * from './context-builder';
export * from './refinement';
export * from './events';

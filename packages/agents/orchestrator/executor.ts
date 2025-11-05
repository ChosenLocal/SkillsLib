import PQueue from 'p-queue';
import type { AgentRole } from '@business-automation/database';
import type { BaseAgent, ExtendedAgentContext, AgentExecutionResult } from '../shared/base-agent';
import { createAgent } from './registry';
import type { DAG, ExecutionPlan } from './dag-builder';
import { withLock } from '../shared/redis-client';

/**
 * Execution context for a workflow
 */
export interface ExecutionContext {
  tenantId: string;
  workflowExecutionId: string;
  projectId: string;
  userId?: string;
  traceId: string;
}

/**
 * Agent execution options
 */
export interface AgentExecutionOptions {
  input: any;
  config?: any;
  parentSpanId?: string;
}

/**
 * Agent execution result with metadata
 */
export interface AgentExecutionRecord {
  role: AgentRole;
  agentExecutionId: string;
  result: AgentExecutionResult;
  startTime: Date;
  endTime: Date;
  duration: number;
}

/**
 * Workflow execution result
 */
export interface WorkflowExecutionResult {
  success: boolean;
  completedAgents: AgentExecutionRecord[];
  failedAgents: AgentExecutionRecord[];
  totalAgents: number;
  totalDuration: number;
  outputs: Map<AgentRole, any>;
  errors: Map<AgentRole, string>;
}

/**
 * Execution engine for running agents
 */
export class ExecutionEngine {
  private queue: PQueue;
  private context: ExecutionContext;
  private agentResults: Map<AgentRole, AgentExecutionRecord> = new Map();

  constructor(context: ExecutionContext, maxConcurrency: number = 5) {
    this.context = context;
    this.queue = new PQueue({ concurrency: maxConcurrency });
  }

  /**
   * Execute a single agent
   */
  async executeAgent(
    role: AgentRole,
    options: AgentExecutionOptions,
    agentContext: ExtendedAgentContext
  ): Promise<AgentExecutionRecord> {
    const startTime = new Date();
    const agentExecutionId = agentContext.agentExecutionId;

    console.log(`[Executor] Starting agent: ${role} (${agentExecutionId})`);

    try {
      // Acquire distributed lock to prevent duplicate execution
      const lockResult = await withLock(
        this.context.tenantId,
        `agent:${agentExecutionId}`,
        async () => {
          // Create agent instance
          const agent = createAgent(role, agentContext, options.config);

          // Execute agent
          const result = await agent.run(options.input);

          return result;
        },
        { ttl: 300000, retries: 0 } // 5 minutes, no retries (fail if locked)
      );

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      const record: AgentExecutionRecord = {
        role,
        agentExecutionId,
        result: lockResult,
        startTime,
        endTime,
        duration,
      };

      this.agentResults.set(role, record);

      console.log(`[Executor] Completed agent: ${role} in ${duration}ms`);
      return record;
    } catch (error: any) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      const record: AgentExecutionRecord = {
        role,
        agentExecutionId,
        result: {
          success: false,
          error: error.message,
        },
        startTime,
        endTime,
        duration,
      };

      this.agentResults.set(role, record);

      console.error(`[Executor] Failed agent: ${role} after ${duration}ms - ${error.message}`);
      return record;
    }
  }

  /**
   * Execute multiple agents in parallel
   */
  async executeAgentsParallel(
    agents: Array<{
      role: AgentRole;
      options: AgentExecutionOptions;
      context: ExtendedAgentContext;
    }>
  ): Promise<AgentExecutionRecord[]> {
    console.log(`[Executor] Executing ${agents.length} agents in parallel`);

    const promises = agents.map((agent) =>
      this.queue.add(() =>
        this.executeAgent(agent.role, agent.options, agent.context)
      )
    );

    const results = await Promise.all(promises);
    return results;
  }

  /**
   * Execute workflow using DAG execution plan
   */
  async executeWorkflow(
    dag: DAG,
    contextBuilder: (role: AgentRole, parentSpanId?: string) => ExtendedAgentContext,
    inputProvider: (role: AgentRole, previousOutputs: Map<AgentRole, any>) => any,
    configProvider?: (role: AgentRole) => any
  ): Promise<WorkflowExecutionResult> {
    const startTime = Date.now();
    const plan = dag.getExecutionPlan();

    console.log(
      `[Executor] Starting workflow execution: ${plan.totalAgents} agents in ${plan.stages.length} stages`
    );

    const outputs = new Map<AgentRole, any>();
    const errors = new Map<AgentRole, string>();

    // Execute stages sequentially
    for (const stage of plan.stages) {
      console.log(
        `[Executor] Stage ${stage.stage}: ${stage.agents.length} agents (parallel: ${stage.parallelizable})`
      );

      // Prepare agents for execution
      const agentsToExecute = stage.agents.map((role) => {
        const input = inputProvider(role, outputs);
        const config = configProvider ? configProvider(role) : undefined;
        const agentContext = contextBuilder(role);

        return {
          role,
          options: { input, config },
          context: agentContext,
        };
      });

      // Execute stage (parallel or sequential based on stage config)
      let stageResults: AgentExecutionRecord[];

      if (stage.parallelizable && stage.agents.length > 1) {
        stageResults = await this.executeAgentsParallel(agentsToExecute);
      } else {
        // Execute sequentially
        stageResults = [];
        for (const agent of agentsToExecute) {
          const result = await this.executeAgent(agent.role, agent.options, agent.context);
          stageResults.push(result);
        }
      }

      // Collect outputs and errors
      for (const record of stageResults) {
        if (record.result.success) {
          outputs.set(record.role, record.result.output);
        } else {
          errors.set(record.role, record.result.error || 'Unknown error');
        }
      }

      // Check for critical failures in stage
      const failedAgents = stageResults.filter((r) => !r.result.success);
      if (failedAgents.length > 0) {
        console.warn(
          `[Executor] Stage ${stage.stage} had ${failedAgents.length} failures:`,
          failedAgents.map((r) => r.role)
        );

        // Decide whether to continue or abort
        // For now, we continue with warnings
      }
    }

    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    // Collect results
    const allRecords = Array.from(this.agentResults.values());
    const completedAgents = allRecords.filter((r) => r.result.success);
    const failedAgents = allRecords.filter((r) => !r.result.success);

    const success = failedAgents.length === 0;

    console.log(
      `[Executor] Workflow execution ${success ? 'completed' : 'failed'}: ` +
        `${completedAgents.length}/${allRecords.length} agents succeeded in ${totalDuration}ms`
    );

    return {
      success,
      completedAgents,
      failedAgents,
      totalAgents: allRecords.length,
      totalDuration,
      outputs,
      errors,
    };
  }

  /**
   * Execute single stage with dependencies satisfied
   */
  async executeStage(
    roles: AgentRole[],
    contextBuilder: (role: AgentRole) => ExtendedAgentContext,
    inputProvider: (role: AgentRole, previousOutputs: Map<AgentRole, any>) => any,
    previousOutputs: Map<AgentRole, any>,
    configProvider?: (role: AgentRole) => any
  ): Promise<Map<AgentRole, any>> {
    const agentsToExecute = roles.map((role) => {
      const input = inputProvider(role, previousOutputs);
      const config = configProvider ? configProvider(role) : undefined;
      const agentContext = contextBuilder(role);

      return {
        role,
        options: { input, config },
        context: agentContext,
      };
    });

    const results = await this.executeAgentsParallel(agentsToExecute);

    const outputs = new Map<AgentRole, any>();
    for (const record of results) {
      if (record.result.success) {
        outputs.set(record.role, record.result.output);
      }
    }

    return outputs;
  }

  /**
   * Get execution statistics
   */
  getStats(): {
    totalAgents: number;
    completedAgents: number;
    failedAgents: number;
    totalTokens: number;
    totalCost: number;
    averageDuration: number;
  } {
    const records = Array.from(this.agentResults.values());

    const completed = records.filter((r) => r.result.success);
    const failed = records.filter((r) => !r.result.success);

    const totalTokens = records.reduce((sum, r) => sum + (r.result.tokensUsed || 0), 0);
    const totalCost = records.reduce((sum, r) => sum + (r.result.cost || 0), 0);

    const totalDuration = records.reduce((sum, r) => sum + r.duration, 0);
    const averageDuration = records.length > 0 ? totalDuration / records.length : 0;

    return {
      totalAgents: records.length,
      completedAgents: completed.length,
      failedAgents: failed.length,
      totalTokens,
      totalCost,
      averageDuration,
    };
  }

  /**
   * Get agent result
   */
  getAgentResult(role: AgentRole): AgentExecutionRecord | undefined {
    return this.agentResults.get(role);
  }

  /**
   * Get all agent results
   */
  getAllResults(): Map<AgentRole, AgentExecutionRecord> {
    return new Map(this.agentResults);
  }

  /**
   * Clear results (for re-execution)
   */
  clearResults(): void {
    this.agentResults.clear();
  }

  /**
   * Wait for all pending executions to complete
   */
  async waitForCompletion(): Promise<void> {
    await this.queue.onIdle();
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): {
    size: number;
    pending: number;
    isPaused: boolean;
  } {
    return {
      size: this.queue.size,
      pending: this.queue.pending,
      isPaused: this.queue.isPaused,
    };
  }

  /**
   * Pause execution
   */
  pause(): void {
    this.queue.pause();
  }

  /**
   * Resume execution
   */
  resume(): void {
    this.queue.start();
  }

  /**
   * Clear queue (cancel pending executions)
   */
  clear(): void {
    this.queue.clear();
  }
}

/**
 * Create execution engine
 */
export function createExecutionEngine(
  context: ExecutionContext,
  maxConcurrency?: number
): ExecutionEngine {
  return new ExecutionEngine(context, maxConcurrency);
}

/**
 * Execute agents with automatic retry on failure
 */
export async function executeWithRetry(
  engine: ExecutionEngine,
  role: AgentRole,
  options: AgentExecutionOptions,
  context: ExtendedAgentContext,
  maxRetries: number = 3
): Promise<AgentExecutionRecord> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await engine.executeAgent(role, options, context);

      if (result.result.success) {
        return result;
      }

      lastError = new Error(result.result.error || 'Agent execution failed');

      if (attempt < maxRetries - 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.log(`[Executor] Retrying ${role} in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    } catch (error: any) {
      lastError = error;
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Execute agents with timeout
 */
export async function executeWithTimeout(
  engine: ExecutionEngine,
  role: AgentRole,
  options: AgentExecutionOptions,
  context: ExtendedAgentContext,
  timeoutMs: number = 300000 // 5 minutes
): Promise<AgentExecutionRecord> {
  return Promise.race([
    engine.executeAgent(role, options, context),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Agent execution timeout: ${role}`)), timeoutMs)
    ),
  ]);
}

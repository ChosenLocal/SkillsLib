import { PrismaClient } from '@business-automation/database';
import type { ClientSchema } from '@business-automation/schema';
import type { AgentRole } from '@business-automation/database';
import type { ExtendedAgentContext } from '../shared/base-agent';
import { getRedisClient } from '../shared/redis-client';
import { getStorageClient } from '../shared/storage-client';
import { getMCPManager } from '../shared/mcp-manager';
import { randomUUID } from 'crypto';

/**
 * Base context configuration
 */
export interface BaseContextConfig {
  tenantId: string;
  projectId: string;
  workflowExecutionId: string;
  userId?: string;
  traceId: string;
  clientSchema?: ClientSchema;
}

/**
 * Context builder for creating agent contexts
 */
export class ContextBuilder {
  private prisma: PrismaClient;
  private baseConfig: BaseContextConfig;
  private orchestrator?: any;

  constructor(prisma: PrismaClient, baseConfig: BaseContextConfig) {
    this.prisma = prisma;
    this.baseConfig = baseConfig;
  }

  /**
   * Set orchestrator reference for agent-to-agent calls
   */
  setOrchestrator(orchestrator: any): void {
    this.orchestrator = orchestrator;
  }

  /**
   * Build context for an agent
   */
  build(role: AgentRole, parentSpanId?: string): ExtendedAgentContext {
    const agentExecutionId = `agent_${randomUUID()}`;
    const spanId = `span_${randomUUID()}`;

    const redis = getRedisClient();
    const storage = getStorageClient();
    const mcpManager = getMCPManager();

    // Build MCP connections map
    const mcp = new Map<string, any>();
    for (const serverName of mcpManager.getConnectedServers()) {
      const status = mcpManager.getServerStatus(serverName);
      if (status?.connected) {
        mcp.set(serverName, mcpManager);
      }
    }

    const context: ExtendedAgentContext = {
      // Core identifiers
      tenantId: this.baseConfig.tenantId,
      projectId: this.baseConfig.projectId,
      workflowExecutionId: this.baseConfig.workflowExecutionId,
      agentExecutionId,
      userId: this.baseConfig.userId,

      // Tracing
      traceId: this.baseConfig.traceId,
      spanId,
      parentSpanId,

      // Compatibility with AgentContext interface
      runId: this.baseConfig.workflowExecutionId,

      // Client schema
      clientSchema: this.baseConfig.clientSchema || ({} as ClientSchema),

      // Clients
      redis: redis,
      storage: storage,
      prisma: this.prisma,
      orchestrator: this.orchestrator,
      mcp,

      // Config
      config: {
        tenantId: this.baseConfig.tenantId,
        projectId: this.baseConfig.projectId,
      },
    };

    return context;
  }

  /**
   * Build multiple contexts for parallel execution
   */
  buildMany(roles: AgentRole[], parentSpanId?: string): Map<AgentRole, ExtendedAgentContext> {
    const contexts = new Map<AgentRole, ExtendedAgentContext>();

    for (const role of roles) {
      contexts.set(role, this.build(role, parentSpanId));
    }

    return contexts;
  }

  /**
   * Build context with custom overrides
   */
  buildWithOverrides(
    role: AgentRole,
    overrides: Partial<ExtendedAgentContext>,
    parentSpanId?: string
  ): ExtendedAgentContext {
    const baseContext = this.build(role, parentSpanId);

    return {
      ...baseContext,
      ...overrides,
    };
  }

  /**
   * Get base configuration
   */
  getBaseConfig(): BaseContextConfig {
    return { ...this.baseConfig };
  }

  /**
   * Update base configuration
   */
  updateBaseConfig(updates: Partial<BaseContextConfig>): void {
    this.baseConfig = {
      ...this.baseConfig,
      ...updates,
    };
  }
}

/**
 * Create a context builder
 */
export function createContextBuilder(
  prisma: PrismaClient,
  baseConfig: BaseContextConfig
): ContextBuilder {
  return new ContextBuilder(prisma, baseConfig);
}

/**
 * Context builder factory for workflow execution
 */
export class WorkflowContextFactory {
  private builders: Map<string, ContextBuilder> = new Map();
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Create builder for a workflow execution
   */
  createBuilder(workflowExecutionId: string, config: BaseContextConfig): ContextBuilder {
    const builder = new ContextBuilder(this.prisma, config);
    this.builders.set(workflowExecutionId, builder);
    return builder;
  }

  /**
   * Get builder for a workflow execution
   */
  getBuilder(workflowExecutionId: string): ContextBuilder | undefined {
    return this.builders.get(workflowExecutionId);
  }

  /**
   * Remove builder (cleanup)
   */
  removeBuilder(workflowExecutionId: string): void {
    this.builders.delete(workflowExecutionId);
  }

  /**
   * Clear all builders
   */
  clear(): void {
    this.builders.clear();
  }

  /**
   * Get active workflow count
   */
  getActiveCount(): number {
    return this.builders.size;
  }
}

/**
 * Create workflow context factory
 */
export function createWorkflowContextFactory(prisma: PrismaClient): WorkflowContextFactory {
  return new WorkflowContextFactory(prisma);
}

/**
 * Build context for one-off agent execution (outside of workflow)
 */
export function buildStandaloneContext(
  prisma: PrismaClient,
  config: {
    tenantId: string;
    projectId: string;
    role: AgentRole;
    userId?: string;
    clientSchema?: ClientSchema;
  }
): ExtendedAgentContext {
  const workflowExecutionId = `standalone_${randomUUID()}`;
  const traceId = `trace_${randomUUID()}`;

  const builder = createContextBuilder(prisma, {
    tenantId: config.tenantId,
    projectId: config.projectId,
    workflowExecutionId,
    userId: config.userId,
    traceId,
    clientSchema: config.clientSchema,
  });

  return builder.build(config.role);
}

/**
 * Validate context has required fields
 */
export function validateContext(context: ExtendedAgentContext): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!context.tenantId) {
    errors.push('tenantId is required');
  }

  if (!context.projectId) {
    errors.push('projectId is required');
  }

  if (!context.workflowExecutionId) {
    errors.push('workflowExecutionId is required');
  }

  if (!context.agentExecutionId) {
    errors.push('agentExecutionId is required');
  }

  if (!context.traceId) {
    errors.push('traceId is required');
  }

  if (!context.spanId) {
    errors.push('spanId is required');
  }

  if (!context.prisma) {
    errors.push('prisma client is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Clone context with new IDs (for retry or sub-execution)
 */
export function cloneContext(
  context: ExtendedAgentContext,
  overrides?: Partial<ExtendedAgentContext>
): ExtendedAgentContext {
  return {
    ...context,
    agentExecutionId: `agent_${randomUUID()}`,
    spanId: `span_${randomUUID()}`,
    ...overrides,
  };
}

/**
 * Context builder with dependency injection
 */
export class DIContextBuilder extends ContextBuilder {
  private dependencies: Map<string, any> = new Map();

  /**
   * Register a dependency
   */
  registerDependency(key: string, value: any): void {
    this.dependencies.set(key, value);
  }

  /**
   * Get registered dependency
   */
  getDependency<T>(key: string): T | undefined {
    return this.dependencies.get(key);
  }

  /**
   * Build context with injected dependencies
   */
  override build(role: AgentRole, parentSpanId?: string): ExtendedAgentContext {
    const context = super.build(role, parentSpanId);

    // Inject registered dependencies into config
    for (const [key, value] of this.dependencies.entries()) {
      context.config[key] = value;
    }

    return context;
  }
}

/**
 * Create DI context builder
 */
export function createDIContextBuilder(
  prisma: PrismaClient,
  baseConfig: BaseContextConfig
): DIContextBuilder {
  return new DIContextBuilder(prisma, baseConfig);
}

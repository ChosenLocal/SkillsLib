import { PrismaClient, AgentStatus, AgentLayer, AgentRole } from '@business-automation/database';
import type { AgentContext, AgentManifest, AgentResult } from '@business-automation/schema';
import {
  sendClaudeMessage,
  streamClaudeMessage,
  type ClaudeMessageOptions,
  type ClaudeMessageResponse,
  CLAUDE_3_5_SONNET,
} from './claude-client';
import { createTraceHelper, type TraceHelper } from './langfuse-client';
import { trackAgentCost } from './cost-tracker';
import { publishToStream } from './redis-client';
import { getMCPToolsForClaude, executeMCPTool } from './mcp-manager';
import invariant from 'tiny-invariant';

/**
 * Extended agent context with utility clients
 */
export interface ExtendedAgentContext extends AgentContext {
  tenantId: string;
  userId?: string;
  workflowExecutionId: string;
  agentExecutionId: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

/**
 * Agent execution result
 */
export interface AgentExecutionResult<T = any> {
  success: boolean;
  output?: T;
  error?: string;
  tokensUsed?: number;
  cost?: number;
  artifacts?: Array<{ type: string; url: string; metadata?: any }>;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
  enableMCP?: boolean;
  mcpServers?: string[];
}

/**
 * Base agent class with automatic execution tracking
 */
export abstract class BaseAgent {
  static manifest: AgentManifest;

  protected context: ExtendedAgentContext;
  protected prisma: PrismaClient;
  protected config: AgentConfig;
  protected traceHelper: TraceHelper;

  constructor(context: ExtendedAgentContext, config: AgentConfig = {}) {
    this.context = context;
    this.prisma = context.prisma as PrismaClient;
    this.config = {
      model: config.model || CLAUDE_3_5_SONNET,
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens || 8000,
      maxRetries: config.maxRetries || 3,
      enableMCP: config.enableMCP ?? false,
      mcpServers: config.mcpServers || [],
    };

    // Initialize trace helper
    this.traceHelper = createTraceHelper(context.traceId, {
      tenantId: context.tenantId,
      workflowExecutionId: context.workflowExecutionId,
      projectId: context.projectId,
      userId: context.userId,
    });
  }

  /**
   * Get agent manifest
   */
  static getManifest(): AgentManifest {
    return this.manifest;
  }

  /**
   * Execute the agent with automatic tracking
   */
  async run(input: any): Promise<AgentExecutionResult> {
    const startTime = Date.now();

    try {
      // Create execution record
      await this.createExecution('RUNNING');

      // Emit started event
      await this.emitEvent('agent.started', { input });

      // Start tracing span
      this.traceHelper.createAgentSpan(
        this.context.spanId,
        this.getAgentRole(),
        this.getAgentLayer(),
        this.context.agentExecutionId,
        this.context.parentSpanId
      );

      // Execute the agent logic
      const result = await this.executeWithRetry(input);

      // Calculate duration
      const duration = Date.now() - startTime;

      // Update execution record with success
      await this.updateExecution({
        status: 'COMPLETED',
        output: result.output,
        tokensUsed: result.tokensUsed,
        cost: result.cost,
        duration,
        completedAt: new Date(),
      });

      // Complete tracing span
      this.traceHelper.completeSpan(this.context.spanId, result.output);

      // Emit completed event
      await this.emitEvent('agent.completed', { output: result.output, duration });

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      // Update execution record with failure
      await this.updateExecution({
        status: 'FAILED',
        error: error.message,
        duration,
        completedAt: new Date(),
      });

      // Fail tracing span
      this.traceHelper.failSpan(this.context.spanId, error);

      // Emit failed event
      await this.emitEvent('agent.failed', { error: error.message, duration });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Execute agent logic with retry
   */
  private async executeWithRetry(input: any): Promise<AgentExecutionResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries!; attempt++) {
      try {
        // Execute the agent
        const result = await this.execute(input);

        return {
          success: true,
          output: result.output,
          tokensUsed: result.tokensUsed,
          cost: result.cost,
          artifacts: result.artifacts,
        };
      } catch (error: any) {
        lastError = error;

        // Log retry attempt
        console.warn(
          `[Agent:${this.getAgentRole()}] Execution failed (attempt ${attempt + 1}/${
            this.config.maxRetries
          }): ${error.message}`
        );

        // Update status to retrying
        if (attempt < this.config.maxRetries! - 1) {
          await this.updateExecution({ status: 'RETRYING' });
          await this.emitEvent('agent.retrying', { attempt: attempt + 1, error: error.message });

          // Wait before retrying (exponential backoff)
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Abstract method to be implemented by concrete agents
   */
  protected abstract execute(input: any): Promise<AgentResult>;

  /**
   * Get agent role (must be implemented by subclass)
   */
  protected abstract getAgentRole(): AgentRole;

  /**
   * Get agent layer (must be implemented by subclass)
   */
  protected abstract getAgentLayer(): AgentLayer;

  /**
   * Send message to Claude with automatic tracking
   */
  protected async sendMessage(
    messages: ClaudeMessageOptions['messages'],
    systemPrompt?: string,
    options: Partial<ClaudeMessageOptions> = {}
  ): Promise<ClaudeMessageResponse> {
    const generationId = `gen_${Date.now()}`;

    // Prepare Claude options
    const claudeOptions: ClaudeMessageOptions = {
      model: this.config.model!,
      system: systemPrompt,
      messages,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      tools: this.config.enableMCP
        ? getMCPToolsForClaude(this.config.mcpServers)
        : undefined,
      ...options,
      metadata: {
        ...options.metadata,
        traceId: this.context.traceId,
        spanId: this.context.spanId,
        userId: this.context.userId,
      },
    };

    // Track generation in Langfuse
    this.traceHelper.trackGeneration(
      generationId,
      this.context.spanId,
      this.config.model!,
      {
        messages: messages.map((m) => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        })),
        system: systemPrompt,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
      }
    );

    // Send message to Claude
    const response = await sendClaudeMessage(claudeOptions);

    // Update generation with output
    this.traceHelper.trackGeneration(
      generationId,
      this.context.spanId,
      this.config.model!,
      {
        messages: messages.map((m) => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        })),
        system: systemPrompt,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
      },
      response.text,
      response.usage
    );

    // Track cost
    await trackAgentCost(
      this.context.tenantId,
      this.context.projectId,
      this.context.workflowExecutionId,
      this.context.agentExecutionId,
      this.config.model!,
      response.usage
    );

    return response;
  }

  /**
   * Stream message from Claude with automatic tracking
   */
  protected async streamMessage(
    messages: ClaudeMessageOptions['messages'],
    systemPrompt: string | undefined,
    onChunk: (text: string) => void,
    options: Partial<ClaudeMessageOptions> = {}
  ): Promise<ClaudeMessageResponse> {
    const generationId = `gen_${Date.now()}`;

    // Prepare Claude options
    const claudeOptions: ClaudeMessageOptions = {
      model: this.config.model!,
      system: systemPrompt,
      messages,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      tools: this.config.enableMCP
        ? getMCPToolsForClaude(this.config.mcpServers)
        : undefined,
      ...options,
      metadata: {
        ...options.metadata,
        traceId: this.context.traceId,
        spanId: this.context.spanId,
        userId: this.context.userId,
      },
    };

    // Stream message
    const response = await streamClaudeMessage(claudeOptions, onChunk);

    // Track generation
    this.traceHelper.trackGeneration(
      generationId,
      this.context.spanId,
      this.config.model!,
      {
        messages: messages.map((m) => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        })),
        system: systemPrompt,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
      },
      response.text,
      response.usage
    );

    // Track cost
    await trackAgentCost(
      this.context.tenantId,
      this.context.projectId,
      this.context.workflowExecutionId,
      this.context.agentExecutionId,
      this.config.model!,
      response.usage
    );

    return response;
  }

  /**
   * Execute MCP tool
   */
  protected async executeTool(toolName: string, input: Record<string, any>): Promise<any> {
    const result = await executeMCPTool(toolName, input);

    if (!result.success) {
      throw new Error(`Tool execution failed: ${result.error}`);
    }

    return result.output;
  }

  /**
   * Handle multi-turn tool use conversations with Claude
   * This method processes tool_use responses and continues the conversation
   */
  protected async handleToolUseConversation(
    initialResponse: ClaudeMessageResponse,
    conversationHistory: ClaudeMessageOptions['messages'],
    systemPrompt?: string,
    options: Partial<ClaudeMessageOptions> = {}
  ): Promise<ClaudeMessageResponse> {
    let currentResponse = initialResponse;
    let messages = [...conversationHistory];

    // Continue conversation while Claude requests tool use
    while (currentResponse.stopReason === 'tool_use' && currentResponse.content) {
      // Extract tool uses from response content
      const toolUses = currentResponse.content.filter((c: any) => c.type === 'tool_use');

      if (toolUses.length === 0) {
        break;
      }

      // Execute all tool uses
      const toolResults = [];
      for (const toolUse of toolUses) {
        try {
          console.log(`[Agent] Executing tool: ${toolUse.name} with input:`, toolUse.input);
          const result = await executeMCPTool(toolUse.name, toolUse.input);

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: result.success
              ? JSON.stringify(result.output)
              : `Error: ${result.error}`,
            is_error: !result.success,
          });
        } catch (error: any) {
          console.error(`[Agent] Tool execution failed for ${toolUse.name}:`, error);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: `Error: ${error.message}`,
            is_error: true,
          });
        }
      }

      // Continue conversation with tool results
      messages.push(
        { role: 'assistant', content: currentResponse.content },
        { role: 'user', content: toolResults }
      );

      // Send continuation message
      currentResponse = await this.sendMessage(messages, systemPrompt, options);
    }

    return currentResponse;
  }

  /**
   * Send message to Claude with automatic tool use handling
   * This is a convenience method that automatically handles multi-turn tool conversations
   */
  protected async sendMessageWithTools(
    messages: ClaudeMessageOptions['messages'],
    systemPrompt?: string,
    options: Partial<ClaudeMessageOptions> = {}
  ): Promise<ClaudeMessageResponse> {
    // Ensure MCP tools are enabled
    const optionsWithTools = {
      ...options,
      tools: this.config.enableMCP
        ? getMCPToolsForClaude(this.config.mcpServers)
        : options.tools,
    };

    // Send initial message
    const initialResponse = await this.sendMessage(messages, systemPrompt, optionsWithTools);

    // Handle tool use if present
    if (initialResponse.stopReason === 'tool_use') {
      return await this.handleToolUseConversation(
        initialResponse,
        messages,
        systemPrompt,
        optionsWithTools
      );
    }

    return initialResponse;
  }

  /**
   * Log progress update
   */
  protected async logProgress(message: string, percentage?: number): Promise<void> {
    await this.updateExecution({
      progress: percentage,
    });

    await this.emitEvent('agent.progress', { message, percentage });
  }

  /**
   * Emit event to Redis stream
   */
  protected async emitEvent(eventType: string, data: any): Promise<void> {
    await publishToStream(this.context.tenantId, `workflow:${this.context.workflowExecutionId}`, {
      eventType,
      agentExecutionId: this.context.agentExecutionId,
      agentRole: this.getAgentRole(),
      timestamp: new Date().toISOString(),
      data: JSON.stringify(data),
    });
  }

  /**
   * Call another agent
   */
  protected async callAgent(agentRole: AgentRole, input: any): Promise<any> {
    invariant(this.context.orchestrator, 'Orchestrator not available in context');
    return this.context.orchestrator.dispatch(agentRole, input);
  }

  /**
   * Create agent execution record
   */
  private async createExecution(status: AgentStatus): Promise<void> {
    await this.prisma.agentExecution.create({
      data: {
        id: this.context.agentExecutionId,
        tenantId: this.context.tenantId,
        workflowExecutionId: this.context.workflowExecutionId,
        projectId: this.context.projectId,
        role: this.getAgentRole(),
        layer: this.getAgentLayer(),
        status,
        traceId: this.context.traceId,
        spanId: this.context.spanId,
        parentSpanId: this.context.parentSpanId,
        startedAt: new Date(),
      },
    });
  }

  /**
   * Update agent execution record
   */
  private async updateExecution(data: {
    status?: AgentStatus;
    output?: any;
    error?: string;
    tokensUsed?: number;
    cost?: number;
    duration?: number;
    progress?: number;
    completedAt?: Date;
  }): Promise<void> {
    await this.prisma.agentExecution.update({
      where: { id: this.context.agentExecutionId },
      data: {
        status: data.status,
        output: data.output ? (data.output as any) : undefined,
        error: data.error,
        tokensUsed: data.tokensUsed,
        cost: data.cost,
        duration: data.duration,
        progress: data.progress,
        completedAt: data.completedAt,
      },
    });
  }
}

/**
 * Helper to create agent context
 */
export function createAgentContext(
  baseContext: Partial<ExtendedAgentContext> & {
    tenantId: string;
    projectId: string;
    workflowExecutionId: string;
  }
): ExtendedAgentContext {
  return {
    runId: baseContext.workflowExecutionId,
    projectId: baseContext.projectId,
    workflowExecutionId: baseContext.workflowExecutionId,
    agentExecutionId: baseContext.agentExecutionId || `agent_${Date.now()}`,
    tenantId: baseContext.tenantId,
    userId: baseContext.userId,
    traceId: baseContext.traceId || `trace_${Date.now()}`,
    spanId: baseContext.spanId || `span_${Date.now()}`,
    parentSpanId: baseContext.parentSpanId,
    clientSchema: baseContext.clientSchema || ({} as any),
    redis: baseContext.redis,
    storage: baseContext.storage,
    prisma: baseContext.prisma,
    orchestrator: baseContext.orchestrator,
    mcp: baseContext.mcp || new Map(),
    config: baseContext.config || {},
  };
}

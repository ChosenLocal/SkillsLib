// packages/agents/shared/base-agent.ts
import { Anthropic } from '@anthropic-ai/sdk';
import { Client as MCPClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { z } from 'zod';
import { EventEmitter } from 'events';

// Agent capability manifest schema
export const AgentManifestSchema = z.object({
  id: z.string(),
  tier: z.enum(['strategy', 'build', 'quality']),
  type: z.enum(['core', 'ephemeral']),
  capabilities: z.array(z.string()),
  inputSchema: z.any(),
  outputSchema: z.any(),
  mcpServers: z.array(z.string()).optional(),
  maxTokens: z.number().default(8192),
  temperature: z.number().default(0.7),
  systemPrompt: z.string(),
});

export type AgentManifest = z.infer<typeof AgentManifestSchema>;

// Base agent execution context
export interface AgentContext {
  projectId: string;
  runId: string;
  phase: 'plan' | 'synthesize' | 'validate' | 'deploy';
  workspace: string; // sandbox directory
  redis: any; // Redis client for state
  logger: any;
}

// Base agent result
export interface AgentResult<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
    details?: any;
  };
  metadata: {
    agentId: string;
    modelVersion: string;
    promptHash: string;
    tokenUsage: { input: number; output: number };
    duration: number;
    timestamp: string;
  };
  artifacts?: Array<{
    type: 'file' | 'log' | 'trace';
    path: string;
    content?: string;
  }>;
}

export abstract class BaseAgent<TInput = any, TOutput = any> extends EventEmitter {
  protected claude: Anthropic;
  protected mcpClients: Map<string, MCPClient> = new Map();
  protected manifest: AgentManifest;
  
  constructor(manifest: AgentManifest) {
    super();
    this.manifest = manifest;
    this.claude = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });
  }

  // Initialize MCP server connections
  async initializeMCP(servers: string[] = []): Promise<void> {
    const mcpServers = [...(this.manifest.mcpServers || []), ...servers];
    
    for (const serverName of mcpServers) {
      const transport = new StdioClientTransport({
        command: 'npx',
        args: [`@modelcontextprotocol/server-${serverName}`],
      });
      
      const client = new MCPClient({
        name: `${this.manifest.id}-${serverName}`,
        version: '1.0.0',
      }, { 
        capabilities: {}
      });
      
      await client.connect(transport);
      
      // List available tools
      const tools = await client.listTools();
      this.emit('mcp:connected', { server: serverName, tools });
      
      this.mcpClients.set(serverName, client);
    }
  }

  // Execute agent with retries and observability
  async execute(input: TInput, context: AgentContext): Promise<AgentResult<TOutput>> {
    const startTime = Date.now();
    const promptHash = this.hashPrompt(input);
    
    try {
      // Validate input
      await this.validateInput(input);
      
      // Build system prompt with context
      const systemPrompt = this.buildSystemPrompt(input, context);
      
      // Create message with available MCP tools
      const tools = await this.getMCPTools();
      
      // Execute Claude completion with tools
      const completion = await this.claude.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: this.manifest.maxTokens,
        temperature: this.manifest.temperature,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: this.buildUserPrompt(input, context),
          }
        ],
        tools: tools,
        tool_choice: 'auto',
      });

      // Process tool calls
      let finalContent = completion.content;
      if (completion.stop_reason === 'tool_use') {
        finalContent = await this.handleToolUse(completion, context);
      }

      // Parse and validate output
      const output = await this.parseOutput(finalContent);
      await this.validateOutput(output);

      // Store artifacts
      const artifacts = await this.storeArtifacts(output, context);

      return {
        success: true,
        data: output,
        metadata: {
          agentId: this.manifest.id,
          modelVersion: 'claude-3-5-sonnet-20241022',
          promptHash,
          tokenUsage: {
            input: completion.usage?.input_tokens || 0,
            output: completion.usage?.output_tokens || 0,
          },
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
        artifacts,
      };
    } catch (error: any) {
      context.logger?.error(`Agent ${this.manifest.id} failed:`, error);
      
      return {
        success: false,
        error: {
          code: error.code || 'AGENT_ERROR',
          message: error.message,
          retryable: this.isRetryable(error),
          details: error.details,
        },
        metadata: {
          agentId: this.manifest.id,
          modelVersion: 'claude-3-5-sonnet-20241022',
          promptHash,
          tokenUsage: { input: 0, output: 0 },
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // Get available MCP tools
  protected async getMCPTools(): Promise<any[]> {
    const tools = [];
    
    for (const [serverName, client] of this.mcpClients) {
      const serverTools = await client.listTools();
      tools.push(...serverTools.tools.map(tool => ({
        name: `${serverName}_${tool.name}`,
        description: tool.description,
        input_schema: tool.inputSchema,
      })));
    }
    
    return tools;
  }

  // Handle tool use in completion
  protected async handleToolUse(completion: any, context: AgentContext): Promise<any> {
    const toolUses = completion.content.filter((c: any) => c.type === 'tool_use');
    const toolResults = [];

    for (const toolUse of toolUses) {
      const [serverName, toolName] = toolUse.name.split('_');
      const client = this.mcpClients.get(serverName);
      
      if (!client) {
        throw new Error(`MCP server ${serverName} not found`);
      }

      const result = await client.callTool(toolName, toolUse.input);
      toolResults.push({
        tool_use_id: toolUse.id,
        content: result.content,
      });
    }

    // Continue conversation with tool results
    const followUp = await this.claude.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: this.manifest.maxTokens,
      messages: [
        ...completion.messages,
        { role: 'assistant', content: completion.content },
        { role: 'user', content: toolResults },
      ],
    });

    return followUp.content;
  }

  // Abstract methods to implement in each agent
  protected abstract buildSystemPrompt(input: TInput, context: AgentContext): string;
  protected abstract buildUserPrompt(input: TInput, context: AgentContext): string;
  protected abstract validateInput(input: TInput): Promise<void>;
  protected abstract parseOutput(content: any): Promise<TOutput>;
  protected abstract validateOutput(output: TOutput): Promise<void>;
  protected abstract storeArtifacts(output: TOutput, context: AgentContext): Promise<any[]>;

  // Helper methods
  protected hashPrompt(input: any): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 8);
  }

  protected isRetryable(error: any): boolean {
    const retryableCodes = ['RATE_LIMIT', 'TIMEOUT', 'NETWORK_ERROR'];
    return retryableCodes.includes(error.code) || error.status === 429;
  }

  // Cleanup
  async dispose(): Promise<void> {
    for (const client of this.mcpClients.values()) {
      await client.close();
    }
    this.mcpClients.clear();
  }
}

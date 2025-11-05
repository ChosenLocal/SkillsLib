import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import { Client as MCPClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
}

/**
 * MCP Tool definition
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * MCP Server instance
 */
export interface MCPServer {
  config: MCPServerConfig;
  tools: MCPTool[];
  connected: boolean;
  client?: MCPClient; // Actual MCP client instance
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
}

/**
 * MCP Manager for handling Model Context Protocol servers
 *
 * NOTE: This is a placeholder implementation. Full MCP integration requires:
 * 1. Installing @modelcontextprotocol/sdk (when available)
 * 2. Implementing server lifecycle management
 * 3. Implementing tool discovery via MCP protocol
 * 4. Implementing tool execution via MCP protocol
 *
 * For now, this provides the interface and basic tool management.
 */
class MCPManager {
  private static instance: MCPManager;
  private servers: Map<string, MCPServer> = new Map();
  private tools: Map<string, MCPTool> = new Map();

  private constructor() {}

  public static getInstance(): MCPManager {
    if (!MCPManager.instance) {
      MCPManager.instance = new MCPManager();
    }
    return MCPManager.instance;
  }

  /**
   * Initialize MCP manager with server configurations
   */
  public async initialize(configs: MCPServerConfig[]): Promise<void> {
    console.log('[MCP] Initializing MCP Manager with', configs.length, 'servers');

    for (const config of configs) {
      if (!config.enabled) {
        console.log(`[MCP] Server ${config.name} is disabled, skipping`);
        continue;
      }

      try {
        await this.connectServer(config);
      } catch (error) {
        console.error(`[MCP] Failed to connect to server ${config.name}:`, error);
      }
    }

    console.log('[MCP] Initialized with', this.servers.size, 'connected servers');
  }

  /**
   * Connect to an MCP server
   */
  private async connectServer(config: MCPServerConfig): Promise<void> {
    console.log(`[MCP] Connecting to server: ${config.name}`);

    try {
      // Create transport for the MCP server process
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args || [],
        env: config.env,
      });

      // Create MCP client
      const client = new MCPClient(
        {
          name: `agent-mcp-${config.name}`,
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      // Connect to the server
      await client.connect(transport);

      // Discover available tools
      const toolsResponse = await client.listTools();
      const tools: MCPTool[] = toolsResponse.tools.map((tool: any) => ({
        name: `${config.name}:${tool.name}`,
        description: tool.description || '',
        inputSchema: tool.inputSchema || {
          type: 'object',
          properties: {},
        },
      }));

      // Store server with client reference
      const server: MCPServer = {
        config,
        tools,
        connected: true,
        client,
      };

      this.servers.set(config.name, server);

      // Register tools in the global tools map
      for (const tool of tools) {
        this.tools.set(tool.name, tool);
      }

      console.log(
        `[MCP] Connected to server: ${config.name} with ${tools.length} tools`
      );
    } catch (error: any) {
      console.error(`[MCP] Failed to connect to server ${config.name}:`, error);
      throw error;
    }
  }

  /**
   * Disconnect from an MCP server
   */
  public async disconnectServer(serverName: string): Promise<void> {
    const server = this.servers.get(serverName);
    if (!server) {
      return;
    }

    console.log(`[MCP] Disconnecting from server: ${serverName}`);

    try {
      // Close the MCP client connection if it exists
      if (server.client) {
        await server.client.close();
      }
    } catch (error) {
      console.error(`[MCP] Error closing client for ${serverName}:`, error);
    }

    server.connected = false;
    this.servers.delete(serverName);

    // Remove tools from this server
    for (const [toolName, tool] of this.tools.entries()) {
      if (toolName.startsWith(`${serverName}:`)) {
        this.tools.delete(toolName);
      }
    }

    console.log(`[MCP] Disconnected from server: ${serverName}`);
  }

  /**
   * Disconnect all servers
   */
  public async disconnectAll(): Promise<void> {
    const serverNames = Array.from(this.servers.keys());
    for (const serverName of serverNames) {
      await this.disconnectServer(serverName);
    }
  }

  /**
   * Register a tool manually (for testing or custom tools)
   */
  public registerTool(serverName: string, tool: MCPTool): void {
    const toolKey = `${serverName}:${tool.name}`;
    this.tools.set(toolKey, tool);

    const server = this.servers.get(serverName);
    if (server) {
      server.tools.push(tool);
    }

    console.log(`[MCP] Registered tool: ${toolKey}`);
  }

  /**
   * Get all available tools from all connected servers
   */
  public getAllTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools from a specific server
   */
  public getServerTools(serverName: string): MCPTool[] {
    const server = this.servers.get(serverName);
    return server?.tools || [];
  }

  /**
   * Get a specific tool by name
   */
  public getTool(toolName: string): MCPTool | undefined {
    return this.tools.get(toolName);
  }

  /**
   * Convert MCP tools to Anthropic tool format
   */
  public convertToAnthropicTools(mcpTools?: MCPTool[]): Tool[] {
    const tools = mcpTools || this.getAllTools();

    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));
  }

  /**
   * Execute a tool call
   */
  public async executeTool(
    toolName: string,
    input: Record<string, any>
  ): Promise<ToolExecutionResult> {
    const tool = this.getTool(toolName);
    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${toolName}`,
      };
    }

    // Find the server for this tool
    const [serverName, actualToolName] = toolName.split(':');
    const server = this.servers.get(serverName);

    if (!server || !server.connected) {
      return {
        success: false,
        error: `Server not connected: ${serverName}`,
      };
    }

    if (!server.client) {
      return {
        success: false,
        error: `No client available for server: ${serverName}`,
      };
    }

    try {
      console.log(`[MCP] Executing tool: ${toolName} with input:`, input);

      // Execute tool via MCP protocol
      const result = await server.client.callTool({
        name: actualToolName,
        arguments: input,
      });

      console.log(`[MCP] Tool execution completed: ${toolName}`);

      return {
        success: true,
        output: result.content,
      };
    } catch (error: any) {
      console.error(`[MCP] Tool execution failed: ${toolName}`, error);
      return {
        success: false,
        error: error.message || 'Tool execution failed',
      };
    }
  }

  /**
   * Get list of connected servers
   */
  public getConnectedServers(): string[] {
    return Array.from(this.servers.values())
      .filter((server) => server.connected)
      .map((server) => server.config.name);
  }

  /**
   * Check if a server is connected
   */
  public isServerConnected(serverName: string): boolean {
    const server = this.servers.get(serverName);
    return server?.connected || false;
  }

  /**
   * Get server status
   */
  public getServerStatus(serverName: string): {
    connected: boolean;
    toolCount: number;
  } | null {
    const server = this.servers.get(serverName);
    if (!server) {
      return null;
    }

    return {
      connected: server.connected,
      toolCount: server.tools.length,
    };
  }

  /**
   * Health check for all servers
   */
  public async healthCheck(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};

    for (const [serverName, server] of this.servers.entries()) {
      // TODO: Implement actual health check via MCP protocol
      health[serverName] = server.connected;
    }

    return health;
  }
}

// Singleton instance
const mcpManager = MCPManager.getInstance();

/**
 * Initialize MCP manager
 */
export async function initializeMCP(configs: MCPServerConfig[]): Promise<void> {
  await mcpManager.initialize(configs);
}

/**
 * Get MCP manager instance
 */
export function getMCPManager(): MCPManager {
  return mcpManager;
}

/**
 * Get all available MCP tools
 */
export function getAllMCPTools(): MCPTool[] {
  return mcpManager.getAllTools();
}

/**
 * Get tools in Anthropic format
 */
export function getMCPToolsForClaude(serverNames?: string[]): Tool[] {
  if (serverNames) {
    const tools: MCPTool[] = [];
    for (const serverName of serverNames) {
      tools.push(...mcpManager.getServerTools(serverName));
    }
    return mcpManager.convertToAnthropicTools(tools);
  }

  return mcpManager.convertToAnthropicTools();
}

/**
 * Execute an MCP tool
 */
export async function executeMCPTool(
  toolName: string,
  input: Record<string, any>
): Promise<ToolExecutionResult> {
  return mcpManager.executeTool(toolName, input);
}

/**
 * Disconnect all MCP servers
 */
export async function shutdownMCP(): Promise<void> {
  await mcpManager.disconnectAll();
}

/**
 * Register a custom tool (for testing)
 */
export function registerCustomTool(serverName: string, tool: MCPTool): void {
  mcpManager.registerTool(serverName, tool);
}

/**
 * Get default MCP server configurations from environment
 */
export function getDefaultMCPConfigs(): MCPServerConfig[] {
  // TODO: Load from environment variables or config file
  // Example format:
  // MCP_SERVERS='[
  //   {"name": "playwright", "command": "npx", "args": ["@playwright/mcp"], "enabled": true},
  //   {"name": "filesystem", "command": "mcp-server-filesystem", "args": [], "enabled": true}
  // ]'

  const configs: MCPServerConfig[] = [];

  // Check if MCP_SERVERS environment variable is set
  const mcpServersEnv = process.env.MCP_SERVERS;
  if (mcpServersEnv) {
    try {
      const parsed = JSON.parse(mcpServersEnv);
      configs.push(...parsed);
    } catch (error) {
      console.error('[MCP] Failed to parse MCP_SERVERS environment variable:', error);
    }
  }

  return configs;
}

/**
 * Create tool definition helper
 */
export function createToolDefinition(
  name: string,
  description: string,
  properties: Record<string, any>,
  required?: string[]
): MCPTool {
  return {
    name,
    description,
    inputSchema: {
      type: 'object',
      properties,
      required,
    },
  };
}

/**
 * Example MCP tools for common use cases
 */
export const EXAMPLE_TOOLS = {
  webSearch: createToolDefinition(
    'web_search',
    'Search the web for information',
    {
      query: { type: 'string', description: 'Search query' },
      maxResults: { type: 'number', description: 'Maximum number of results to return' },
    },
    ['query']
  ),
  readFile: createToolDefinition(
    'read_file',
    'Read contents of a file',
    {
      path: { type: 'string', description: 'Path to the file' },
    },
    ['path']
  ),
  writeFile: createToolDefinition(
    'write_file',
    'Write contents to a file',
    {
      path: { type: 'string', description: 'Path to the file' },
      content: { type: 'string', description: 'Content to write' },
    },
    ['path', 'content']
  ),
  executeBash: createToolDefinition(
    'execute_bash',
    'Execute a bash command',
    {
      command: { type: 'string', description: 'Bash command to execute' },
    },
    ['command']
  ),
};

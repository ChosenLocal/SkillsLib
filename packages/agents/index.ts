/**
 * @business-automation/agents
 *
 * AI agent orchestration framework for business automation
 *
 * @module @business-automation/agents
 */

// Export shared utilities
export * from './shared';

// Export orchestrator
export * from './orchestrator';

// Export jobs
export * from './jobs';

// Export 3-Tier Architecture Agents
// Strategy Tier
export * from './strategy';

// Build Tier
export * from './build';

// Quality Tier
export * from './quality';

// Export POC agents (legacy)
export { BusinessRequirementsAgent } from './discovery/business-requirements';
export { ColorPaletteAgent } from './design/color-palette';
export { HeroCopyAgent } from './content/hero-copy';

// Auto-register all agents
import { registerAgents } from './orchestrator/registry';
import { BusinessRequirementsAgent } from './discovery/business-requirements';
import { ColorPaletteAgent } from './design/color-palette';
import { HeroCopyAgent } from './content/hero-copy';
import { PlannerAgent } from './strategy/planner';
import { IAArchitectAgent } from './strategy/ia-architect';
import { BrandInterpreterAgent } from './strategy/brand-interpreter';
import { BacklogManagerAgent } from './strategy/backlog-manager';
import { ScaffolderAgent } from './build/scaffolder';
import { ComponentWorkerAgent } from './build/component-worker';
import { PageAssemblerAgent } from './build/page-assembler';
import { StaticAnalyzerAgent } from './quality/static-analyzer';
import { FixerAgent } from './quality/fixer';

/**
 * Register all available agents
 *
 * Call this function once at application startup to register
 * all agent classes with the orchestrator registry.
 */
export function registerAllAgents(): void {
  registerAgents([
    // Strategy Tier
    PlannerAgent,
    IAArchitectAgent,
    BrandInterpreterAgent,
    BacklogManagerAgent,
    // Build Tier
    ScaffolderAgent,
    ComponentWorkerAgent,
    PageAssemblerAgent,
    // Quality Tier
    StaticAnalyzerAgent,
    FixerAgent,
    // POC agents (legacy)
    BusinessRequirementsAgent,
    ColorPaletteAgent,
    HeroCopyAgent,
  ]);

  console.log('[Agents] Registered 12 agents (9 production + 3 POC)');
}

/**
 * Initialize agents package
 *
 * This should be called once at application startup to:
 * 1. Register all agents
 * 2. Initialize Redis connection
 * 3. Initialize storage client
 * 4. Initialize MCP servers
 */
export async function initializeAgents(options: {
  autoRegister?: boolean;
  initializeRedis?: boolean;
  initializeStorage?: boolean;
  initializeMCP?: boolean;
} = {}): Promise<void> {
  const {
    autoRegister = true,
    initializeRedis = true,
    initializeStorage = true,
    initializeMCP = true,
  } = options;

  console.log('[Agents] Initializing agents package...');

  // Register agents
  if (autoRegister) {
    registerAllAgents();
  }

  // Initialize Redis
  if (initializeRedis) {
    const { connectRedis } = await import('./shared/redis-client');
    await connectRedis();
    console.log('[Agents] Redis initialized');
  }

  // Initialize Storage
  if (initializeStorage) {
    const { initializeStorage: initStorage } = await import('./shared/storage-client');
    initStorage();
    console.log('[Agents] Storage initialized');
  }

  // Initialize MCP
  if (initializeMCP) {
    const { initializeMCP: initMCP, getDefaultMCPConfigs } = await import('./shared/mcp-manager');
    const configs = getDefaultMCPConfigs();
    if (configs.length > 0) {
      await initMCP(configs);
      console.log(`[Agents] MCP initialized with ${configs.length} servers`);
    }
  }

  console.log('[Agents] Initialization complete');
}

/**
 * Get package version and stats
 */
export function getAgentsInfo(): {
  version: string;
  registeredAgents: number;
  layers: string[];
} {
  const { getRegistryStats } = require('./orchestrator/registry');
  const stats = getRegistryStats();

  return {
    version: '1.0.0',
    registeredAgents: stats.total,
    layers: Object.keys(stats.byLayer),
  };
}

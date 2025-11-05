import type { AgentRole, AgentLayer } from '@business-automation/database';
import type { AgentManifest } from '@business-automation/schema';
import type { BaseAgent, ExtendedAgentContext } from '../shared/base-agent';

/**
 * Agent class constructor type
 */
export type AgentClass = {
  new (context: ExtendedAgentContext, config?: any): BaseAgent;
  getManifest(): AgentManifest;
};

/**
 * Agent registry entry
 */
export interface AgentRegistryEntry {
  role: AgentRole;
  layer: AgentLayer;
  agentClass: AgentClass;
  manifest: AgentManifest;
}

/**
 * Agent registry for managing available agents
 */
class AgentRegistry {
  private static instance: AgentRegistry;
  private agents: Map<AgentRole, AgentRegistryEntry> = new Map();

  private constructor() {}

  public static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }

  /**
   * Register an agent class
   */
  public register(agentClass: AgentClass): void {
    const manifest = agentClass.getManifest();

    // Validate manifest
    this.validateManifest(manifest);

    const entry: AgentRegistryEntry = {
      role: manifest.role,
      layer: manifest.layer,
      agentClass,
      manifest,
    };

    this.agents.set(manifest.role, entry);
    console.log(`[Registry] Registered agent: ${manifest.role} (${manifest.layer})`);
  }

  /**
   * Register multiple agents at once
   */
  public registerMany(agentClasses: AgentClass[]): void {
    for (const agentClass of agentClasses) {
      this.register(agentClass);
    }
  }

  /**
   * Get agent entry by role
   */
  public get(role: AgentRole): AgentRegistryEntry | undefined {
    return this.agents.get(role);
  }

  /**
   * Check if agent is registered
   */
  public has(role: AgentRole): boolean {
    return this.agents.has(role);
  }

  /**
   * Get all registered agents
   */
  public getAll(): AgentRegistryEntry[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents by layer
   */
  public getByLayer(layer: AgentLayer): AgentRegistryEntry[] {
    return this.getAll().filter((entry) => entry.layer === layer);
  }

  /**
   * Get agent count
   */
  public count(): number {
    return this.agents.size;
  }

  /**
   * Clear all registered agents
   */
  public clear(): void {
    this.agents.clear();
  }

  /**
   * Validate agent manifest
   */
  private validateManifest(manifest: AgentManifest): void {
    if (!manifest.role) {
      throw new Error('Agent manifest must have a role');
    }

    if (!manifest.layer) {
      throw new Error('Agent manifest must have a layer');
    }

    if (!manifest.name) {
      throw new Error('Agent manifest must have a name');
    }

    if (!manifest.description) {
      throw new Error('Agent manifest must have a description');
    }

    // Check for duplicate registration
    if (this.agents.has(manifest.role)) {
      console.warn(
        `[Registry] Agent ${manifest.role} is already registered. Overwriting previous registration.`
      );
    }
  }

  /**
   * Create agent instance
   */
  public createAgent(role: AgentRole, context: ExtendedAgentContext, config?: any): BaseAgent {
    const entry = this.get(role);

    if (!entry) {
      throw new Error(`Agent not found in registry: ${role}`);
    }

    return new entry.agentClass(context, config);
  }

  /**
   * Get agent manifest
   */
  public getManifest(role: AgentRole): AgentManifest | undefined {
    const entry = this.get(role);
    return entry?.manifest;
  }

  /**
   * Get all agent roles
   */
  public getRoles(): AgentRole[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Get dependency graph for an agent
   */
  public getDependencies(role: AgentRole): AgentRole[] {
    const entry = this.get(role);
    return entry?.manifest.dependencies || [];
  }

  /**
   * Check if agent has dependencies
   */
  public hasDependencies(role: AgentRole): boolean {
    const deps = this.getDependencies(role);
    return deps.length > 0;
  }

  /**
   * Validate all dependencies are registered
   */
  public validateDependencies(role: AgentRole): { valid: boolean; missing: AgentRole[] } {
    const dependencies = this.getDependencies(role);
    const missing: AgentRole[] = [];

    for (const dep of dependencies) {
      if (!this.has(dep)) {
        missing.push(dep);
      }
    }

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * Get execution order for agents (topological sort)
   */
  public getExecutionOrder(roles: AgentRole[]): AgentRole[] {
    const visited = new Set<AgentRole>();
    const order: AgentRole[] = [];

    const visit = (role: AgentRole) => {
      if (visited.has(role)) {
        return;
      }

      visited.add(role);

      // Visit dependencies first
      const dependencies = this.getDependencies(role);
      for (const dep of dependencies) {
        if (roles.includes(dep)) {
          visit(dep);
        }
      }

      order.push(role);
    };

    for (const role of roles) {
      visit(role);
    }

    return order;
  }

  /**
   * Get agents that can run in parallel (no dependencies between them)
   */
  public getParallelGroups(roles: AgentRole[]): AgentRole[][] {
    const groups: AgentRole[][] = [];
    const remaining = new Set(roles);

    while (remaining.size > 0) {
      const group: AgentRole[] = [];

      // Find agents that have no dependencies in remaining set
      for (const role of remaining) {
        const dependencies = this.getDependencies(role);
        const hasRemainingDeps = dependencies.some((dep) => remaining.has(dep) && dep !== role);

        if (!hasRemainingDeps) {
          group.push(role);
        }
      }

      if (group.length === 0) {
        // Circular dependency detected
        throw new Error(
          `Circular dependency detected among agents: ${Array.from(remaining).join(', ')}`
        );
      }

      groups.push(group);

      // Remove processed agents
      for (const role of group) {
        remaining.delete(role);
      }
    }

    return groups;
  }

  /**
   * Get registry statistics
   */
  public getStats(): {
    total: number;
    byLayer: Record<AgentLayer, number>;
    withDependencies: number;
  } {
    const byLayer: Record<string, number> = {};
    let withDependencies = 0;

    for (const entry of this.agents.values()) {
      byLayer[entry.layer] = (byLayer[entry.layer] || 0) + 1;

      if (entry.manifest.dependencies && entry.manifest.dependencies.length > 0) {
        withDependencies++;
      }
    }

    return {
      total: this.agents.size,
      byLayer: byLayer as Record<AgentLayer, number>,
      withDependencies,
    };
  }

  /**
   * Export registry as JSON
   */
  public toJSON(): Array<{
    role: AgentRole;
    layer: AgentLayer;
    name: string;
    description: string;
    dependencies: AgentRole[];
  }> {
    return this.getAll().map((entry) => ({
      role: entry.role,
      layer: entry.layer,
      name: entry.manifest.name,
      description: entry.manifest.description,
      dependencies: entry.manifest.dependencies || [],
    }));
  }
}

// Singleton instance
const registry = AgentRegistry.getInstance();

/**
 * Register an agent
 */
export function registerAgent(agentClass: AgentClass): void {
  registry.register(agentClass);
}

/**
 * Register multiple agents
 */
export function registerAgents(agentClasses: AgentClass[]): void {
  registry.registerMany(agentClasses);
}

/**
 * Get agent registry
 */
export function getRegistry(): AgentRegistry {
  return registry;
}

/**
 * Get agent by role
 */
export function getAgent(role: AgentRole): AgentRegistryEntry | undefined {
  return registry.get(role);
}

/**
 * Create agent instance
 */
export function createAgent(
  role: AgentRole,
  context: ExtendedAgentContext,
  config?: any
): BaseAgent {
  return registry.createAgent(role, context, config);
}

/**
 * Check if agent is registered
 */
export function isAgentRegistered(role: AgentRole): boolean {
  return registry.has(role);
}

/**
 * Get all registered agent roles
 */
export function getRegisteredRoles(): AgentRole[] {
  return registry.getRoles();
}

/**
 * Get agents by layer
 */
export function getAgentsByLayer(layer: AgentLayer): AgentRegistryEntry[] {
  return registry.getByLayer(layer);
}

/**
 * Get execution order for agents
 */
export function getExecutionOrder(roles: AgentRole[]): AgentRole[] {
  return registry.getExecutionOrder(roles);
}

/**
 * Get parallel execution groups
 */
export function getParallelGroups(roles: AgentRole[]): AgentRole[][] {
  return registry.getParallelGroups(roles);
}

/**
 * Validate agent dependencies
 */
export function validateAgentDependencies(role: AgentRole): { valid: boolean; missing: AgentRole[] } {
  return registry.validateDependencies(role);
}

/**
 * Get registry statistics
 */
export function getRegistryStats(): ReturnType<AgentRegistry['getStats']> {
  return registry.getStats();
}

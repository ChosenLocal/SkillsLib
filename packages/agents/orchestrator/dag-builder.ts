import type { AgentRole } from '@business-automation/database';
import type { WorkflowDefinition } from '@business-automation/schema';
import { getRegistry } from './registry';

/**
 * DAG node representing an agent in the workflow
 */
export interface DAGNode {
  role: AgentRole;
  dependencies: AgentRole[];
  dependents: AgentRole[];
  stage: number;
  canRunInParallel: AgentRole[];
}

/**
 * DAG execution plan
 */
export interface ExecutionPlan {
  stages: Array<{
    stage: number;
    agents: AgentRole[];
    parallelizable: boolean;
  }>;
  totalAgents: number;
  estimatedDuration?: number;
}

/**
 * DAG (Directed Acyclic Graph) for workflow execution
 */
export class DAG {
  private nodes: Map<AgentRole, DAGNode> = new Map();
  private edges: Map<AgentRole, Set<AgentRole>> = new Map();

  /**
   * Add a node to the graph
   */
  public addNode(role: AgentRole, dependencies: AgentRole[] = []): void {
    if (this.nodes.has(role)) {
      throw new Error(`Node ${role} already exists in DAG`);
    }

    const node: DAGNode = {
      role,
      dependencies,
      dependents: [],
      stage: -1,
      canRunInParallel: [],
    };

    this.nodes.set(role, node);
    this.edges.set(role, new Set(dependencies));

    // Update dependents
    for (const dep of dependencies) {
      const depNode = this.nodes.get(dep);
      if (depNode) {
        depNode.dependents.push(role);
      }
    }
  }

  /**
   * Get node by role
   */
  public getNode(role: AgentRole): DAGNode | undefined {
    return this.nodes.get(role);
  }

  /**
   * Get all nodes
   */
  public getNodes(): DAGNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get dependencies for a node
   */
  public getDependencies(role: AgentRole): AgentRole[] {
    return Array.from(this.edges.get(role) || []);
  }

  /**
   * Check if there's a path from source to target
   */
  private hasPath(source: AgentRole, target: AgentRole, visited = new Set<AgentRole>()): boolean {
    if (source === target) {
      return true;
    }

    if (visited.has(source)) {
      return false;
    }

    visited.add(source);

    const dependencies = this.getDependencies(source);
    for (const dep of dependencies) {
      if (this.hasPath(dep, target, visited)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Validate the DAG (check for cycles)
   */
  public validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for cycles
    for (const role of this.nodes.keys()) {
      const dependencies = this.getDependencies(role);
      for (const dep of dependencies) {
        if (this.hasPath(dep, role, new Set())) {
          errors.push(`Circular dependency detected: ${role} -> ${dep}`);
        }
      }
    }

    // Check that all dependencies are present
    for (const [role, deps] of this.edges.entries()) {
      for (const dep of deps) {
        if (!this.nodes.has(dep)) {
          errors.push(`Missing dependency: ${role} depends on ${dep} which is not in the graph`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Calculate execution stages using topological sort
   */
  public calculateStages(): void {
    const inDegree = new Map<AgentRole, number>();

    // Initialize in-degree
    for (const role of this.nodes.keys()) {
      inDegree.set(role, this.getDependencies(role).length);
    }

    // BFS to assign stages
    const queue: AgentRole[] = [];
    let currentStage = 0;

    // Find nodes with no dependencies (stage 0)
    for (const [role, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(role);
        const node = this.nodes.get(role)!;
        node.stage = currentStage;
      }
    }

    while (queue.length > 0) {
      const currentLevelSize = queue.length;
      const processedInStage: AgentRole[] = [];

      for (let i = 0; i < currentLevelSize; i++) {
        const role = queue.shift()!;
        processedInStage.push(role);

        const node = this.nodes.get(role)!;

        // Process dependents
        for (const dependent of node.dependents) {
          const depInDegree = inDegree.get(dependent)!;
          inDegree.set(dependent, depInDegree - 1);

          if (depInDegree - 1 === 0) {
            queue.push(dependent);
            const depNode = this.nodes.get(dependent)!;
            depNode.stage = currentStage + 1;
          }
        }
      }

      // Mark agents in same stage as potentially parallelizable
      for (const role of processedInStage) {
        const node = this.nodes.get(role)!;
        node.canRunInParallel = processedInStage.filter((r) => r !== role);
      }

      if (queue.length > 0) {
        currentStage++;
      }
    }
  }

  /**
   * Generate execution plan
   */
  public getExecutionPlan(): ExecutionPlan {
    // Ensure stages are calculated
    if (this.getNodes().some((node) => node.stage === -1)) {
      this.calculateStages();
    }

    // Group nodes by stage
    const stageMap = new Map<number, AgentRole[]>();

    for (const node of this.nodes.values()) {
      const agents = stageMap.get(node.stage) || [];
      agents.push(node.role);
      stageMap.set(node.stage, agents);
    }

    // Convert to array
    const stages = Array.from(stageMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([stage, agents]) => ({
        stage,
        agents,
        parallelizable: agents.length > 1,
      }));

    return {
      stages,
      totalAgents: this.nodes.size,
    };
  }

  /**
   * Get nodes by stage
   */
  public getNodesByStage(stage: number): DAGNode[] {
    return this.getNodes().filter((node) => node.stage === stage);
  }

  /**
   * Get maximum stage number
   */
  public getMaxStage(): number {
    let max = 0;
    for (const node of this.nodes.values()) {
      if (node.stage > max) {
        max = node.stage;
      }
    }
    return max;
  }

  /**
   * Export DAG as DOT format (for visualization)
   */
  public toDOT(): string {
    let dot = 'digraph workflow {\n';
    dot += '  rankdir=LR;\n';
    dot += '  node [shape=box];\n\n';

    // Add nodes with stage labels
    for (const node of this.nodes.values()) {
      dot += `  "${node.role}" [label="${node.role}\\nStage ${node.stage}"];\n`;
    }

    dot += '\n';

    // Add edges
    for (const [role, deps] of this.edges.entries()) {
      for (const dep of deps) {
        dot += `  "${dep}" -> "${role}";\n`;
      }
    }

    dot += '}\n';
    return dot;
  }

  /**
   * Export DAG as JSON
   */
  public toJSON(): {
    nodes: Array<{
      role: AgentRole;
      stage: number;
      dependencies: AgentRole[];
      dependents: AgentRole[];
    }>;
    edges: Array<{ from: AgentRole; to: AgentRole }>;
  } {
    const nodes = this.getNodes().map((node) => ({
      role: node.role,
      stage: node.stage,
      dependencies: node.dependencies,
      dependents: node.dependents,
    }));

    const edges: Array<{ from: AgentRole; to: AgentRole }> = [];
    for (const [role, deps] of this.edges.entries()) {
      for (const dep of deps) {
        edges.push({ from: dep, to: role });
      }
    }

    return { nodes, edges };
  }
}

/**
 * Build DAG from workflow definition
 */
export function buildDAGFromWorkflow(workflow: WorkflowDefinition): DAG {
  const dag = new DAG();
  const registry = getRegistry();

  // Parse agent roles from workflow config
  const agentRoles = parseAgentRoles(workflow);

  // Add nodes with their dependencies from registry
  for (const role of agentRoles) {
    const dependencies = registry.getDependencies(role);
    dag.addNode(role, dependencies);
  }

  // Validate DAG
  const validation = dag.validate();
  if (!validation.valid) {
    throw new Error(`Invalid workflow DAG: ${validation.errors.join(', ')}`);
  }

  // Calculate execution stages
  dag.calculateStages();

  return dag;
}

/**
 * Build DAG from agent roles
 */
export function buildDAGFromRoles(roles: AgentRole[]): DAG {
  const dag = new DAG();
  const registry = getRegistry();

  for (const role of roles) {
    const dependencies = registry.getDependencies(role);
    // Only include dependencies that are in the roles list
    const filteredDeps = dependencies.filter((dep) => roles.includes(dep));
    dag.addNode(role, filteredDeps);
  }

  const validation = dag.validate();
  if (!validation.valid) {
    throw new Error(`Invalid DAG: ${validation.errors.join(', ')}`);
  }

  dag.calculateStages();

  return dag;
}

/**
 * Parse agent roles from workflow definition
 */
function parseAgentRoles(workflow: WorkflowDefinition): AgentRole[] {
  // Extract agent roles from workflow config
  // The workflow config should specify which agents to run
  const config = workflow.config as any;

  if (config.agents && Array.isArray(config.agents)) {
    return config.agents as AgentRole[];
  }

  // If not specified, infer from workflow type
  // This is a placeholder - you would implement logic based on your workflow types
  return inferAgentsFromType(workflow.type);
}

/**
 * Infer agents based on workflow type
 */
function inferAgentsFromType(workflowType: string): AgentRole[] {
  // Default agents for different workflow types
  const workflowAgents: Record<string, AgentRole[]> = {
    DISCOVERY: ['BUSINESS_REQUIREMENTS', 'COMPETITIVE_ANALYSIS', 'USER_PERSONA'],
    DESIGN: [
      'BUSINESS_REQUIREMENTS',
      'COLOR_PALETTE',
      'TYPOGRAPHY',
      'LAYOUT_STRUCTURE',
      'DESIGN_SYSTEM',
    ],
    CONTENT: [
      'BUSINESS_REQUIREMENTS',
      'HERO_COPY',
      'FEATURE_COPY',
      'CTA_COPY',
      'SEO_METADATA',
    ],
    FULL_STACK: [
      'ORCHESTRATOR',
      'BUSINESS_REQUIREMENTS',
      'COLOR_PALETTE',
      'HERO_COPY',
      'CODE_GENERATOR',
      'QUALITY_EVALUATOR',
    ],
  };

  return workflowAgents[workflowType] || [];
}

/**
 * Optimize execution plan for maximum parallelization
 */
export function optimizeExecutionPlan(dag: DAG, maxParallel: number = 5): ExecutionPlan {
  const plan = dag.getExecutionPlan();

  // Split stages with too many agents into sub-stages
  const optimizedStages = [];

  for (const stage of plan.stages) {
    if (stage.agents.length > maxParallel) {
      // Split into chunks
      for (let i = 0; i < stage.agents.length; i += maxParallel) {
        const chunk = stage.agents.slice(i, i + maxParallel);
        optimizedStages.push({
          stage: stage.stage + i / maxParallel / 100, // Keep relative ordering
          agents: chunk,
          parallelizable: true,
        });
      }
    } else {
      optimizedStages.push(stage);
    }
  }

  return {
    ...plan,
    stages: optimizedStages,
  };
}

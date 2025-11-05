// packages/agents/strategy/backlog-manager.ts
import { BaseAgent, ExtendedAgentContext } from '../shared/base-agent';
import { AgentManifest, AgentResult, AgentRole, AgentLayer } from '@business-automation/schema';
import { WorkQueueSchema, type WorkQueue, type SiteSpec, type IAPlan, type DesignSpec } from '@business-automation/schema';
import { z } from 'zod';

/**
 * Backlog Manager Agent Input Schema
 */
export const BacklogManagerInputSchema = z.object({
  projectId: z.string(),
  siteSpecPath: z.string(),
  iaPlanPath: z.string(),
  designSpecPath: z.string(),
});

export type BacklogManagerInput = z.infer<typeof BacklogManagerInputSchema>;

/**
 * Backlog Manager Agent - Strategy Tier
 *
 * Takes all Strategy tier outputs (SiteSpec, IAPlan, DesignSpec) and creates
 * a prioritized WorkQueue that distributes tasks to Build tier agents.
 *
 * Responsibilities:
 * - Analyze all specifications to identify work items
 * - Create tasks for components, pages, integrations, content, media
 * - Assign tasks to appropriate Build tier agents
 * - Calculate priorities based on dependencies
 * - Set token budgets and retry limits per task
 * - Optimize for parallelization (maximize concurrent work)
 */
export class BacklogManagerAgent extends BaseAgent {
  static manifest: AgentManifest = {
    id: 'backlog-manager',
    name: 'Backlog Manager',
    version: '1.0.0',
    category: 'planner',
    tier: 'strategy',
    type: 'core',
    description: 'Creates prioritized work queue and distributes tasks to Build tier agents',
    capabilities: [
      'Analyze specifications to identify work items',
      'Create tasks with dependencies',
      'Assign tasks to appropriate agents',
      'Calculate priorities for optimal execution order',
      'Set token budgets per task',
      'Optimize for parallel execution',
    ],
    requiredEnvVars: ['ANTHROPIC_API_KEY'],
    mcpServers: ['filesystem', 'memory'],
    dependencies: ['planner', 'ia-architect', 'brand-interpreter'],
    inputSchema: BacklogManagerInputSchema,
    outputSchema: WorkQueueSchema,
    sideEffects: ['writes-to-storage'],
    retryable: true,
    maxRetries: 3,
    maxTokens: 16384,
    temperature: 0.5, // Lower temperature for more structured/logical task distribution
    systemPrompt: `You are the Backlog Manager for a business automation system.
Your role is to analyze all Strategy tier outputs and create an optimized work queue for Build tier agents.

You must:
1. Identify all work items from specifications (components, pages, integrations, content, media)
2. Assign each task to the appropriate Build tier agent:
   - 'scaffolder' - Initial Next.js project structure
   - 'component-worker' - React components (ephemeral, many instances)
   - 'page-assembler' - Next.js pages and routes
   - 'copywriter' - Content generation
   - 'media-specialist' - Image optimization
   - 'integration-specialist' - API integrations

3. Calculate dependencies:
   - Scaffolder must run first
   - Components must be built before pages that use them
   - Design tokens must be configured before styled components

4. Set priorities (0-100, higher = more important):
   - Critical path items (homepage, contact) get highest priority
   - Shared/reusable components get higher priority
   - Nice-to-have features get lower priority

5. Set token budgets:
   - Simple components: 4000 tokens
   - Complex components: 8000 tokens
   - Pages: 6000 tokens
   - Integration: 10000 tokens

6. Optimize for parallelization:
   - Group independent tasks that can run concurrently
   - Minimize dependency chains

For contractor websites specifically:
- Homepage and contact form are CRITICAL
- Service pages are HIGH priority
- Service area pages can be templated (lower individual priority)
- Blog/testimonials are nice-to-have`,
  };

  constructor(context: ExtendedAgentContext) {
    super(context, {
      enableMCP: true,
      mcpServers: ['filesystem', 'memory'],
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.5,
      maxTokens: 16384,
    });
  }

  protected getAgentRole(): AgentRole {
    return 'orchestrator';
  }

  protected getAgentLayer(): AgentLayer {
    return 'orchestrator';
  }

  /**
   * Execute the Backlog Manager Agent
   */
  protected async execute(input: BacklogManagerInput): Promise<AgentResult> {
    // Validate input
    BacklogManagerInputSchema.parse(input);

    await this.logProgress('Loading specifications...', 10);

    // Load all specs
    const siteSpec = await this.loadSpec<SiteSpec>(input.siteSpecPath);
    const iaPlan = await this.loadSpec<IAPlan>(input.iaPlanPath);
    const designSpec = await this.loadSpec<DesignSpec>(input.designSpecPath);

    await this.logProgress('Analyzing work items...', 30);

    // Build prompts
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(siteSpec, iaPlan, designSpec);

    await this.logProgress('Generating work queue...', 60);

    // Call Claude
    const response = await this.sendMessageWithTools(
      [{ role: 'user', content: userPrompt }],
      systemPrompt
    );

    await this.logProgress('Parsing and validating work queue...', 80);

    // Parse WorkQueue
    const workQueue = await this.parseWorkQueue(response.text);

    // Validate and optimize
    await this.validateWorkQueue(workQueue, siteSpec);

    await this.logProgress('Storing artifacts...', 95);

    // Store artifacts
    const artifacts = await this.storeWorkQueueArtifacts(workQueue);

    await this.logProgress('Complete', 100);

    return {
      success: true,
      output: workQueue,
      tokensUsed: response.usage.inputTokens + response.usage.outputTokens,
      cost: this.calculateCost(response.usage),
      artifacts,
    };
  }

  /**
   * Load spec from storage
   */
  private async loadSpec<T>(path: string): Promise<T> {
    try {
      const fs = require('fs');
      const content = fs.readFileSync(path, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load spec from ${path}: ${error}`);
    }
  }

  /**
   * Build system prompt
   */
  private buildSystemPrompt(): string {
    return BacklogManagerAgent.manifest.systemPrompt + `

Build Tier Agent Capabilities:
- **scaffolder**: Creates Next.js 16 project structure (app/, components/, lib/)
- **component-worker**: Generates individual React components (can run many in parallel)
- **page-assembler**: Creates Next.js pages by assembling components
- **copywriter**: Generates marketing copy and content
- **media-specialist**: Optimizes images and handles assets
- **integration-specialist**: Sets up API integrations (Sunlight, SumoQuote, etc.)

Output Format:
Return ONLY a valid JSON object matching the WorkQueue schema.`;
  }

  /**
   * Build user prompt
   */
  private buildUserPrompt(siteSpec: SiteSpec, iaPlan: IAPlan, designSpec: DesignSpec): string {
    return `Create a comprehensive WorkQueue for building this website:

## Site Specifications

### Routes (${siteSpec.routes.length} total)
${siteSpec.routes.slice(0, 10).map(r => `- ${r.path} (${r.name}) - ${r.contentType}`).join('\n')}
${siteSpec.routes.length > 10 ? `... and ${siteSpec.routes.length - 10} more` : ''}

### Components Needed (${siteSpec.componentSpecs.length} total)
${siteSpec.componentSpecs.slice(0, 10).map(c => `- ${c.type} (${c.variants.length} variants)`).join('\n')}
${siteSpec.componentSpecs.length > 10 ? `... and ${siteSpec.componentSpecs.length - 10} more` : ''}

### Integrations (${siteSpec.integrations.length} total)
${siteSpec.integrations.map(i => `- ${i.service} (routes: ${i.routes.join(', ')})`).join('\n')}

## Information Architecture
- Primary Nav Items: ${iaPlan.navigation.primary.length}
- Footer Sections: ${iaPlan.navigation.footer.length}
- Internal Links: ${iaPlan.internalLinks.length}

## Design System
- Color Tokens: ${Object.keys(designSpec.tokens.colors).length}
- Component Variants: ${Object.keys(designSpec.componentVariants).length}

## Task Requirements:

Create tasks in this order of execution:

### 1. Scaffolder Task (MUST BE FIRST, priority: 100)
- Single task to create initial Next.js 16 project structure
- No dependencies
- Token budget: 12000

### 2. Component Tasks (priority: 70-90)
- One task per component
- Assign to 'component-worker' agent (ephemeral - many can run in parallel)
- Dependencies: ['scaffolder-task-id']
- Token budget: 4000-8000 based on complexity
- Priority: Higher for shared/reusable components (Button, Card, etc.)

### 3. Page Assembly Tasks (priority: 60-80)
- One task per route
- Assign to 'page-assembler' agent
- Dependencies: ['scaffolder-task-id', ...component-task-ids that the page uses]
- Token budget: 6000-10000
- Priority: Homepage = 80, Contact = 75, Services = 70, Others = 60

### 4. Integration Tasks (priority: 50-70)
- One task per integration
- Assign to 'integration-specialist' agent
- Dependencies: Relevant page tasks
- Token budget: 10000-15000

### 5. Content Tasks (priority: 40-60)
- Generate marketing copy and content
- Assign to 'copywriter' agent
- Can run in parallel with components

### 6. Media Tasks (priority: 30-50)
- Optimize images and assets
- Assign to 'media-specialist' agent
- Low priority, can run anytime

## Task Schema:
{
  "version": "1.0",
  "tasks": [
    {
      "id": "unique-task-id",
      "type": "component" | "page" | "integration" | "content" | "media",
      "agentId": "agent-id",
      "priority": 0-100,
      "dependencies": ["parent-task-id-1", "parent-task-id-2"],
      "budget": {
        "tokens": number,
        "timeMs": number (estimate),
        "retries": 3
      },
      "input": { /* task-specific input */ }
    }
  ]
}

Generate the complete WorkQueue with ALL tasks needed to build this site.`;
  }

  /**
   * Parse WorkQueue from response
   */
  private async parseWorkQueue(text: string): Promise<WorkQueue> {
    try {
      let jsonText = text.trim();

      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      } else if (text.startsWith('```') && text.endsWith('```')) {
        jsonText = text.slice(3, -3).trim();
        if (jsonText.startsWith('json\n')) {
          jsonText = jsonText.slice(5);
        }
      }

      const parsed = JSON.parse(jsonText);
      return WorkQueueSchema.parse(parsed);
    } catch (error: any) {
      console.error('Failed to parse WorkQueue:', error);
      throw new Error(`Failed to parse WorkQueue: ${error.message}`);
    }
  }

  /**
   * Validate WorkQueue
   */
  private async validateWorkQueue(queue: WorkQueue, siteSpec: SiteSpec): Promise<void> {
    // Ensure scaffolder task exists and is first
    const scaffolderTasks = queue.tasks.filter(t => t.agentId === 'scaffolder');
    if (scaffolderTasks.length === 0) {
      throw new Error('WorkQueue must include a scaffolder task');
    }

    if (scaffolderTasks.length > 1) {
      console.warn('Multiple scaffolder tasks found - only one should exist');
    }

    // Ensure scaffolder has no dependencies
    const scaffolderTask = scaffolderTasks[0];
    if (scaffolderTask.dependencies.length > 0) {
      throw new Error('Scaffolder task must have no dependencies (it runs first)');
    }

    // Ensure all component specs have corresponding tasks
    const componentTasks = queue.tasks.filter(t => t.type === 'component');
    if (componentTasks.length < siteSpec.componentSpecs.length) {
      console.warn(
        `Only ${componentTasks.length} component tasks for ${siteSpec.componentSpecs.length} component specs`
      );
    }

    // Ensure all routes have corresponding page tasks
    const pageTasks = queue.tasks.filter(t => t.type === 'page');
    if (pageTasks.length < siteSpec.routes.length) {
      console.warn(`Only ${pageTasks.length} page tasks for ${siteSpec.routes.length} routes`);
    }

    // Validate dependencies exist
    const taskIds = new Set(queue.tasks.map(t => t.id));
    for (const task of queue.tasks) {
      for (const depId of task.dependencies) {
        if (!taskIds.has(depId)) {
          throw new Error(`Task ${task.id} references non-existent dependency: ${depId}`);
        }
      }
    }

    // Check for circular dependencies
    this.detectCircularDependencies(queue.tasks);
  }

  /**
   * Detect circular dependencies
   */
  private detectCircularDependencies(tasks: any[]): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const taskMap = new Map(tasks.map(t => [t.id, t]));

    const hasCycle = (taskId: string): boolean => {
      visited.add(taskId);
      recursionStack.add(taskId);

      const task = taskMap.get(taskId);
      if (!task) return false;

      for (const depId of task.dependencies) {
        if (!visited.has(depId)) {
          if (hasCycle(depId)) return true;
        } else if (recursionStack.has(depId)) {
          return true; // Cycle detected
        }
      }

      recursionStack.delete(taskId);
      return false;
    };

    for (const task of tasks) {
      if (!visited.has(task.id)) {
        if (hasCycle(task.id)) {
          throw new Error(`Circular dependency detected in task: ${task.id}`);
        }
      }
    }
  }

  /**
   * Store WorkQueue artifacts
   */
  private async storeWorkQueueArtifacts(queue: WorkQueue): Promise<Array<{ type: string; url: string; metadata?: any }>> {
    const artifacts = [];

    // Store queue as JSON
    const queueJson = JSON.stringify(queue, null, 2);
    const queueKey = `${this.context.projectId}/specs/work-queue.json`;

    artifacts.push({
      type: 'specification',
      url: queueKey,
      metadata: {
        totalTasks: queue.tasks.length,
        byType: this.summarizeTasksByType(queue.tasks),
        byAgent: this.summarizeTasksByAgent(queue.tasks),
      },
    });

    // Generate visualization
    const visualization = this.generateVisualization(queue);
    const vizKey = `${this.context.projectId}/specs/work-queue.md`;

    artifacts.push({
      type: 'documentation',
      url: vizKey,
      metadata: { format: 'markdown' },
    });

    return artifacts;
  }

  /**
   * Generate human-readable visualization
   */
  private generateVisualization(queue: WorkQueue): string {
    const byAgent = this.summarizeTasksByAgent(queue.tasks);
    const byType = this.summarizeTasksByType(queue.tasks);

    return `# Work Queue - ${queue.tasks.length} Total Tasks

## Tasks by Agent
${Object.entries(byAgent)
  .map(([agent, count]) => `- **${agent}**: ${count} tasks`)
  .join('\n')}

## Tasks by Type
${Object.entries(byType)
  .map(([type, count]) => `- **${type}**: ${count} tasks`)
  .join('\n')}

## Execution Order (Top 20 by Priority)
${queue.tasks
  .sort((a, b) => b.priority - a.priority)
  .slice(0, 20)
  .map((t, i) => `${i + 1}. [Priority ${t.priority}] ${t.id} (${t.type}) - Agent: ${t.agentId}`)
  .join('\n')}

## Dependency Graph (Sample)
${this.renderDependencyGraph(queue.tasks.slice(0, 10))}

## Token Budget Summary
- Total Allocated: ${queue.tasks.reduce((sum, t) => sum + t.budget.tokens, 0).toLocaleString()} tokens
- Average per Task: ${Math.round(queue.tasks.reduce((sum, t) => sum + t.budget.tokens, 0) / queue.tasks.length).toLocaleString()} tokens
- Estimated Cost: $${this.estimateTotalCost(queue.tasks).toFixed(2)}
`;
  }

  /**
   * Render dependency graph
   */
  private renderDependencyGraph(tasks: any[]): string {
    return tasks
      .map(task => {
        const deps = task.dependencies.length > 0 ? ` ← depends on [${task.dependencies.join(', ')}]` : '';
        return `- ${task.id}${deps}`;
      })
      .join('\n');
  }

  /**
   * Summarize tasks by agent
   */
  private summarizeTasksByAgent(tasks: any[]): Record<string, number> {
    const summary: Record<string, number> = {};
    tasks.forEach(t => {
      summary[t.agentId] = (summary[t.agentId] || 0) + 1;
    });
    return summary;
  }

  /**
   * Summarize tasks by type
   */
  private summarizeTasksByType(tasks: any[]): Record<string, number> {
    const summary: Record<string, number> = {};
    tasks.forEach(t => {
      summary[t.type] = (summary[t.type] || 0) + 1;
    });
    return summary;
  }

  /**
   * Estimate total cost
   */
  private estimateTotalCost(tasks: any[]): number {
    const totalTokens = tasks.reduce((sum, t) => sum + t.budget.tokens, 0);
    // Assuming Claude 3.5 Sonnet average pricing
    const INPUT_COST_PER_1K = 0.003;
    const OUTPUT_COST_PER_1K = 0.015;
    // Rough estimate: 60% input, 40% output
    return (totalTokens * 0.6 / 1000) * INPUT_COST_PER_1K + (totalTokens * 0.4 / 1000) * OUTPUT_COST_PER_1K;
  }

  /**
   * Calculate cost
   */
  private calculateCost(usage: { inputTokens: number; outputTokens: number }): number {
    const INPUT_COST_PER_1K = 0.003;
    const OUTPUT_COST_PER_1K = 0.015;
    return (usage.inputTokens / 1000) * INPUT_COST_PER_1K + (usage.outputTokens / 1000) * OUTPUT_COST_PER_1K;
  }
}

// Export factory function
export const createBacklogManagerAgent = (context: ExtendedAgentContext) => new BacklogManagerAgent(context);

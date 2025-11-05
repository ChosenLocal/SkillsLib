// packages/agents/strategy/ia-architect.ts
import { BaseAgent, ExtendedAgentContext } from '../shared/base-agent';
import { AgentManifest, AgentResult, AgentRole, AgentLayer } from '@business-automation/schema';
import { IAPlanSchema, type IAPlan, type SiteSpec } from '@business-automation/schema';
import { z } from 'zod';

/**
 * IA Architect Agent Input Schema
 * Takes a SiteSpec and creates detailed information architecture
 */
export const IAArchitectInputSchema = z.object({
  projectId: z.string(),
  siteSpecPath: z.string(), // Path to stored SiteSpec JSON
});

export type IAArchitectInput = z.infer<typeof IAArchitectInputSchema>;

/**
 * IA Architect Agent - Strategy Tier
 *
 * Transforms a SiteSpec into a comprehensive IAPlan that defines:
 * - Hierarchical sitemap structure
 * - Primary and footer navigation
 * - Breadcrumb strategy
 * - Internal linking for SEO
 *
 * Responsibilities:
 * - Design optimal site hierarchy for user discovery
 * - Plan navigation that serves user journeys
 * - Define internal linking strategy for SEO/AEO
 * - Ensure logical information flow
 */
export class IAArchitectAgent extends BaseAgent {
  static manifest: AgentManifest = {
    id: 'ia-architect',
    name: 'Information Architecture Architect',
    version: '1.0.0',
    category: 'planner',
    tier: 'strategy',
    type: 'core',
    description: 'Designs hierarchical information architecture, navigation, and internal linking strategy',
    capabilities: [
      'Design optimal site hierarchy',
      'Plan navigation structures (primary, footer, mobile)',
      'Define breadcrumb strategy',
      'Create internal linking for SEO',
      'Optimize for user discovery and search engines',
    ],
    requiredEnvVars: ['ANTHROPIC_API_KEY'],
    mcpServers: ['filesystem', 'memory'],
    dependencies: ['planner'], // Requires SiteSpec from Planner
    inputSchema: IAArchitectInputSchema,
    outputSchema: IAPlanSchema,
    sideEffects: ['writes-to-storage'],
    retryable: true,
    maxRetries: 3,
    maxTokens: 8192,
    temperature: 0.7,
    systemPrompt: `You are the Information Architecture (IA) Architect for a business automation system.
Your role is to take a SiteSpec and design the optimal information architecture.

You must:
1. Create a hierarchical sitemap that logically organizes all routes
2. Design primary navigation that serves the most important user journeys
3. Plan footer navigation organized by logical sections
4. Define breadcrumb strategy for user orientation
5. Create internal linking recommendations for SEO authority flow

Focus on:
- User discovery: Can users find what they need in 2-3 clicks?
- SEO: Does the structure support topical authority and crawlability?
- Scalability: Can new pages be added without restructuring?
- Mobile-first: Does navigation work on small screens?

For contractor websites specifically:
- Services should be prominent in navigation
- Service areas should be accessible but not cluttering
- Emergency/contact should be immediately accessible
- Trust signals (testimonials, certifications) should be findable`,
  };

  constructor(context: ExtendedAgentContext) {
    super(context, {
      enableMCP: true,
      mcpServers: ['filesystem', 'memory'],
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.7,
      maxTokens: 8192,
    });
  }

  protected getAgentRole(): AgentRole {
    return 'orchestrator'; // Using existing role
  }

  protected getAgentLayer(): AgentLayer {
    return 'orchestrator'; // Using existing layer
  }

  /**
   * Execute the IA Architect Agent
   */
  protected async execute(input: IAArchitectInput): Promise<AgentResult> {
    // Validate input
    IAArchitectInputSchema.parse(input);

    await this.logProgress('Loading SiteSpec...', 10);

    // Load SiteSpec from storage/filesystem
    // TODO: Actually load from storage when storage client is ready
    // For now, we'll fetch from database or assume it's in a known location
    const siteSpec = await this.loadSiteSpec(input.siteSpecPath);

    await this.logProgress('Analyzing route structure...', 25);

    // Build comprehensive prompt
    const systemPrompt = this.buildSystemPrompt(siteSpec);
    const userPrompt = this.buildUserPrompt(siteSpec);

    await this.logProgress('Designing information architecture...', 50);

    // Call Claude with tool support
    const response = await this.sendMessageWithTools(
      [{ role: 'user', content: userPrompt }],
      systemPrompt
    );

    await this.logProgress('Parsing and validating IA plan...', 75);

    // Parse the IAPlan from response
    const iaPlan = await this.parseIAPlan(response.text);

    // Validate the output
    await this.validateIAPlan(iaPlan, siteSpec);

    await this.logProgress('Storing artifacts...', 90);

    // Store artifacts
    const artifacts = await this.storeIAPlanArtifacts(iaPlan);

    await this.logProgress('Complete', 100);

    return {
      success: true,
      output: iaPlan,
      tokensUsed: response.usage.inputTokens + response.usage.outputTokens,
      cost: this.calculateCost(response.usage),
      artifacts,
    };
  }

  /**
   * Load SiteSpec from storage
   */
  private async loadSiteSpec(path: string): Promise<SiteSpec> {
    // TODO: Load from actual storage
    // For now, try to load from filesystem or database
    try {
      const fs = require('fs');
      const content = fs.readFileSync(path, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load SiteSpec from ${path}: ${error}`);
    }
  }

  /**
   * Build system prompt
   */
  private buildSystemPrompt(siteSpec: SiteSpec): string {
    return `${IAArchitectAgent.manifest.systemPrompt}

Project Context:
- Total Routes: ${siteSpec.routes.length}
- Route Types: ${this.summarizeRouteTypes(siteSpec.routes)}
- Integrations: ${siteSpec.integrations.map(i => i.service).join(', ')}

Key Considerations:
1. Homepage (/) should be the root of the sitemap
2. Service pages should be grouped logically
3. Service area pages should be organized by geography
4. Utility pages (about, contact, privacy) should be in footer
5. Integration pages should be contextually linked from relevant service pages

Output Format:
Return ONLY a valid JSON object matching the IAPlan schema. Do not include markdown code fences.`;
  }

  /**
   * Build user prompt
   */
  private buildUserPrompt(siteSpec: SiteSpec): string {
    return `Create a comprehensive Information Architecture plan for this website:

## Routes to Organize
${siteSpec.routes.map((r, i) => `${i + 1}. ${r.path} - ${r.name} (${r.purpose})`).join('\n')}

## Requirements:

### 1. Sitemap Structure
- Create a hierarchical tree starting from "/" (root)
- Group related routes logically (services together, areas together, etc.)
- Maximum depth should be 3 levels for good UX
- Consider parent-child relationships that make sense to users

### 2. Primary Navigation
- 4-7 top-level items maximum (fewer is better for mobile)
- Include most important user journeys
- Can include dropdowns for sub-pages (but limit dropdown items to 5-8)
- Keep labels short and clear (1-2 words when possible)

### 3. Footer Navigation
- Organize into 3-5 logical sections (e.g., "Services", "Company", "Resources", "Legal")
- Include utility pages that don't belong in primary nav
- Include important but less frequently accessed pages
- Add any integration/partner pages

### 4. Internal Linking Strategy
- Recommend contextual links between related pages
- Use descriptive anchor text (not "click here")
- Support SEO authority flow (important pages get more internal links)
- Recommend 3-5 key internal links per major page

### 5. Breadcrumbs
- Enable: ${siteSpec.routes.length > 10 ? 'true (site is complex)' : 'false (site is simple)'}
- Especially important for deep service or area pages

Output the complete IAPlan as a JSON object following the schema exactly.`;
  }

  /**
   * Parse IAPlan from Claude's response
   */
  private async parseIAPlan(text: string): Promise<IAPlan> {
    try {
      let jsonText = text.trim();

      // Extract JSON from possible markdown
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

      // Validate with schema
      return IAPlanSchema.parse(parsed);
    } catch (error: any) {
      console.error('Failed to parse IAPlan:', error);
      throw new Error(`Failed to parse IAPlan: ${error.message}`);
    }
  }

  /**
   * Validate IAPlan business logic
   */
  private async validateIAPlan(plan: IAPlan, siteSpec: SiteSpec): Promise<void> {
    // Ensure sitemap root is homepage
    if (plan.sitemap.root !== '/') {
      throw new Error('Sitemap root must be "/" (homepage)');
    }

    // Ensure primary navigation isn't too long (mobile UX)
    if (plan.navigation.primary.length > 8) {
      console.warn(
        `Primary navigation has ${plan.navigation.primary.length} items - consider reducing to 7 or fewer for mobile UX`
      );
    }

    // Ensure all routes are represented somewhere
    const allNavRoutes = new Set<string>();
    plan.navigation.primary.forEach(item => {
      allNavRoutes.add(item.route);
      item.children?.forEach(child => allNavRoutes.add(child.route));
    });
    plan.navigation.footer.forEach(section => {
      section.links.forEach(link => allNavRoutes.add(link.route));
    });

    const siteSpecRoutes = siteSpec.routes.map(r => r.path);
    const missingRoutes = siteSpecRoutes.filter(r => !allNavRoutes.has(r));

    if (missingRoutes.length > 0) {
      console.warn(`Some routes not included in navigation: ${missingRoutes.join(', ')}`);
    }

    // Ensure internal links reference valid routes
    const validRoutes = new Set(siteSpecRoutes);
    for (const link of plan.internalLinks) {
      if (!validRoutes.has(link.fromRoute)) {
        throw new Error(`Internal link references invalid fromRoute: ${link.fromRoute}`);
      }
      if (!validRoutes.has(link.toRoute)) {
        throw new Error(`Internal link references invalid toRoute: ${link.toRoute}`);
      }
    }
  }

  /**
   * Store IA Plan artifacts
   */
  private async storeIAPlanArtifacts(plan: IAPlan): Promise<Array<{ type: string; url: string; metadata?: any }>> {
    const artifacts = [];

    // Store the plan as JSON
    const planJson = JSON.stringify(plan, null, 2);
    const planKey = `${this.context.projectId}/specs/ia-plan.json`;

    artifacts.push({
      type: 'specification',
      url: planKey,
      metadata: {
        primaryNavItems: plan.navigation.primary.length,
        footerSections: plan.navigation.footer.length,
        internalLinks: plan.internalLinks.length,
        breadcrumbsEnabled: plan.navigation.breadcrumbs,
      },
    });

    // Generate documentation
    const documentation = this.generateDocumentation(plan);
    const docKey = `${this.context.projectId}/specs/ia-plan.md`;

    artifacts.push({
      type: 'documentation',
      url: docKey,
      metadata: { format: 'markdown' },
    });

    return artifacts;
  }

  /**
   * Generate human-readable documentation
   */
  private generateDocumentation(plan: IAPlan): string {
    return `# Information Architecture Plan

## Sitemap Structure
Root: ${plan.sitemap.root}

${this.renderSitemapTree(plan.sitemap.children, 0)}

## Primary Navigation (${plan.navigation.primary.length} items)
${plan.navigation.primary
  .map(item => {
    let output = `- **${item.label}** → ${item.route}`;
    if (item.children && item.children.length > 0) {
      output += `\n${item.children.map(child => `  - ${child.label} → ${child.route}`).join('\n')}`;
    }
    return output;
  })
  .join('\n')}

## Footer Navigation
${plan.navigation.footer
  .map(
    section => `
### ${section.section}
${section.links.map(link => `- ${link.label} → ${link.route}`).join('\n')}
`
  )
  .join('\n')}

## Breadcrumbs
Enabled: ${plan.navigation.breadcrumbs ? 'Yes' : 'No'}

## Internal Linking Strategy (${plan.internalLinks.length} recommended links)
${plan.internalLinks
  .slice(0, 10)
  .map(link => `- ${link.fromRoute} → ${link.toRoute}\n  "${link.anchorText}" in context: ${link.context}`)
  .join('\n\n')}
${plan.internalLinks.length > 10 ? `\n... and ${plan.internalLinks.length - 10} more` : ''}
`;
  }

  /**
   * Render sitemap tree recursively
   */
  private renderSitemapTree(children: any[], depth: number): string {
    const indent = '  '.repeat(depth);
    return children
      .map(node => {
        let output = `${indent}- ${node.label} (${node.route})`;
        if (node.children && node.children.length > 0) {
          output += '\n' + this.renderSitemapTree(node.children, depth + 1);
        }
        return output;
      })
      .join('\n');
  }

  /**
   * Summarize route types for context
   */
  private summarizeRouteTypes(routes: any[]): string {
    const types: Record<string, number> = {};
    routes.forEach(r => {
      const type = r.contentType || 'static';
      types[type] = (types[type] || 0) + 1;
    });
    return Object.entries(types)
      .map(([type, count]) => `${count} ${type}`)
      .join(', ');
  }

  /**
   * Calculate cost based on token usage
   */
  private calculateCost(usage: { inputTokens: number; outputTokens: number }): number {
    const INPUT_COST_PER_1K = 0.003;
    const OUTPUT_COST_PER_1K = 0.015;

    return (
      (usage.inputTokens / 1000) * INPUT_COST_PER_1K +
      (usage.outputTokens / 1000) * OUTPUT_COST_PER_1K
    );
  }
}

// Export factory function
export const createIAArchitectAgent = (context: ExtendedAgentContext) => new IAArchitectAgent(context);

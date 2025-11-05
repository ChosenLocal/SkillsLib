// packages/agents/strategy/planner.ts
import { BaseAgent, ExtendedAgentContext, AgentExecutionResult } from '../shared/base-agent';
import { AgentManifest, AgentResult, AgentRole, AgentLayer } from '@business-automation/schema';
import { SiteSpecSchema, type SiteSpec } from '@business-automation/schema';
import { z } from 'zod';

/**
 * Planner Agent Input Schema
 * Takes CompanyProfile and constraints to create a detailed SiteSpec
 */
export const PlannerInputSchema = z.object({
  companyProfileId: z.string(),
  constraints: z.object({
    budget: z.number().optional(),
    timeline: z.string().optional(),
    mustHaveFeatures: z.array(z.string()).optional(),
  }).optional(),
});

export type PlannerInput = z.infer<typeof PlannerInputSchema>;

/**
 * Planner Agent - Strategy Tier
 *
 * Transforms a CompanyProfile into a comprehensive SiteSpec that serves as the blueprint
 * for all downstream Build and Quality tier agents.
 *
 * Responsibilities:
 * - Analyze business requirements and goals
 * - Design optimal site structure and information architecture
 * - Define technical requirements and performance targets
 * - Plan content hierarchy and sections
 * - Map integrations to specific routes
 */
export class PlannerAgent extends BaseAgent {
  static manifest: AgentManifest = {
    id: 'planner',
    name: 'Site Planner',
    version: '1.0.0',
    category: 'planner',
    tier: 'strategy',
    type: 'core',
    description: 'Transforms business requirements into comprehensive technical site specifications',
    capabilities: [
      'Convert client requirements to technical specifications',
      'Design information architecture',
      'Plan SEO/AEO strategy',
      'Define content structure',
      'Map integrations to routes',
      'Set performance and accessibility targets',
    ],
    requiredEnvVars: ['ANTHROPIC_API_KEY'],
    mcpServers: ['filesystem', 'memory'],
    dependencies: [],
    inputSchema: PlannerInputSchema,
    outputSchema: SiteSpecSchema,
    sideEffects: ['writes-to-storage'],
    retryable: true,
    maxRetries: 3,
    maxTokens: 16384,
    temperature: 0.7,
    systemPrompt: `You are the Planner Agent for a business automation system that builds contractor websites.
Your role is to transform a comprehensive CompanyProfile into a detailed SiteSpec that other agents will use to build the website.

You must:
1. Analyze the client's business, goals, and brand to determine optimal site structure
2. Design routes that serve specific user journeys and business objectives
3. Plan content hierarchy and information architecture following Next.js 16 App Router conventions
4. Define technical requirements based on modern web standards and industry best practices
5. Map integrations (Sunlight, SumoQuote, EagleView, CompanyCam, etc.) to specific routes where they add value

Focus on creating a specification that is:
- Complete: Every aspect needed for implementation is defined
- Coherent: All parts work together toward business goals
- Realistic: Achievable with Next.js 16, React Server Components, and modern web standards
- Measurable: Success criteria are clear and quantifiable
- SEO-Optimized: Structure supports local SEO and conversion goals`,
  };

  constructor(context: ExtendedAgentContext) {
    super(context, {
      enableMCP: true,
      mcpServers: ['filesystem', 'memory'],
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.7,
      maxTokens: 16384,
    });
  }

  protected getAgentRole(): AgentRole {
    return 'orchestrator'; // Using existing role, can be extended
  }

  protected getAgentLayer(): AgentLayer {
    return 'orchestrator'; // Using existing layer, can be extended
  }

  /**
   * Execute the Planner Agent
   */
  protected async execute(input: PlannerInput): Promise<AgentResult> {
    // Validate input
    PlannerInputSchema.parse(input);

    await this.logProgress('Loading company profile...', 10);

    // Fetch company profile from database
    const companyProfile = await this.prisma.companyProfile.findUnique({
      where: { id: input.companyProfileId },
      include: {
        integrations: true,
      },
    });

    if (!companyProfile) {
      throw new Error(`Company profile not found: ${input.companyProfileId}`);
    }

    await this.logProgress('Analyzing business requirements...', 20);

    // Build the comprehensive prompt
    const systemPrompt = this.buildSystemPrompt(companyProfile);
    const userPrompt = this.buildUserPrompt(companyProfile, input.constraints);

    await this.logProgress('Generating site specification...', 40);

    // Call Claude with tool support
    const response = await this.sendMessageWithTools(
      [{ role: 'user', content: userPrompt }],
      systemPrompt
    );

    await this.logProgress('Parsing and validating specification...', 70);

    // Parse the SiteSpec from response
    const siteSpec = await this.parseSiteSpec(response.text);

    // Validate the output
    await this.validateSiteSpec(siteSpec, companyProfile);

    await this.logProgress('Storing artifacts...', 90);

    // Store artifacts
    const artifacts = await this.storeSpecArtifacts(siteSpec);

    await this.logProgress('Complete', 100);

    return {
      success: true,
      output: siteSpec,
      tokensUsed: response.usage.inputTokens + response.usage.outputTokens,
      cost: this.calculateCost(response.usage),
      artifacts,
    };
  }

  /**
   * Build system prompt with company context
   */
  private buildSystemPrompt(companyProfile: any): string {
    const industry = companyProfile.industry;

    return `${PlannerAgent.manifest.systemPrompt}

Project Context:
- Industry: ${industry}
- Business Type: ${companyProfile.businessType || 'Service Business'}
- Service Areas: ${companyProfile.serviceAreas?.length || 0} locations
- Primary Services: ${companyProfile.services?.slice(0, 5).join(', ') || 'Not specified'}

Industry-Specific Guidance for ${industry}:
${this.getIndustryGuidance(industry)}

Output Format:
Return ONLY a valid JSON object matching the SiteSpec schema. Do not include markdown code fences or any other text.`;
  }

  /**
   * Build user prompt with requirements
   */
  private buildUserPrompt(companyProfile: any, constraints?: any): string {
    return `Create a comprehensive SiteSpec for this contractor business:

Company Information:
- Name: ${companyProfile.name}
- Industry: ${companyProfile.industry}
- Services: ${companyProfile.services?.join(', ') || 'General services'}
- Service Areas: ${companyProfile.serviceAreas?.join(', ') || 'Local area'}
- Unique Selling Points: ${companyProfile.uniqueSellingPoints?.join(', ') || 'Quality and reliability'}

${constraints ? `Constraints:
${JSON.stringify(constraints, null, 2)}` : ''}

Requirements:
1. Design an optimal route structure for a ${companyProfile.industry} business
2. Include pages for all their services
3. Plan for ${companyProfile.serviceAreas?.length || 1} service area pages for local SEO
4. Integrate these core platforms: Sunlight Financial, SumoQuote, EagleView, CompanyCam, Beacon Pro+, QuickBooks
5. Optimize for lead generation and conversion
6. Follow Next.js 16 App Router best practices

Output the complete SiteSpec as a JSON object following the schema exactly.`;
  }

  /**
   * Parse SiteSpec from Claude's response
   */
  private async parseSiteSpec(text: string): Promise<SiteSpec> {
    try {
      // Try to extract JSON from possible markdown code blocks
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

      // Validate with schema
      return SiteSpecSchema.parse(parsed);
    } catch (error: any) {
      console.error('Failed to parse SiteSpec:', error);
      throw new Error(`Failed to parse SiteSpec: ${error.message}`);
    }
  }

  /**
   * Validate SiteSpec business logic
   */
  private async validateSiteSpec(spec: SiteSpec, companyProfile: any): Promise<void> {
    // Ensure minimum routes
    if (spec.routes.length < 3) {
      throw new Error('Site must have at least 3 routes (home, about, contact)');
    }

    // Ensure critical routes exist
    const requiredPaths = ['/', '/about', '/contact'];
    const routePaths = spec.routes.map(r => r.path);

    for (const required of requiredPaths) {
      if (!routePaths.includes(required)) {
        throw new Error(`Missing required route: ${required}`);
      }
    }

    // Validate SEO configuration
    if (!spec.seo?.defaultMeta || Object.keys(spec.seo.defaultMeta).length === 0) {
      throw new Error('SEO default meta must be configured');
    }

    // Validate integrations
    if (!spec.integrations || spec.integrations.length === 0) {
      console.warn('No integrations configured - this is unusual for contractor sites');
    }
  }

  /**
   * Store specification artifacts
   */
  private async storeSpecArtifacts(spec: SiteSpec): Promise<Array<{ type: string; url: string; metadata?: any }>> {
    const artifacts = [];

    // Store the spec as JSON
    const specJson = JSON.stringify(spec, null, 2);
    const specKey = `${this.context.projectId}/specs/site-spec.json`;

    // TODO: Actually upload to storage when storage is configured
    // const specUrl = await this.context.storage.upload(specKey, Buffer.from(specJson));

    artifacts.push({
      type: 'specification',
      url: specKey, // Would be actual URL from storage
      metadata: {
        routeCount: spec.routes.length,
        integrationCount: spec.integrations.length,
      },
    });

    // Generate and store markdown documentation
    const documentation = this.generateDocumentation(spec);
    const docKey = `${this.context.projectId}/specs/site-spec.md`;

    artifacts.push({
      type: 'documentation',
      url: docKey,
      metadata: {
        format: 'markdown',
      },
    });

    return artifacts;
  }

  /**
   * Generate human-readable documentation
   */
  private generateDocumentation(spec: SiteSpec): string {
    return `# Site Specification - ${spec.projectId}

## Routes (${spec.routes.length} total)
${spec.routes.map(r => `- **${r.path}**: ${r.name} - ${r.purpose}`).join('\n')}

## Layouts
${spec.layouts.map(l => `### ${l.name}\n- Regions: ${l.regions.join(', ')}\n- Responsive: ${l.responsive}`).join('\n\n')}

## SEO Strategy
${JSON.stringify(spec.seo, null, 2)}

## Integrations (${spec.integrations.length} total)
${spec.integrations.map(i => `- **${i.service}**: Routes [${i.routes.join(', ')}]`).join('\n')}

## Component Specifications
${spec.componentSpecs.length} components planned:
${spec.componentSpecs.slice(0, 5).map(c => `- ${c.type} (${c.variants.length} variants)`).join('\n')}
${spec.componentSpecs.length > 5 ? `\n... and ${spec.componentSpecs.length - 5} more` : ''}
`;
  }

  /**
   * Get industry-specific guidance
   */
  private getIndustryGuidance(industry: string): string {
    const guidance: Record<string, string> = {
      roofing: `- Include service area pages for local SEO optimization
- Add emergency services callout prominently
- Include financing calculator (integrate Sunlight Financial)
- Add project gallery with before/after photos
- Include insurance claim assistance section
- Add roof inspection scheduling
- Include material selection guide`,

      hvac: `- Include service scheduling system
- Add maintenance plan pages with pricing
- Include energy savings calculator
- Add seasonal promotion areas
- Include emergency service prominently (24/7 availability)
- Add system comparison tools
- Include indoor air quality section`,

      solar: `- Include ROI/savings calculator with dynamic projections
- Add federal and state incentives/rebates information
- Include system monitoring portal integration
- Add educational content about solar technology
- Include financing options prominently (Sunlight Financial)
- Add environmental impact calculator
- Include warranty information`,

      plumbing: `- Include emergency service callout (24/7 service)
- Add service area coverage with response times
- Include online booking system
- Add maintenance tips and blog section
- Include pricing transparency and estimates
- Add water quality testing information
- Include fixture showroom/selection`,

      electrical: `- Include emergency electrical services
- Add electrical safety inspection scheduling
- Include generator installation and maintenance
- Add EV charging station information
- Include smart home automation services
- Add electrical panel upgrade information
- Include commercial services section`,
    };

    return guidance[industry.toLowerCase()] || `Follow general best practices for service-based contractor businesses:
- Emphasize local service areas for SEO
- Include clear CTAs for quotes and scheduling
- Add customer testimonials and reviews
- Include project galleries
- Add service guarantees and warranties
- Include financing options`;
  }

  /**
   * Calculate cost based on token usage
   */
  private calculateCost(usage: { inputTokens: number; outputTokens: number }): number {
    // Claude 3.5 Sonnet pricing (as of 2024)
    const INPUT_COST_PER_1K = 0.003;
    const OUTPUT_COST_PER_1K = 0.015;

    return (
      (usage.inputTokens / 1000) * INPUT_COST_PER_1K +
      (usage.outputTokens / 1000) * OUTPUT_COST_PER_1K
    );
  }
}

// Export factory function
export const createPlannerAgent = (context: ExtendedAgentContext) => new PlannerAgent(context);

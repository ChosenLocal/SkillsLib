// packages/agents/strategy/planner-agent.ts
import { BaseAgent, AgentManifest, AgentContext, AgentResult } from '../shared/base-agent';
import { z } from 'zod';
import { ClientProfileSchema } from '@business-automation/schema';

// Input/Output schemas for Planner
export const PlannerInputSchema = z.object({
  clientProfile: ClientProfileSchema,
  constraints: z.object({
    budget: z.number().optional(),
    timeline: z.string().optional(),
    mustHaveFeatures: z.array(z.string()).optional(),
  }).optional(),
});

export const SiteSpecSchema = z.object({
  routes: z.array(z.object({
    path: z.string(),
    name: z.string(),
    purpose: z.string(),
    seoKeywords: z.array(z.string()),
    contentType: z.enum(['static', 'dynamic', 'interactive']),
    dataNeeds: z.array(z.string()).optional(),
  })),
  informationArchitecture: z.object({
    sitemap: z.any(), // Hierarchical structure
    navigation: z.object({
      primary: z.array(z.object({
        label: z.string(),
        route: z.string(),
        children: z.array(z.any()).optional(),
      })),
      footer: z.array(z.object({
        section: z.string(),
        links: z.array(z.object({
          label: z.string(),
          route: z.string(),
        })),
      })),
    }),
    breadcrumbs: z.boolean(),
    internalLinkingStrategy: z.string(),
  }),
  contentNeeds: z.array(z.object({
    route: z.string(),
    sections: z.array(z.object({
      type: z.string(), // hero, features, testimonials, etc.
      priority: z.enum(['critical', 'important', 'nice-to-have']),
      content: z.object({
        headline: z.string().optional(),
        body: z.string().optional(),
        cta: z.string().optional(),
        assets: z.array(z.string()).optional(),
      }),
    })),
  })),
  brandTargets: z.object({
    tone: z.array(z.string()),
    emotions: z.array(z.string()),
    differentiators: z.array(z.string()),
    avoidList: z.array(z.string()),
  }),
  integrations: z.array(z.object({
    service: z.string(),
    purpose: z.string(),
    routes: z.array(z.string()),
    configuration: z.any(),
  })),
  technicalRequirements: z.object({
    performance: z.object({
      lcp: z.number(), // Target LCP in ms
      fid: z.number(), // Target FID in ms
      cls: z.number(), // Target CLS score
    }),
    seo: z.object({
      schemaMarkup: z.array(z.string()),
      metaStrategy: z.string(),
      canonicalStrategy: z.string(),
    }),
    accessibility: z.object({
      wcagLevel: z.enum(['A', 'AA', 'AAA']),
      screenReaderOptimized: z.boolean(),
    }),
  }),
});

export type PlannerInput = z.infer<typeof PlannerInputSchema>;
export type SiteSpec = z.infer<typeof SiteSpecSchema>;

// Agent manifest
const plannerManifest: AgentManifest = {
  id: 'planner',
  tier: 'strategy',
  type: 'core',
  capabilities: [
    'Convert client requirements to technical specifications',
    'Design information architecture',
    'Plan SEO/AEO strategy',
    'Define content structure',
    'Map integrations to routes',
  ],
  inputSchema: PlannerInputSchema,
  outputSchema: SiteSpecSchema,
  mcpServers: ['filesystem', 'memory'],
  maxTokens: 16384,
  temperature: 0.7,
  systemPrompt: `You are the Planner Agent for a business automation system that builds websites.
Your role is to transform a comprehensive ClientProfile into a detailed SiteSpec that other agents will use to build the website.

You must:
1. Analyze the client's business, goals, and brand to determine optimal site structure
2. Design routes that serve specific user journeys and business objectives
3. Plan content hierarchy and information architecture
4. Define technical requirements based on industry standards
5. Map integrations to specific routes where they add value

Focus on creating a specification that is:
- Complete: Every aspect needed for implementation is defined
- Coherent: All parts work together toward business goals
- Realistic: Achievable with Next.js 16 and modern web standards
- Measurable: Success criteria are clear and quantifiable`,
};

export class PlannerAgent extends BaseAgent<PlannerInput, SiteSpec> {
  constructor() {
    super(plannerManifest);
  }

  protected buildSystemPrompt(input: PlannerInput, context: AgentContext): string {
    const { clientProfile } = input;
    const industry = clientProfile.businessInfo.industry;
    
    return `${this.manifest.systemPrompt}

Project Context:
- Industry: ${industry}
- Business Type: ${clientProfile.businessInfo.businessType}
- Target Market: ${clientProfile.businessInfo.targetMarket}
- Services: ${clientProfile.businessInfo.services.join(', ')}

Brand Guidelines:
- Colors: ${JSON.stringify(clientProfile.brandGuidelines.colorPalette)}
- Typography: ${clientProfile.brandGuidelines.typography.fontFamily}
- Voice: ${clientProfile.brandGuidelines.voiceAndTone.tone.join(', ')}

Current Phase: ${context.phase}
Project ID: ${context.projectId}

Special Considerations for ${industry}:
${this.getIndustrySpecificGuidance(industry)}`;
  }

  protected buildUserPrompt(input: PlannerInput, context: AgentContext): string {
    return `Create a comprehensive SiteSpec for this client:

${JSON.stringify(input.clientProfile, null, 2)}

Constraints:
${JSON.stringify(input.constraints || {}, null, 2)}

Requirements:
1. Design an optimal route structure for a ${input.clientProfile.businessInfo.industry} business
2. Include all necessary pages for their services: ${input.clientProfile.businessInfo.services.join(', ')}
3. Plan for ${input.clientProfile.businessInfo.serviceAreas.length} service areas
4. Integrate these tools: ${input.clientProfile.integrations.map(i => i.platform).join(', ')}
5. Optimize for these goals: ${input.clientProfile.goals.primary}

Output a complete SiteSpec following the exact schema structure.`;
  }

  protected async validateInput(input: PlannerInput): Promise<void> {
    try {
      PlannerInputSchema.parse(input);
      
      // Additional business logic validation
      if (!input.clientProfile.businessInfo.services.length) {
        throw new Error('Client must have at least one service defined');
      }
      
      if (!input.clientProfile.goals.primary) {
        throw new Error('Client must have a primary goal defined');
      }
    } catch (error: any) {
      throw new Error(`Invalid planner input: ${error.message}`);
    }
  }

  protected async parseOutput(content: any): Promise<SiteSpec> {
    try {
      // Extract JSON from Claude's response
      let spec: any;
      
      if (typeof content === 'string') {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          spec = JSON.parse(jsonMatch[1]);
        } else {
          spec = JSON.parse(content);
        }
      } else if (Array.isArray(content)) {
        // Handle multi-part content
        const textContent = content.find(c => c.type === 'text');
        if (textContent) {
          return this.parseOutput(textContent.text);
        }
      } else {
        spec = content;
      }

      // Parse and validate with schema
      return SiteSpecSchema.parse(spec);
    } catch (error: any) {
      throw new Error(`Failed to parse SiteSpec: ${error.message}`);
    }
  }

  protected async validateOutput(output: SiteSpec): Promise<void> {
    // Business logic validation
    if (output.routes.length < 3) {
      throw new Error('Site must have at least 3 routes (home, about, contact)');
    }

    // Ensure critical routes exist
    const requiredPaths = ['/', '/about', '/contact'];
    const routePaths = output.routes.map(r => r.path);
    
    for (const required of requiredPaths) {
      if (!routePaths.includes(required)) {
        throw new Error(`Missing required route: ${required}`);
      }
    }

    // Validate performance targets
    if (output.technicalRequirements.performance.lcp > 2500) {
      throw new Error('LCP target must be under 2500ms for good performance');
    }
  }

  protected async storeArtifacts(output: SiteSpec, context: AgentContext): Promise<any[]> {
    const artifacts = [];
    
    // Store the spec as JSON
    const specPath = `${context.workspace}/specs/site-spec.json`;
    artifacts.push({
      type: 'file',
      path: specPath,
      content: JSON.stringify(output, null, 2),
    });

    // Generate a markdown documentation
    const docPath = `${context.workspace}/specs/site-spec.md`;
    const documentation = this.generateSpecDocumentation(output);
    artifacts.push({
      type: 'file',
      path: docPath,
      content: documentation,
    });

    // Store routes manifest
    const routesPath = `${context.workspace}/specs/routes.json`;
    artifacts.push({
      type: 'file',
      path: routesPath,
      content: JSON.stringify(output.routes, null, 2),
    });

    return artifacts;
  }

  private getIndustrySpecificGuidance(industry: string): string {
    const guidance: Record<string, string> = {
      roofing: `- Include service area pages for local SEO
- Add emergency services callout
- Include financing calculator
- Add project gallery with before/after
- Include insurance claim assistance section`,
      
      hvac: `- Include service scheduling system
- Add maintenance plan pages
- Include energy savings calculator
- Add seasonal promotion areas
- Include emergency service prominently`,
      
      solar: `- Include ROI/savings calculator
- Add incentives/rebates information
- Include system monitoring portal
- Add educational content about solar
- Include financing options prominently`,
      
      plumbing: `- Include emergency service callout
- Add service area coverage
- Include online booking system
- Add maintenance tips section
- Include pricing transparency`,
    };

    return guidance[industry.toLowerCase()] || 'Follow general best practices for service businesses';
  }

  private generateSpecDocumentation(spec: SiteSpec): string {
    return `# Site Specification

## Routes (${spec.routes.length} total)
${spec.routes.map(r => `- **${r.path}**: ${r.name} - ${r.purpose}`).join('\n')}

## Information Architecture
### Primary Navigation
${spec.informationArchitecture.navigation.primary.map(n => `- ${n.label} → ${n.route}`).join('\n')}

### Content Structure
${spec.contentNeeds.map(c => `
### ${c.route}
${c.sections.map(s => `- ${s.type} (${s.priority})`).join('\n')}
`).join('\n')}

## Brand Targets
- **Tone**: ${spec.brandTargets.tone.join(', ')}
- **Emotions**: ${spec.brandTargets.emotions.join(', ')}
- **Differentiators**: ${spec.brandTargets.differentiators.join(', ')}

## Technical Requirements
### Performance Targets
- LCP: ${spec.technicalRequirements.performance.lcp}ms
- FID: ${spec.technicalRequirements.performance.fid}ms
- CLS: ${spec.technicalRequirements.performance.cls}

### Accessibility
- WCAG Level: ${spec.technicalRequirements.accessibility.wcagLevel}
- Screen Reader Optimized: ${spec.technicalRequirements.accessibility.screenReaderOptimized}

## Integrations
${spec.integrations.map(i => `- **${i.service}**: ${i.purpose}`).join('\n')}
`;
  }
}

// Export factory function for worker instantiation
export const createPlannerAgent = () => new PlannerAgent();

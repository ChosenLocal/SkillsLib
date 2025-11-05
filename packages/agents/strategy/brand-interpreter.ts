// packages/agents/strategy/brand-interpreter.ts
import { BaseAgent, ExtendedAgentContext } from '../shared/base-agent';
import { AgentManifest, AgentResult, AgentRole, AgentLayer } from '@business-automation/schema';
import { DesignSpecSchema, type DesignSpec, type SiteSpec } from '@business-automation/schema';
import { z } from 'zod';

/**
 * Brand Interpreter Agent Input Schema
 */
export const BrandInterpreterInputSchema = z.object({
  projectId: z.string(),
  companyProfileId: z.string(),
  siteSpecPath: z.string(), // Path to stored SiteSpec
});

export type BrandInterpreterInput = z.infer<typeof BrandInterpreterInputSchema>;

/**
 * Brand Interpreter Agent - Strategy Tier
 *
 * Transforms brand guidelines and business requirements into a comprehensive
 * DesignSpec with concrete design tokens for implementation.
 *
 * Responsibilities:
 * - Convert brand colors to full Tailwind color palette
 * - Define typography scales and font loading strategy
 * - Create spacing, shadow, and border radius systems
 * - Define motion/animation guidelines
 * - Specify component variant patterns
 * - Ensure accessibility (contrast ratios, readable text)
 */
export class BrandInterpreterAgent extends BaseAgent {
  static manifest: AgentManifest = {
    id: 'brand-interpreter',
    name: 'Brand Interpreter',
    version: '1.0.0',
    category: 'planner',
    tier: 'strategy',
    type: 'core',
    description: 'Transforms brand guidelines into concrete design tokens and component variants',
    capabilities: [
      'Generate Tailwind CSS design tokens',
      'Create color palettes with shades',
      'Define typography scales',
      'Design spacing and layout systems',
      'Specify motion and transitions',
      'Ensure WCAG accessibility compliance',
    ],
    requiredEnvVars: ['ANTHROPIC_API_KEY'],
    mcpServers: ['filesystem', 'memory'],
    dependencies: ['planner'], // Needs SiteSpec for context
    inputSchema: BrandInterpreterInputSchema,
    outputSchema: DesignSpecSchema,
    sideEffects: ['writes-to-storage'],
    retryable: true,
    maxRetries: 3,
    maxTokens: 12288,
    temperature: 0.6, // Lower temperature for more consistent design tokens
    systemPrompt: `You are the Brand Interpreter for a business automation system.
Your role is to transform abstract brand guidelines into concrete, implementable design tokens.

You must:
1. Generate a complete Tailwind CSS color palette from brand colors (50-950 shades)
2. Define a typography system (fonts, sizes, weights, line heights) for Next.js 16
3. Create a spacing scale that maintains visual rhythm
4. Define shadows, border radii, and transitions
5. Specify component variants for different states and contexts
6. Ensure all tokens meet WCAG AAA contrast ratios where applicable

Technical Requirements:
- Output must be Tailwind CSS v4 compatible
- Fonts must work with Next.js font optimization (next/font/google or next/font/local)
- All colors must provide sufficient contrast for text (4.5:1 minimum, 7:1 preferred)
- Spacing should follow a consistent scale (usually 4px or 8px base)
- Motion should respect prefers-reduced-motion

For contractor websites specifically:
- Colors should convey professionalism and trust
- Typography should be highly readable (contractors often browsing on mobile)
- Call-to-action buttons should be prominent with high contrast
- Important contact info should use attention-grabbing but professional colors`,
  };

  constructor(context: ExtendedAgentContext) {
    super(context, {
      enableMCP: true,
      mcpServers: ['filesystem', 'memory'],
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.6,
      maxTokens: 12288,
    });
  }

  protected getAgentRole(): AgentRole {
    return 'orchestrator';
  }

  protected getAgentLayer(): AgentLayer {
    return 'orchestrator';
  }

  /**
   * Execute the Brand Interpreter Agent
   */
  protected async execute(input: BrandInterpreterInput): Promise<AgentResult> {
    // Validate input
    BrandInterpreterInputSchema.parse(input);

    await this.logProgress('Loading company profile and site spec...', 10);

    // Fetch company profile
    const companyProfile = await this.prisma.companyProfile.findUnique({
      where: { id: input.companyProfileId },
    });

    if (!companyProfile) {
      throw new Error(`Company profile not found: ${input.companyProfileId}`);
    }

    // Load SiteSpec
    const siteSpec = await this.loadSiteSpec(input.siteSpecPath);

    await this.logProgress('Analyzing brand guidelines...', 25);

    // Build prompts
    const systemPrompt = this.buildSystemPrompt(companyProfile);
    const userPrompt = this.buildUserPrompt(companyProfile, siteSpec);

    await this.logProgress('Generating design tokens...', 50);

    // Call Claude
    const response = await this.sendMessageWithTools(
      [{ role: 'user', content: userPrompt }],
      systemPrompt
    );

    await this.logProgress('Parsing and validating design spec...', 75);

    // Parse DesignSpec
    const designSpec = await this.parseDesignSpec(response.text);

    // Validate output
    await this.validateDesignSpec(designSpec);

    await this.logProgress('Storing artifacts...', 90);

    // Store artifacts
    const artifacts = await this.storeDesignSpecArtifacts(designSpec);

    await this.logProgress('Complete', 100);

    return {
      success: true,
      output: designSpec,
      tokensUsed: response.usage.inputTokens + response.usage.outputTokens,
      cost: this.calculateCost(response.usage),
      artifacts,
    };
  }

  /**
   * Load SiteSpec from storage
   */
  private async loadSiteSpec(path: string): Promise<SiteSpec> {
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
  private buildSystemPrompt(companyProfile: any): string {
    return `${BrandInterpreterAgent.manifest.systemPrompt}

Industry Context: ${companyProfile.industry}
Business Type: ${companyProfile.businessType || 'Service Business'}

Brand Guidelines:
${JSON.stringify(companyProfile.brandGuidelines || {}, null, 2)}

Color Psychology for ${companyProfile.industry}:
${this.getIndustryColorGuidance(companyProfile.industry)}

Output Format:
Return ONLY a valid JSON object matching the DesignSpec schema. Include all required fields.`;
  }

  /**
   * Build user prompt
   */
  private buildUserPrompt(companyProfile: any, siteSpec: SiteSpec): string {
    return `Create a comprehensive DesignSpec for this ${companyProfile.industry} business:

## Brand Information
- Company: ${companyProfile.name}
- Primary Colors: ${companyProfile.brandGuidelines?.primaryColor || 'Not specified - suggest professional options'}
- Secondary Colors: ${companyProfile.brandGuidelines?.secondaryColor || 'Not specified'}
- Font Preferences: ${companyProfile.brandGuidelines?.fontFamily || 'Not specified'}
- Brand Voice: ${companyProfile.brandGuidelines?.voiceAndTone?.tone?.join(', ') || 'Professional, trustworthy'}

## Site Context
- Total Routes: ${siteSpec.routes.length}
- Component Types Needed: ${siteSpec.componentSpecs.length} components
- Key Integrations: ${siteSpec.integrations.map(i => i.service).join(', ')}

## Requirements:

### 1. Color Tokens
Generate a complete Tailwind palette:
- Primary color: Full 50-950 shades (if brand color provided, use it as base-600)
- Secondary/accent color: Full 50-950 shades
- Neutral grays: 50-950 shades for text and backgrounds
- Semantic colors: success (green), warning (yellow), error (red), info (blue)
- Ensure text-on-background combinations meet WCAG AAA (7:1 contrast ratio)

### 2. Typography
- Primary font: Google Font or web-safe font, optimized for readability
- Heading font: Can be same as primary or complementary
- Font sizes: xs, sm, base, lg, xl, 2xl, 3xl, 4xl, 5xl, 6xl (rem values)
- Font weights: light (300), normal (400), medium (500), semibold (600), bold (700)
- Line heights: tight (1.25), snug (1.375), normal (1.5), relaxed (1.625), loose (2)

### 3. Spacing System
8px base system: 0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 56, 64

### 4. Breakpoints (Mobile-First)
- sm: '640px'
- md: '768px'
- lg: '1024px'
- xl: '1280px'
- 2xl: '1536px'

### 5. Shadows & Effects
- sm, DEFAULT, md, lg, xl, 2xl
- inner (for inset shadows)

### 6. Border Radii
- none, sm, DEFAULT, md, lg, xl, 2xl, 3xl, full

### 7. Transitions
- none, all, DEFAULT, colors, opacity, shadow, transform
- Durations: 75ms, 100ms, 150ms, 200ms, 300ms, 500ms, 700ms, 1000ms
- Easings: linear, in, out, in-out

### 8. Motion System
- Durations: instant (0ms), fast (150ms), normal (300ms), slow (500ms)
- Easings: linear, easeIn, easeOut, easeInOut, bounce

### 9. Grid System
- Columns: 12 (standard)
- Gap: Use spacing scale
- Max Width: 1280px (xl breakpoint)

### 10. Component Variants
Define variants for these key components:
- Button: primary, secondary, outline, ghost, link, danger
- Card: default, elevated, flat, interactive
- Input: default, error, success, disabled
- Badge: default, success, warning, error, info

Output the complete DesignSpec as a JSON object.`;
  }

  /**
   * Parse DesignSpec from response
   */
  private async parseDesignSpec(text: string): Promise<DesignSpec> {
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
      return DesignSpecSchema.parse(parsed);
    } catch (error: any) {
      console.error('Failed to parse DesignSpec:', error);
      throw new Error(`Failed to parse DesignSpec: ${error.message}`);
    }
  }

  /**
   * Validate DesignSpec
   */
  private async validateDesignSpec(spec: DesignSpec): Promise<void> {
    // Ensure required color tokens exist
    const requiredColors = ['primary', 'secondary', 'neutral', 'success', 'warning', 'error'];
    for (const color of requiredColors) {
      if (!spec.tokens.colors[color]) {
        throw new Error(`Missing required color token: ${color}`);
      }
    }

    // Ensure typography is complete
    if (!spec.tokens.typography.fonts['sans'] && !spec.tokens.typography.fonts['primary']) {
      throw new Error('At least one primary font must be defined');
    }

    // Ensure spacing system exists
    const requiredSpacing = ['0', '1', '2', '4', '8', '16'];
    for (const space of requiredSpacing) {
      if (!spec.tokens.spacing[space]) {
        console.warn(`Missing recommended spacing value: ${space}`);
      }
    }

    // Ensure breakpoints are defined
    if (!spec.tokens.breakpoints['sm'] || !spec.tokens.breakpoints['md']) {
      throw new Error('At least sm and md breakpoints must be defined');
    }
  }

  /**
   * Store DesignSpec artifacts
   */
  private async storeDesignSpecArtifacts(spec: DesignSpec): Promise<Array<{ type: string; url: string; metadata?: any }>> {
    const artifacts = [];

    // Store spec as JSON
    const specJson = JSON.stringify(spec, null, 2);
    const specKey = `${this.context.projectId}/specs/design-spec.json`;

    artifacts.push({
      type: 'specification',
      url: specKey,
      metadata: {
        colorCount: Object.keys(spec.tokens.colors).length,
        fontCount: Object.keys(spec.tokens.typography.fonts).length,
        componentVariants: Object.keys(spec.componentVariants).length,
      },
    });

    // Generate Tailwind config
    const tailwindConfig = this.generateTailwindConfig(spec);
    const configKey = `${this.context.projectId}/specs/tailwind.config.preview.js`;

    artifacts.push({
      type: 'configuration',
      url: configKey,
      metadata: { framework: 'tailwind', version: '4' },
    });

    // Generate documentation
    const documentation = this.generateDocumentation(spec);
    const docKey = `${this.context.projectId}/specs/design-spec.md`;

    artifacts.push({
      type: 'documentation',
      url: docKey,
      metadata: { format: 'markdown' },
    });

    return artifacts;
  }

  /**
   * Generate Tailwind config from DesignSpec
   */
  private generateTailwindConfig(spec: DesignSpec): string {
    return `// Generated Tailwind CSS v4 configuration
// This is a preview - actual config will be generated by Build tier agents

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: ${JSON.stringify(spec.tokens.colors, null, 6)},
      fontFamily: ${JSON.stringify(spec.tokens.typography.fonts, null, 6)},
      fontSize: ${JSON.stringify(spec.tokens.typography.sizes, null, 6)},
      fontWeight: ${JSON.stringify(spec.tokens.typography.weights, null, 6)},
      lineHeight: ${JSON.stringify(spec.tokens.typography.lineHeights, null, 6)},
      spacing: ${JSON.stringify(spec.tokens.spacing, null, 6)},
      screens: ${JSON.stringify(spec.tokens.breakpoints, null, 6)},
      boxShadow: ${JSON.stringify(spec.tokens.shadows, null, 6)},
      borderRadius: ${JSON.stringify(spec.tokens.radii, null, 6)},
      transitionProperty: ${JSON.stringify(spec.tokens.transitions, null, 6)},
    },
  },
  plugins: [],
};
`;
  }

  /**
   * Generate human-readable documentation
   */
  private generateDocumentation(spec: DesignSpec): string {
    return `# Design Specification

## Color Palette
${Object.keys(spec.tokens.colors)
  .slice(0, 10)
  .map(key => `- **${key}**: ${JSON.stringify(spec.tokens.colors[key])}`)
  .join('\n')}

## Typography
### Fonts
${Object.entries(spec.tokens.typography.fonts)
  .map(([key, value]) => `- **${key}**: ${value}`)
  .join('\n')}

### Sizes
${Object.entries(spec.tokens.typography.sizes)
  .slice(0, 8)
  .map(([key, value]) => `- **${key}**: ${value}`)
  .join('\n')}

## Spacing System
${Object.entries(spec.tokens.spacing)
  .slice(0, 12)
  .map(([key, value]) => `- **${key}**: ${value}`)
  .join('\n')}

## Grid System
- Columns: ${spec.grid.columns}
- Gap: ${spec.grid.gap}
- Max Width: ${spec.grid.maxWidth}

## Motion
### Durations
${Object.entries(spec.motion.durations)
  .map(([key, value]) => `- **${key}**: ${value}ms`)
  .join('\n')}

## Component Variants
${Object.entries(spec.componentVariants)
  .map(([component, variants]) => `- **${component}**: ${variants.join(', ')}`)
  .join('\n')}
`;
  }

  /**
   * Get industry-specific color guidance
   */
  private getIndustryColorGuidance(industry: string): string {
    const guidance: Record<string, string> = {
      roofing: 'Deep blues/grays convey reliability. Bright accent for CTAs (orange/red for urgency). Avoid dark colors that hide damage photos.',
      hvac: 'Cool blues for cooling, warm oranges/reds for heating. Green for efficiency. Professional neutrals for trust.',
      solar: 'Bright yellows/oranges for sun/energy. Blues for sky/technology. Greens for environmental focus.',
      plumbing: 'Blues for water. Clean whites. Red/orange for emergency services. Avoid brown (negative associations).',
      electrical: 'Electric blue, bright yellows (caution). Black/orange for professionalism and energy.',
    };

    return guidance[industry.toLowerCase()] || 'Professional blues, greens, or grays. Bright accent color for CTAs.';
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
export const createBrandInterpreterAgent = (context: ExtendedAgentContext) => new BrandInterpreterAgent(context);

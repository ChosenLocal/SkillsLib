// packages/agents/build/component-worker.ts
import { BaseAgent, ExtendedAgentContext } from '../shared/base-agent';
import { AgentManifest, AgentResult, AgentRole, AgentLayer } from '@business-automation/schema';
import { ComponentFilesSchema, type ComponentFiles, type DesignSpec } from '@business-automation/schema';
import { z } from 'zod';

/**
 * Component Worker Agent Input Schema
 */
export const ComponentWorkerInputSchema = z.object({
  projectId: z.string(),
  componentSpec: z.object({
    id: z.string(),
    type: z.string(),
    variants: z.array(z.string()),
    props: z.record(z.any()),
    slots: z.array(z.string()).optional(),
  }),
  designSpecPath: z.string(), // Path to DesignSpec for styling context
});

export type ComponentWorkerInput = z.infer<typeof ComponentWorkerInputSchema>;

/**
 * Component Worker Agent - Build Tier (Ephemeral)
 *
 * Generates production-ready React components with:
 * - TypeScript interfaces for props
 * - Tailwind CSS styling using design tokens
 * - Accessibility attributes (ARIA)
 * - Responsive behavior
 * - Proper semantic HTML
 *
 * This is an ephemeral agent - many instances run in parallel,
 * each generating one component.
 */
export class ComponentWorkerAgent extends BaseAgent {
  static manifest: AgentManifest = {
    id: 'component-worker',
    name: 'Component Worker',
    version: '1.0.0',
    category: 'builder',
    tier: 'build',
    type: 'ephemeral', // Many instances in parallel
    description: 'Generates production-ready React components with TypeScript and Tailwind CSS',
    capabilities: [
      'Generate React Server Components',
      'Create TypeScript prop interfaces',
      'Apply Tailwind CSS design tokens',
      'Ensure WCAG accessibility',
      'Support component variants',
      'Handle responsive behavior',
    ],
    requiredEnvVars: ['ANTHROPIC_API_KEY'],
    mcpServers: ['filesystem', 'memory'],
    dependencies: ['scaffolder'], // Needs project structure first
    inputSchema: ComponentWorkerInputSchema,
    outputSchema: ComponentFilesSchema,
    sideEffects: ['writes-to-storage'],
    retryable: true,
    maxRetries: 2,
    maxTokens: 8000,
    temperature: 0.4, // Low-medium temperature for consistent but creative components
    systemPrompt: `You are the Component Worker Agent for a Next.js 16 website generation system.
Your role is to generate production-ready React components.

You must:
1. Generate a TypeScript React Server Component (RSC) by default
2. Create a proper TypeScript interface for props
3. Use Tailwind CSS classes from the design system (no custom CSS)
4. Ensure WCAG AAA accessibility (ARIA labels, semantic HTML, keyboard navigation)
5. Support multiple variants via props
6. Make components responsive using Tailwind breakpoints
7. Use Next.js optimized components (next/image, next/link) when appropriate
8. Export both default and named exports

Technical Requirements:
- React 19 Server Components (use "use client" only if truly needed)
- TypeScript strict mode
- Tailwind CSS v4 utility classes only
- Semantic HTML5 elements
- ARIA attributes for accessibility
- Responsive design (mobile-first)
- Performance optimization (lazy loading, proper image sizing)

Component Types:
- Hero: Full-width header with CTA, image, and headline
- ServiceGrid: Responsive grid of service cards
- ContactForm: Accessible form with validation
- Testimonials: Carousel or grid of customer reviews
- CallToAction: Prominent CTA section with button
- Header: Site navigation with mobile menu
- Footer: Site footer with links and info

For each component:
- Use descriptive prop names
- Provide sensible defaults
- Support light/dark mode if applicable
- Ensure proper TypeScript types
- Include JSDoc comments for complex logic`,
  };

  constructor(context: ExtendedAgentContext) {
    super(context, {
      enableMCP: true,
      mcpServers: ['filesystem', 'memory'],
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.4,
      maxTokens: 8000,
    });
  }

  protected getAgentRole(): AgentRole {
    return 'builder';
  }

  protected getAgentLayer(): AgentLayer {
    return 'orchestrator';
  }

  /**
   * Execute the Component Worker Agent
   */
  protected async execute(input: ComponentWorkerInput): Promise<AgentResult> {
    // Validate input
    ComponentWorkerInputSchema.parse(input);

    await this.logProgress('Loading design specification...', 10);

    // Load DesignSpec for styling context
    const designSpec = await this.loadSpec<DesignSpec>(input.designSpecPath);

    await this.logProgress('Analyzing component requirements...', 25);

    // Build prompt for component generation
    const systemPrompt = this.buildSystemPrompt(designSpec);
    const userPrompt = this.buildUserPrompt(input.componentSpec, designSpec);

    await this.logProgress('Generating component code...', 50);

    // Call Claude to generate the component
    const response = await this.sendMessageWithTools(
      [{ role: 'user', content: userPrompt }],
      systemPrompt
    );

    await this.logProgress('Parsing and validating component...', 75);

    // Parse component files from response
    const componentFiles = await this.parseComponentFiles(response.text, input.componentSpec);

    // Validate output
    await this.validateComponentFiles(componentFiles);

    await this.logProgress('Storing component...', 90);

    // Store component files
    const artifacts = await this.storeComponent(componentFiles);

    await this.logProgress('Complete', 100);

    return {
      success: true,
      output: componentFiles,
      tokensUsed: response.usage.inputTokens + response.usage.outputTokens,
      cost: this.calculateCost(response.usage),
      artifacts,
    };
  }

  /**
   * Load specification from storage
   */
  private async loadSpec<T>(path: string): Promise<T> {
    try {
      const fs = require('fs');
      const content = fs.readFileSync(path, 'utf-8');
      return JSON.parse(content) as T;
    } catch (error) {
      throw new Error(`Failed to load spec from ${path}: ${error}`);
    }
  }

  /**
   * Build system prompt with design context
   */
  private buildSystemPrompt(designSpec: DesignSpec): string {
    return `${ComponentWorkerAgent.manifest.systemPrompt}

Design System Context:
- Primary Color: ${JSON.stringify(designSpec.tokens.colors['primary'] || '#3B82F6')}
- Typography: ${JSON.stringify(designSpec.tokens.typography.fonts)}
- Spacing Scale: ${Object.keys(designSpec.tokens.spacing).slice(0, 8).join(', ')}
- Breakpoints: ${Object.keys(designSpec.tokens.breakpoints).join(', ')}

Color Tokens Available:
${Object.keys(designSpec.tokens.colors).slice(0, 10).join(', ')}

Component Variant Guidelines:
${Object.entries(designSpec.componentVariants || {})
  .slice(0, 5)
  .map(([comp, variants]) => `- ${comp}: ${variants.join(', ')}`)
  .join('\n')}

Output Format:
Return a JSON object with this structure:
{
  "version": "1.0",
  "componentId": "component-id",
  "files": [
    {
      "path": "components/ComponentName.tsx",
      "content": "// Full TypeScript component code",
      "type": "tsx"
    }
  ],
  "exports": [
    { "name": "ComponentName", "isDefault": true }
  ],
  "dependencies": ["react", "next/image"],
  "props": "interface ComponentNameProps { ... }"
}`;
  }

  /**
   * Build user prompt for component generation
   */
  private buildUserPrompt(componentSpec: any, designSpec: DesignSpec): string {
    return `Generate a production-ready React component with the following specifications:

## Component Details
- **ID**: ${componentSpec.id}
- **Type**: ${componentSpec.type}
- **Variants**: ${componentSpec.variants.join(', ')}
- **Props**: ${JSON.stringify(componentSpec.props, null, 2)}
${componentSpec.slots ? `- **Slots**: ${componentSpec.slots.join(', ')}` : ''}

## Requirements

### 1. TypeScript Interface
Create a comprehensive prop interface with:
- Required and optional props
- Union types for variants
- JSDoc comments for complex props
- Proper TypeScript typing (no \`any\`)

### 2. Component Implementation
- React Server Component by default (no "use client" unless state/effects needed)
- Support all specified variants
- Use Tailwind utility classes matching the design system
- Implement proper semantic HTML
- Add ARIA attributes for accessibility

### 3. Styling
Use only these design tokens:
- Colors: ${Object.keys(designSpec.tokens.colors).slice(0, 8).join(', ')}
- Spacing: ${Object.keys(designSpec.tokens.spacing).slice(0, 6).join(', ')}
- Font sizes: ${Object.keys(designSpec.tokens.typography.sizes).slice(0, 6).join(', ')}
- Border radius: ${Object.keys(designSpec.tokens.radii).slice(0, 4).join(', ')}

### 4. Responsive Design
- Mobile-first approach
- Use breakpoints: ${Object.keys(designSpec.tokens.breakpoints).join(', ')}
- Ensure components work on all screen sizes

### 5. Accessibility
- WCAG AAA compliance
- Proper ARIA labels and roles
- Keyboard navigation support
- Focus states visible
- Color contrast ratios met (7:1 minimum)

### 6. Performance
- Use \`next/image\` for images with proper sizing
- Use \`next/link\` for internal navigation
- Lazy load heavy content when appropriate
- Optimize bundle size

## Example Component Types

### Hero Component
\`\`\`typescript
interface HeroProps {
  variant?: 'full' | 'split';
  title: string;
  subtitle?: string;
  ctaText: string;
  ctaHref: string;
  imageSrc?: string;
  imageAlt?: string;
}
\`\`\`

### ServiceGrid Component
\`\`\`typescript
interface ServiceGridProps {
  services: Array<{
    title: string;
    description: string;
    icon?: string;
    href: string;
  }>;
  columns?: 2 | 3 | 4;
}
\`\`\`

Generate the complete component following these specifications.
Return ONLY the JSON object with the component files.`;
  }

  /**
   * Parse component files from Claude's response
   */
  private async parseComponentFiles(text: string, componentSpec: any): Promise<ComponentFiles> {
    try {
      let jsonText = text.trim();

      // Extract JSON from markdown code blocks
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

      // Ensure componentId matches
      if (!parsed.componentId) {
        parsed.componentId = componentSpec.id;
      }

      // Validate with schema
      return ComponentFilesSchema.parse(parsed);
    } catch (error: any) {
      console.error('Failed to parse ComponentFiles:', error);
      throw new Error(`Failed to parse ComponentFiles: ${error.message}`);
    }
  }

  /**
   * Validate component files
   */
  private async validateComponentFiles(files: ComponentFiles): Promise<void> {
    // Ensure at least one TSX file exists
    const tsxFiles = files.files.filter(f => f.type === 'tsx');
    if (tsxFiles.length === 0) {
      throw new Error('Component must have at least one .tsx file');
    }

    // Ensure main component file exists
    const mainFile = tsxFiles.find(f => f.path.includes(files.componentId));
    if (!mainFile) {
      throw new Error(`Main component file not found for ${files.componentId}`);
    }

    // Validate component code contains TypeScript interface
    if (!mainFile.content.includes('interface ') && !mainFile.content.includes('type ')) {
      console.warn(`Component ${files.componentId} may be missing TypeScript types`);
    }

    // Validate exports
    if (files.exports.length === 0) {
      throw new Error('Component must export at least one named export');
    }

    // Ensure default export exists
    const hasDefault = files.exports.some(e => e.isDefault);
    if (!hasDefault) {
      console.warn(`Component ${files.componentId} has no default export`);
    }
  }

  /**
   * Store component files
   */
  private async storeComponent(
    componentFiles: ComponentFiles
  ): Promise<Array<{ type: string; url: string; metadata?: any }>> {
    const artifacts = [];

    // Store component metadata as JSON
    const metadataJson = JSON.stringify(componentFiles, null, 2);
    const metadataKey = `${this.context.projectId}/components/${componentFiles.componentId}/metadata.json`;

    artifacts.push({
      type: 'component-metadata',
      url: metadataKey,
      metadata: {
        componentId: componentFiles.componentId,
        fileCount: componentFiles.files.length,
        exports: componentFiles.exports.length,
      },
    });

    // Store each component file
    for (const file of componentFiles.files) {
      const fileKey = `${this.context.projectId}/build/${file.path}`;
      artifacts.push({
        type: 'component-file',
        url: fileKey,
        metadata: {
          componentId: componentFiles.componentId,
          fileType: file.type,
          size: Buffer.byteLength(file.content, 'utf-8'),
        },
      });
    }

    return artifacts;
  }

  /**
   * Calculate cost based on token usage
   */
  private calculateCost(usage: { inputTokens: number; outputTokens: number }): number {
    const INPUT_COST_PER_1K = 0.003;
    const OUTPUT_COST_PER_1K = 0.015;
    return (usage.inputTokens / 1000) * INPUT_COST_PER_1K + (usage.outputTokens / 1000) * OUTPUT_COST_PER_1K;
  }
}

// Export factory function
export const createComponentWorkerAgent = (context: ExtendedAgentContext) => new ComponentWorkerAgent(context);

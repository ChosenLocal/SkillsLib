// packages/agents/build/page-assembler.ts
import { BaseAgent, ExtendedAgentContext } from '../shared/base-agent';
import { AgentManifest, AgentResult, AgentRole, AgentLayer } from '@business-automation/schema';
import { PageFilesSchema, type PageFiles, type SiteSpec, type DesignSpec, type IAPlan } from '@business-automation/schema';
import { z } from 'zod';

/**
 * Page Assembler Agent Input Schema
 */
export const PageAssemblerInputSchema = z.object({
  projectId: z.string(),
  route: z.object({
    path: z.string(),
    name: z.string(),
    purpose: z.string(),
    layout: z.string(),
    sections: z.array(z.string()),
    seoKeywords: z.array(z.string()),
    contentType: z.enum(['static', 'dynamic', 'interactive']),
  }),
  designSpecPath: z.string(),
  iaPlanPath: z.string(),
  availableComponents: z.array(z.string()).optional(), // Component IDs that exist
});

export type PageAssemblerInput = z.infer<typeof PageAssemblerInputSchema>;

/**
 * Page Assembler Agent - Build Tier (Core)
 *
 * Assembles complete Next.js 16 pages by:
 * - Composing components into page layouts
 * - Generating page.tsx with proper imports
 * - Creating metadata for SEO
 * - Adding navigation breadcrumbs
 * - Implementing data fetching if needed
 * - Ensuring proper TypeScript typing
 *
 * This agent runs after components are generated.
 */
export class PageAssemblerAgent extends BaseAgent {
  static manifest: AgentManifest = {
    id: 'page-assembler',
    name: 'Page Assembler',
    version: '1.0.0',
    category: 'builder',
    tier: 'build',
    type: 'core',
    description: 'Assembles complete Next.js 16 pages from components with proper routing and metadata',
    capabilities: [
      'Compose pages from components',
      'Generate Next.js App Router pages',
      'Create SEO metadata',
      'Implement breadcrumb navigation',
      'Add data fetching logic',
      'Set up route handlers',
    ],
    requiredEnvVars: ['ANTHROPIC_API_KEY'],
    mcpServers: ['filesystem', 'memory'],
    dependencies: ['scaffolder', 'component-worker'],
    inputSchema: PageAssemblerInputSchema,
    outputSchema: PageFilesSchema,
    sideEffects: ['writes-to-storage'],
    retryable: true,
    maxRetries: 2,
    maxTokens: 10000,
    temperature: 0.3, // Low temperature for consistent page structure
    systemPrompt: `You are the Page Assembler Agent for a Next.js 16 website generation system.
Your role is to assemble complete pages from generated components.

You must:
1. Generate a page.tsx file following Next.js 16 App Router conventions
2. Import and compose the appropriate components for each section
3. Create proper TypeScript types for page props
4. Generate metadata for SEO (title, description, OpenGraph)
5. Implement breadcrumb navigation when needed
6. Add loading.tsx and error.tsx files if the page needs them
7. Create route handlers (route.ts) for API endpoints if needed

Technical Requirements:
- Next.js 16 App Router file conventions
- React Server Components (default)
- TypeScript strict mode
- Proper metadata generation
- Component composition patterns
- Data fetching with fetch() and caching strategies
- Error boundaries and loading states
- Accessibility (heading hierarchy, landmarks)

Page Structure:
\`\`\`tsx
// app/[route]/page.tsx
import { Metadata } from 'next';
import Component1 from '@/components/Component1';
import Component2 from '@/components/Component2';

export const metadata: Metadata = {
  title: '...',
  description: '...',
};

export default function Page() {
  return (
    <main>
      <Component1 {...props} />
      <Component2 {...props} />
    </main>
  );
}
\`\`\`

Component Composition:
- Use semantic HTML sections
- Maintain proper heading hierarchy (h1 → h2 → h3)
- Add ARIA landmarks (main, nav, aside, footer)
- Ensure logical reading order
- Support responsive layouts`,
  };

  constructor(context: ExtendedAgentContext) {
    super(context, {
      enableMCP: true,
      mcpServers: ['filesystem', 'memory'],
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.3,
      maxTokens: 10000,
    });
  }

  protected getAgentRole(): AgentRole {
    return 'builder';
  }

  protected getAgentLayer(): AgentLayer {
    return 'orchestrator';
  }

  /**
   * Execute the Page Assembler Agent
   */
  protected async execute(input: PageAssemblerInput): Promise<AgentResult> {
    // Validate input
    PageAssemblerInputSchema.parse(input);

    await this.logProgress('Loading specifications...', 10);

    // Load design and IA specs
    const designSpec = await this.loadSpec<DesignSpec>(input.designSpecPath);
    const iaPlan = await this.loadSpec<IAPlan>(input.iaPlanPath);

    await this.logProgress('Analyzing page requirements...', 25);

    // Build prompt for page generation
    const systemPrompt = this.buildSystemPrompt(input.route, iaPlan);
    const userPrompt = this.buildUserPrompt(input.route, designSpec, iaPlan, input.availableComponents);

    await this.logProgress('Generating page files...', 50);

    // Call Claude to generate the page
    const response = await this.sendMessageWithTools(
      [{ role: 'user', content: userPrompt }],
      systemPrompt
    );

    await this.logProgress('Parsing and validating page...', 75);

    // Parse page files from response
    const pageFiles = await this.parsePageFiles(response.text, input.route);

    // Validate output
    await this.validatePageFiles(pageFiles);

    await this.logProgress('Storing page files...', 90);

    // Store page files
    const artifacts = await this.storePage(pageFiles);

    await this.logProgress('Complete', 100);

    return {
      success: true,
      output: pageFiles,
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
   * Build system prompt with page context
   */
  private buildSystemPrompt(route: any, iaPlan: IAPlan): string {
    // Find navigation context for this route
    const navItem = iaPlan.navigation.primary.find(item => item.route === route.path);
    const internalLinks = iaPlan.internalLinks.filter(link => link.fromRoute === route.path);

    return `${PageAssemblerAgent.manifest.systemPrompt}

Page Context:
- Route: ${route.path}
- Name: ${route.name}
- Purpose: ${route.purpose}
- Content Type: ${route.contentType}
- Sections: ${route.sections.join(', ')}

Navigation Context:
- Navigation Label: ${navItem?.label || route.name}
- Has Children: ${navItem?.children ? 'Yes' : 'No'}
- Internal Links: ${internalLinks.length} links to other pages

Breadcrumbs: ${iaPlan.navigation.breadcrumbs ? 'Enabled' : 'Disabled'}

Output Format:
Return a JSON object with this structure:
{
  "version": "1.0",
  "route": "${route.path}",
  "files": [
    {
      "path": "app${route.path === '/' ? '' : route.path}/page.tsx",
      "content": "// Full page component code",
      "type": "page"
    }
  ],
  "imports": ["@/components/Hero", "@/components/ServiceGrid"],
  "dataFetching": [
    {
      "source": "api",
      "method": "GET",
      "cache": "force-cache"
    }
  ]
}`;
  }

  /**
   * Build user prompt for page generation
   */
  private buildUserPrompt(route: any, designSpec: DesignSpec, iaPlan: IAPlan, availableComponents?: string[]): string {
    return `Generate a complete Next.js 16 page for the following route:

## Route Details
- **Path**: ${route.path}
- **Name**: ${route.name}
- **Purpose**: ${route.purpose}
- **Content Type**: ${route.contentType}
- **Layout**: ${route.layout}

## Sections to Include
${route.sections.map((section: string, idx: number) => `${idx + 1}. ${section}`).join('\n')}

## SEO Requirements
- **Keywords**: ${route.seoKeywords.join(', ')}
- Generate optimized title (50-60 chars)
- Generate meta description (150-160 chars)
- Include OpenGraph tags
- Add structured data if applicable

## Available Components
${availableComponents && availableComponents.length > 0
  ? availableComponents.map(c => `- ${c}`).join('\n')
  : 'Standard components: Hero, ServiceGrid, ContactForm, Testimonials, CallToAction'
}

## Requirements

### 1. Page Structure (page.tsx)
\`\`\`tsx
import { Metadata } from 'next';
import Hero from '@/components/Hero';
import ServiceGrid from '@/components/ServiceGrid';
// ... other imports

export const metadata: Metadata = {
  title: 'Page Title | Site Name',
  description: 'Compelling description...',
  keywords: [${route.seoKeywords.map((k: string) => `'${k}'`).join(', ')}],
  openGraph: {
    title: '...',
    description: '...',
    type: 'website',
  },
};

export default function ${this.toPascalCase(route.name)}Page() {
  return (
    <>
      <Hero {...} />
      <ServiceGrid {...} />
      {/* More sections */}
    </>
  );
}
\`\`\`

### 2. Component Composition
- Map each section to an appropriate component
- Pass proper props to each component
- Use semantic HTML structure
- Maintain heading hierarchy (h1 → h2 → h3)
- Add ARIA landmarks

### 3. Data Fetching (if needed)
${route.contentType === 'dynamic' ? `
This is a dynamic page. Include data fetching:
\`\`\`tsx
async function getData() {
  const res = await fetch('...', {
    cache: 'force-cache', // or 'no-store' for real-time
    next: { revalidate: 3600 } // revalidate every hour
  });
  return res.json();
}

export default async function Page() {
  const data = await getData();
  // Use data in components
}
\`\`\`
` : 'This is a static page. No data fetching needed.'}

### 4. Breadcrumbs
${iaPlan.navigation.breadcrumbs ? `
Include breadcrumb navigation:
\`\`\`tsx
import Breadcrumbs from '@/components/Breadcrumbs';

// In page component:
<Breadcrumbs items={[
  { label: 'Home', href: '/' },
  { label: '${route.name}', href: '${route.path}' }
]} />
\`\`\`
` : 'Breadcrumbs not enabled for this site.'}

### 5. Loading State (loading.tsx) - Optional
If the page has data fetching, create a loading.tsx:
\`\`\`tsx
export default function Loading() {
  return <div>Loading...</div>;
}
\`\`\`

### 6. Error Boundary (error.tsx) - Optional
Create error.tsx for error handling:
\`\`\`tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}
\`\`\`

Generate the complete page following these specifications.
Return ONLY the JSON object with the page files.`;
  }

  /**
   * Convert string to PascalCase
   */
  private toPascalCase(str: string): string {
    return str
      .replace(/\W+(.)/g, (_, chr) => chr.toUpperCase())
      .replace(/^(.)/, (_, chr) => chr.toUpperCase());
  }

  /**
   * Parse page files from Claude's response
   */
  private async parsePageFiles(text: string, route: any): Promise<PageFiles> {
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

      // Ensure route matches
      if (!parsed.route) {
        parsed.route = route.path;
      }

      // Validate with schema
      return PageFilesSchema.parse(parsed);
    } catch (error: any) {
      console.error('Failed to parse PageFiles:', error);
      throw new Error(`Failed to parse PageFiles: ${error.message}`);
    }
  }

  /**
   * Validate page files
   */
  private async validatePageFiles(files: PageFiles): Promise<void> {
    // Ensure at least one page.tsx exists
    const pageFiles = files.files.filter(f => f.type === 'page');
    if (pageFiles.length === 0) {
      throw new Error('Page must have at least one page.tsx file');
    }

    // Ensure page file contains metadata
    const mainPage = pageFiles[0];
    if (!mainPage.content.includes('Metadata') && !mainPage.content.includes('metadata')) {
      console.warn(`Page ${files.route} may be missing metadata export`);
    }

    // Validate imports exist
    if (files.imports.length === 0) {
      console.warn(`Page ${files.route} has no component imports`);
    }

    // Ensure proper Next.js App Router file structure
    const expectedPath = `app${files.route === '/' ? '' : files.route}/page.tsx`;
    const hasCorrectPath = pageFiles.some(f => f.path === expectedPath);
    if (!hasCorrectPath) {
      console.warn(`Page file path may not follow Next.js conventions: expected ${expectedPath}`);
    }
  }

  /**
   * Store page files
   */
  private async storePage(pageFiles: PageFiles): Promise<Array<{ type: string; url: string; metadata?: any }>> {
    const artifacts = [];

    // Store page metadata as JSON
    const metadataJson = JSON.stringify(pageFiles, null, 2);
    const metadataKey = `${this.context.projectId}/pages/${pageFiles.route.replace(/\//g, '_')}/metadata.json`;

    artifacts.push({
      type: 'page-metadata',
      url: metadataKey,
      metadata: {
        route: pageFiles.route,
        fileCount: pageFiles.files.length,
        importCount: pageFiles.imports.length,
        hasDataFetching: pageFiles.dataFetching && pageFiles.dataFetching.length > 0,
      },
    });

    // Store each page file
    for (const file of pageFiles.files) {
      const fileKey = `${this.context.projectId}/build/${file.path}`;
      artifacts.push({
        type: 'page-file',
        url: fileKey,
        metadata: {
          route: pageFiles.route,
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
export const createPageAssemblerAgent = (context: ExtendedAgentContext) => new PageAssemblerAgent(context);

// packages/agents/build/scaffolder.ts
import { BaseAgent, ExtendedAgentContext } from '../shared/base-agent';
import { AgentManifest, AgentResult, AgentRole, AgentLayer } from '@business-automation/schema';
import { type SiteSpec, type DesignSpec } from '@business-automation/schema';
import { z } from 'zod';

/**
 * Scaffolder Agent Input Schema
 */
export const ScaffolderInputSchema = z.object({
  projectId: z.string(),
  siteSpecPath: z.string(), // Path to stored SiteSpec JSON
  designSpecPath: z.string(), // Path to stored DesignSpec JSON
});

export type ScaffolderInput = z.infer<typeof ScaffolderInputSchema>;

/**
 * Scaffolder Output Schema
 */
export const ScaffolderOutputSchema = z.object({
  version: z.literal('1.0'),
  projectRoot: z.string(),
  files: z.array(z.object({
    path: z.string(),
    content: z.string(),
    type: z.enum(['config', 'layout', 'globals', 'types', 'utility']),
  })),
  directories: z.array(z.string()),
});

export type ScaffolderOutput = z.infer<typeof ScaffolderOutputSchema>;

/**
 * Scaffolder Agent - Build Tier (Core)
 *
 * Generates the initial Next.js 16 project structure with:
 * - package.json with all dependencies
 * - TypeScript configuration
 * - Tailwind CSS configuration with design tokens
 * - Next.js configuration
 * - Root layout with metadata
 * - Global styles
 * - Basic directory structure
 *
 * This agent MUST run first in the Build tier (priority 100).
 * All other Build agents depend on the scaffolding it creates.
 */
export class ScaffolderAgent extends BaseAgent {
  static manifest: AgentManifest = {
    id: 'scaffolder',
    name: 'Scaffolder',
    version: '1.0.0',
    category: 'builder',
    tier: 'build',
    type: 'core',
    description: 'Generates Next.js 16 App Router project structure with Tailwind CSS design system',
    capabilities: [
      'Generate Next.js 16 configuration',
      'Set up Tailwind CSS v4 with design tokens',
      'Create TypeScript configuration',
      'Generate root layout and metadata',
      'Create directory structure',
    ],
    requiredEnvVars: [],
    mcpServers: ['filesystem'],
    dependencies: [], // No dependencies - runs first
    inputSchema: ScaffolderInputSchema,
    outputSchema: ScaffolderOutputSchema,
    sideEffects: ['writes-to-storage'],
    retryable: true,
    maxRetries: 2,
    maxTokens: 12000,
    temperature: 0.3, // Low temperature for consistent code generation
    systemPrompt: `You are the Scaffolder Agent for a Next.js 16 website generation system.
Your role is to generate the foundational project structure and configuration files.

You must:
1. Generate a package.json with Next.js 16, React 19, Tailwind CSS v4, and TypeScript
2. Create tsconfig.json with strict mode and path aliases
3. Generate tailwind.config.ts with design tokens from DesignSpec
4. Create next.config.ts with optimal production settings
5. Generate app/layout.tsx with proper metadata and font optimization
6. Create app/globals.css with Tailwind directives and custom properties
7. Set up directory structure for components, lib, types

Technical Requirements:
- Next.js 16 with App Router
- React 19
- TypeScript 5.7+ with strict mode
- Tailwind CSS v4 with JIT compiler
- next/font for Google Fonts optimization
- Proper SEO metadata in layout
- Responsive viewport settings
- Color scheme support (light/dark)`,
  };

  constructor(context: ExtendedAgentContext) {
    super(context, {
      enableMCP: true,
      mcpServers: ['filesystem'],
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.3,
      maxTokens: 12000,
    });
  }

  protected getAgentRole(): AgentRole {
    return 'builder';
  }

  protected getAgentLayer(): AgentLayer {
    return 'orchestrator';
  }

  /**
   * Execute the Scaffolder Agent
   */
  protected async execute(input: ScaffolderInput): Promise<AgentResult> {
    // Validate input
    ScaffolderInputSchema.parse(input);

    await this.logProgress('Loading specifications...', 10);

    // Load SiteSpec and DesignSpec
    const siteSpec = await this.loadSpec<SiteSpec>(input.siteSpecPath);
    const designSpec = await this.loadSpec<DesignSpec>(input.designSpecPath);

    await this.logProgress('Generating project structure...', 30);

    // Generate all scaffold files
    const output: ScaffolderOutput = {
      version: '1.0',
      projectRoot: `/projects/${this.context.projectId}`,
      files: [],
      directories: [
        'app',
        'components',
        'lib',
        'types',
        'public',
        'public/images',
        'public/fonts',
      ],
    };

    // Generate each file
    output.files.push(this.generatePackageJson(siteSpec));
    output.files.push(this.generateTSConfig());
    output.files.push(this.generateTailwindConfig(designSpec));
    output.files.push(this.generateNextConfig(siteSpec));
    output.files.push(this.generateRootLayout(siteSpec, designSpec));
    output.files.push(this.generateGlobalCSS(designSpec));
    output.files.push(this.generateEnvExample(siteSpec));
    output.files.push(this.generateGitignore());
    output.files.push(this.generateReadme(siteSpec));

    await this.logProgress('Writing files to storage...', 70);

    // Store files in storage
    const artifacts = await this.storeScaffold(output);

    await this.logProgress('Complete', 100);

    return {
      success: true,
      output,
      tokensUsed: 0, // Deterministic generation, no LLM calls
      cost: 0,
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
   * Generate package.json
   */
  private generatePackageJson(siteSpec: SiteSpec): any {
    const integrationDeps: Record<string, string> = {};

    // Add integration-specific dependencies
    for (const integration of siteSpec.integrations) {
      if (integration.service === 'sunlight') {
        integrationDeps['@sunlight/sdk'] = '^2.0.0';
      } else if (integration.service === 'eagleview') {
        integrationDeps['@eagleview/sdk'] = '^1.0.0';
      } else if (integration.service === 'companycam') {
        integrationDeps['@companycam/sdk'] = '^3.0.0';
      }
    }

    return {
      path: 'package.json',
      content: JSON.stringify(
        {
          name: siteSpec.projectId,
          version: '0.1.0',
          private: true,
          scripts: {
            dev: 'next dev',
            build: 'next build',
            start: 'next start',
            lint: 'next lint',
            'type-check': 'tsc --noEmit',
          },
          dependencies: {
            next: '^16.0.0',
            react: '^19.0.0',
            'react-dom': '^19.0.0',
            ...integrationDeps,
          },
          devDependencies: {
            '@types/node': '^20.11.19',
            '@types/react': '^19.0.0',
            '@types/react-dom': '^19.0.0',
            autoprefixer: '^10.4.17',
            eslint: '^8.57.0',
            'eslint-config-next': '^16.0.0',
            postcss: '^8.4.35',
            tailwindcss: '^4.0.0',
            typescript: '^5.7.2',
          },
          engines: {
            node: '>=20.0.0',
          },
        },
        null,
        2
      ),
      type: 'config' as const,
    };
  }

  /**
   * Generate tsconfig.json
   */
  private generateTSConfig(): any {
    return {
      path: 'tsconfig.json',
      content: JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2020',
            lib: ['dom', 'dom.iterable', 'esnext'],
            allowJs: true,
            skipLibCheck: true,
            strict: true,
            noEmit: true,
            esModuleInterop: true,
            module: 'esnext',
            moduleResolution: 'bundler',
            resolveJsonModule: true,
            isolatedModules: true,
            jsx: 'preserve',
            incremental: true,
            plugins: [
              {
                name: 'next',
              },
            ],
            paths: {
              '@/*': ['./*'],
              '@/components/*': ['./components/*'],
              '@/lib/*': ['./lib/*'],
              '@/types/*': ['./types/*'],
            },
          },
          include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
          exclude: ['node_modules'],
        },
        null,
        2
      ),
      type: 'config' as const,
    };
  }

  /**
   * Generate tailwind.config.ts with design tokens
   */
  private generateTailwindConfig(designSpec: DesignSpec): any {
    return {
      path: 'tailwind.config.ts',
      content: `import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: ${JSON.stringify(designSpec.tokens.colors, null, 6)},
      fontFamily: ${JSON.stringify(designSpec.tokens.typography.fonts, null, 6)},
      fontSize: ${JSON.stringify(designSpec.tokens.typography.sizes, null, 6)},
      fontWeight: ${JSON.stringify(designSpec.tokens.typography.weights, null, 6)},
      lineHeight: ${JSON.stringify(designSpec.tokens.typography.lineHeights, null, 6)},
      spacing: ${JSON.stringify(designSpec.tokens.spacing, null, 6)},
      screens: ${JSON.stringify(designSpec.tokens.breakpoints, null, 6)},
      boxShadow: ${JSON.stringify(designSpec.tokens.shadows, null, 6)},
      borderRadius: ${JSON.stringify(designSpec.tokens.radii, null, 6)},
      transitionProperty: ${JSON.stringify(designSpec.tokens.transitions, null, 6)},
    },
  },
  plugins: [],
};

export default config;
`,
      type: 'config' as const,
    };
  }

  /**
   * Generate next.config.ts
   */
  private generateNextConfig(siteSpec: SiteSpec): any {
    return {
      path: 'next.config.ts',
      content: `import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 768, 1024, 1280, 1536],
    imageSizes: [16, 32, 48, 64, 96],
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
`,
      type: 'config' as const,
    };
  }

  /**
   * Generate root app/layout.tsx
   */
  private generateRootLayout(siteSpec: SiteSpec, designSpec: DesignSpec): any {
    const defaultMeta = siteSpec.seo.defaultMeta;
    const primaryFont = Object.values(designSpec.tokens.typography.fonts)[0] || 'Inter';

    return {
      path: 'app/layout.tsx',
      content: `import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: ${JSON.stringify(defaultMeta.title || 'Welcome')},
  description: ${JSON.stringify(defaultMeta.description || '')},
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: ${JSON.stringify(defaultMeta.title || 'Welcome')},
  },
  twitter: {
    card: 'summary_large_image',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
`,
      type: 'layout' as const,
    };
  }

  /**
   * Generate app/globals.css
   */
  private generateGlobalCSS(designSpec: DesignSpec): any {
    return {
      path: 'app/globals.css',
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 0 0% 3.9%;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --background: 0 0% 3.9%;
      --foreground: 0 0% 98%;
    }
  }

  * {
    @apply border-neutral;
  }

  body {
    @apply bg-background text-foreground;
  }
}

@layer components {
  /* Custom component styles will go here */
}

@layer utilities {
  /* Custom utility classes will go here */
}
`,
      type: 'globals' as const,
    };
  }

  /**
   * Generate .env.example
   */
  private generateEnvExample(siteSpec: SiteSpec): any {
    const envVars = ['NEXT_PUBLIC_SITE_URL=https://yourdomain.com'];

    // Add integration env vars
    for (const integration of siteSpec.integrations) {
      if (integration.service === 'sunlight') {
        envVars.push('SUNLIGHT_API_KEY=your_api_key_here');
      } else if (integration.service === 'eagleview') {
        envVars.push('EAGLEVIEW_API_KEY=your_api_key_here');
      } else if (integration.service === 'companycam') {
        envVars.push('COMPANYCAM_API_KEY=your_api_key_here');
      }
    }

    return {
      path: '.env.example',
      content: envVars.join('\n') + '\n',
      type: 'config' as const,
    };
  }

  /**
   * Generate .gitignore
   */
  private generateGitignore(): any {
    return {
      path: '.gitignore',
      content: `# dependencies
node_modules
.pnp
.pnp.js

# testing
coverage

# next.js
.next/
out/
build
dist

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# typescript
*.tsbuildinfo
next-env.d.ts

# vercel
.vercel
`,
      type: 'config' as const,
    };
  }

  /**
   * Generate README.md
   */
  private generateReadme(siteSpec: SiteSpec): any {
    return {
      path: 'README.md',
      content: `# ${siteSpec.projectId}

This is a Next.js 16 project generated by the Business Automation System.

## Getting Started

First, install dependencies:

\`\`\`bash
npm install
# or
yarn install
# or
pnpm install
\`\`\`

Then, copy .env.example to .env.local and configure your environment variables:

\`\`\`bash
cp .env.example .env.local
\`\`\`

Finally, run the development server:

\`\`\`bash
npm run dev
# or
yarn dev
# or
pnpm dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

- \`app/\` - Next.js 16 App Router pages and layouts
- \`components/\` - Reusable React components
- \`lib/\` - Utility functions and shared logic
- \`types/\` - TypeScript type definitions
- \`public/\` - Static assets

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)

## Deploy

This project can be deployed to Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)
`,
      type: 'config' as const,
    };
  }

  /**
   * Store scaffold files in storage
   */
  private async storeScaffold(output: ScaffolderOutput): Promise<Array<{ type: string; url: string; metadata?: any }>> {
    const artifacts = [];

    // Store output as JSON
    const outputJson = JSON.stringify(output, null, 2);
    const outputKey = `${this.context.projectId}/build/scaffold-output.json`;

    artifacts.push({
      type: 'build-output',
      url: outputKey,
      metadata: {
        fileCount: output.files.length,
        dirCount: output.directories.length,
      },
    });

    // Store each generated file
    for (const file of output.files) {
      const fileKey = `${this.context.projectId}/build/${file.path}`;
      artifacts.push({
        type: 'generated-file',
        url: fileKey,
        metadata: {
          fileType: file.type,
          size: Buffer.byteLength(file.content, 'utf-8'),
        },
      });
    }

    return artifacts;
  }
}

// Export factory function
export const createScaffolderAgent = (context: ExtendedAgentContext) => new ScaffolderAgent(context);

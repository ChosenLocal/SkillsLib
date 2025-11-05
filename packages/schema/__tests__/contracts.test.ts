// packages/schema/__tests__/contracts.test.ts
import { describe, it, expect } from 'vitest';
import {
  // Strategy Tier
  SiteSpecSchema,
  DesignSpecSchema,
  IAPlanSchema,
  WorkQueueSchema,
  // Build Tier
  PageBlueprintSchema,
  ComponentFilesSchema,
  PageFilesSchema,
  // Quality Tier
  FindingsSchema,
  PatchesSchema,
  BuildReportSchema,
  DeployReportSchema,
  // Event Wrapper
  AgentMessageSchema,
} from '../src/contracts';

describe('Contract Schemas', () => {
  // ============================================================
  // TIER 1: Strategy & Planning Contracts
  // ============================================================

  describe('SiteSpecSchema', () => {
    it('should validate a complete SiteSpec', () => {
      const validSiteSpec = {
        version: '1.0' as const,
        projectId: 'proj_123',
        routes: [
          {
            path: '/',
            name: 'Home',
            purpose: 'Landing page',
            layout: 'default',
            sections: ['hero', 'services', 'cta'],
            seoKeywords: ['roofing', 'contractor'],
            contentType: 'static' as const,
          },
          {
            path: '/services',
            name: 'Services',
            purpose: 'Service offerings',
            layout: 'default',
            sections: ['header', 'service-grid'],
            seoKeywords: ['roofing services'],
            contentType: 'dynamic' as const,
          },
        ],
        layouts: [
          {
            id: 'default',
            name: 'Default Layout',
            regions: ['header', 'main', 'footer'] as const,
            responsive: true,
          },
        ],
        sections: [
          {
            id: 'hero',
            componentType: 'Hero',
            props: { variant: 'full' },
            contentNeeds: ['headline', 'subheadline', 'cta'],
          },
        ],
        componentSpecs: [
          {
            id: 'hero-1',
            type: 'Hero',
            variants: ['full', 'split'],
            props: { variant: 'full' },
            slots: ['media', 'content'],
          },
        ],
        seo: {
          defaultMeta: {
            title: 'Best Roofing Company',
            description: 'Professional roofing services',
          },
          routeOverrides: {
            '/services': {
              title: 'Our Services',
            },
          },
          structuredData: [{ '@type': 'Organization' }],
        },
        integrations: [
          {
            service: 'sunlight',
            config: { apiKey: 'test' },
            routes: ['/financing'],
          },
        ],
      };

      expect(() => SiteSpecSchema.parse(validSiteSpec)).not.toThrow();
    });

    it('should reject invalid version', () => {
      const invalid = {
        version: '2.0',
        projectId: 'proj_123',
        routes: [],
        layouts: [],
        sections: [],
        componentSpecs: [],
        seo: { defaultMeta: {}, routeOverrides: {}, structuredData: [] },
        integrations: [],
      };

      expect(() => SiteSpecSchema.parse(invalid)).toThrow();
    });

    it('should reject invalid contentType', () => {
      const invalid = {
        version: '1.0',
        projectId: 'proj_123',
        routes: [
          {
            path: '/',
            name: 'Home',
            purpose: 'Test',
            layout: 'default',
            sections: [],
            seoKeywords: [],
            contentType: 'invalid',
          },
        ],
        layouts: [],
        sections: [],
        componentSpecs: [],
        seo: { defaultMeta: {}, routeOverrides: {}, structuredData: [] },
        integrations: [],
      };

      expect(() => SiteSpecSchema.parse(invalid)).toThrow();
    });

    it('should require all required fields', () => {
      const invalid = {
        version: '1.0',
        projectId: 'proj_123',
        // Missing routes
      };

      expect(() => SiteSpecSchema.parse(invalid)).toThrow();
    });
  });

  describe('DesignSpecSchema', () => {
    it('should validate a complete DesignSpec', () => {
      const validDesignSpec = {
        version: '1.0' as const,
        tokens: {
          colors: {
            primary: '#3B82F6',
            secondary: '#10B981',
            neutral: '#6B7280',
          },
          typography: {
            fonts: {
              sans: 'Inter, system-ui, sans-serif',
              heading: 'Poppins, sans-serif',
            },
            sizes: {
              xs: '0.75rem',
              sm: '0.875rem',
              base: '1rem',
              lg: '1.125rem',
            },
            weights: {
              normal: 400,
              medium: 500,
              bold: 700,
            },
            lineHeights: {
              tight: '1.25',
              normal: '1.5',
              loose: '2',
            },
          },
          spacing: {
            '0': '0',
            '1': '0.25rem',
            '2': '0.5rem',
            '4': '1rem',
          },
          breakpoints: {
            sm: '640px',
            md: '768px',
            lg: '1024px',
          },
          shadows: {
            sm: '0 1px 2px rgba(0,0,0,0.05)',
            md: '0 4px 6px rgba(0,0,0,0.1)',
          },
          radii: {
            none: '0',
            sm: '0.125rem',
            md: '0.375rem',
          },
          transitions: {
            all: 'all 0.3s ease',
            colors: 'colors 0.3s ease',
          },
        },
        grid: {
          columns: 12,
          gap: '1rem',
          maxWidth: '1280px',
        },
        motion: {
          durations: {
            fast: 150,
            normal: 300,
            slow: 500,
          },
          easings: {
            linear: 'linear',
            easeIn: 'ease-in',
            easeOut: 'ease-out',
          },
        },
        componentVariants: {
          Button: ['primary', 'secondary', 'outline'],
          Card: ['default', 'elevated'],
        },
      };

      expect(() => DesignSpecSchema.parse(validDesignSpec)).not.toThrow();
    });

    it('should require numeric weights', () => {
      const invalid = {
        version: '1.0',
        tokens: {
          colors: {},
          typography: {
            fonts: { sans: 'Inter' },
            sizes: { base: '1rem' },
            weights: { normal: '400' }, // Should be number
            lineHeights: { normal: '1.5' },
          },
          spacing: {},
          breakpoints: {},
          shadows: {},
          radii: {},
          transitions: {},
        },
        grid: { columns: 12, gap: '1rem', maxWidth: '1280px' },
        motion: { durations: {}, easings: {} },
        componentVariants: {},
      };

      expect(() => DesignSpecSchema.parse(invalid)).toThrow();
    });
  });

  describe('IAPlanSchema', () => {
    it('should validate a complete IAPlan', () => {
      const validIAPlan = {
        version: '1.0' as const,
        sitemap: {
          root: '/',
          children: [
            {
              route: '/services',
              label: 'Services',
              children: [
                {
                  route: '/services/roofing',
                  label: 'Roofing',
                },
              ],
            },
            {
              route: '/about',
              label: 'About',
            },
          ],
        },
        navigation: {
          primary: [
            {
              route: '/',
              label: 'Home',
            },
            {
              route: '/services',
              label: 'Services',
              children: [
                {
                  route: '/services/roofing',
                  label: 'Roofing',
                },
              ],
            },
          ],
          footer: [
            {
              section: 'Company',
              links: [
                {
                  route: '/about',
                  label: 'About Us',
                },
              ],
            },
          ],
          breadcrumbs: true,
        },
        internalLinks: [
          {
            fromRoute: '/',
            toRoute: '/services',
            anchorText: 'View our services',
            context: 'CTA in hero section',
          },
        ],
      };

      expect(() => IAPlanSchema.parse(validIAPlan)).not.toThrow();
    });

    it('should support nested navigation children', () => {
      const validNested = {
        version: '1.0' as const,
        sitemap: {
          root: '/',
          children: [
            {
              route: '/parent',
              label: 'Parent',
              children: [
                {
                  route: '/parent/child',
                  label: 'Child',
                  children: [
                    {
                      route: '/parent/child/grandchild',
                      label: 'Grandchild',
                    },
                  ],
                },
              ],
            },
          ],
        },
        navigation: {
          primary: [],
          footer: [],
          breadcrumbs: false,
        },
        internalLinks: [],
      };

      expect(() => IAPlanSchema.parse(validNested)).not.toThrow();
    });
  });

  describe('WorkQueueSchema', () => {
    it('should validate a complete WorkQueue', () => {
      const validWorkQueue = {
        version: '1.0' as const,
        tasks: [
          {
            id: 'task-1',
            type: 'component' as const,
            agentId: 'component-worker',
            priority: 90,
            dependencies: [],
            budget: {
              tokens: 4000,
              timeMs: 30000,
              retries: 2,
            },
            input: { componentType: 'Hero' },
          },
          {
            id: 'task-2',
            type: 'page' as const,
            agentId: 'page-assembler',
            priority: 70,
            dependencies: ['task-1'],
            budget: {
              tokens: 6000,
              timeMs: 45000,
              retries: 3,
            },
            input: { route: '/' },
          },
        ],
      };

      expect(() => WorkQueueSchema.parse(validWorkQueue)).not.toThrow();
    });

    it('should validate all task types', () => {
      const types = ['component', 'page', 'integration', 'content', 'media'];

      types.forEach((type) => {
        const queue = {
          version: '1.0' as const,
          tasks: [
            {
              id: 'task-1',
              type: type as any,
              agentId: 'test-agent',
              priority: 50,
              dependencies: [],
              budget: {
                tokens: 1000,
                timeMs: 10000,
                retries: 1,
              },
              input: {},
            },
          ],
        };

        expect(() => WorkQueueSchema.parse(queue)).not.toThrow();
      });
    });

    it('should reject invalid task types', () => {
      const invalid = {
        version: '1.0',
        tasks: [
          {
            id: 'task-1',
            type: 'invalid-type',
            agentId: 'test-agent',
            priority: 50,
            dependencies: [],
            budget: { tokens: 1000, timeMs: 10000, retries: 1 },
            input: {},
          },
        ],
      };

      expect(() => WorkQueueSchema.parse(invalid)).toThrow();
    });
  });

  // ============================================================
  // TIER 2: Build Contracts
  // ============================================================

  describe('PageBlueprintSchema', () => {
    it('should validate a complete PageBlueprint', () => {
      const validPageBlueprint = {
        version: '1.0' as const,
        route: '/',
        layout: 'default',
        sections: [
          {
            id: 'hero',
            component: 'Hero',
            props: { variant: 'full' },
            contentNeeds: [
              {
                type: 'headline' as const,
                requirements: 'Catchy headline about roofing',
                seoOptimized: true,
              },
              {
                type: 'cta' as const,
                requirements: 'Button text for quote request',
                seoOptimized: false,
              },
            ],
            position: 1,
          },
        ],
        metadata: {
          title: 'Home | Best Roofing',
          description: 'Professional roofing services',
          openGraph: {
            image: '/og-image.jpg',
          },
        },
      };

      expect(() => PageBlueprintSchema.parse(validPageBlueprint)).not.toThrow();
    });

    it('should validate all content need types', () => {
      const types = ['headline', 'body', 'cta', 'image', 'video'];

      types.forEach((type) => {
        const blueprint = {
          version: '1.0' as const,
          route: '/test',
          layout: 'default',
          sections: [
            {
              id: 'section-1',
              component: 'TestComponent',
              props: {},
              contentNeeds: [
                {
                  type: type as any,
                  requirements: 'Test requirement',
                  seoOptimized: true,
                },
              ],
              position: 1,
            },
          ],
          metadata: {
            title: 'Test',
            description: 'Test',
          },
        };

        expect(() => PageBlueprintSchema.parse(blueprint)).not.toThrow();
      });
    });
  });

  describe('ComponentFilesSchema', () => {
    it('should validate ComponentFiles', () => {
      const validComponentFiles = {
        version: '1.0' as const,
        componentId: 'hero-component',
        files: [
          {
            path: 'components/Hero.tsx',
            content: 'export default function Hero() {}',
            type: 'tsx' as const,
          },
          {
            path: 'components/Hero.test.tsx',
            content: 'test("renders", () => {})',
            type: 'test' as const,
          },
        ],
        exports: [
          {
            name: 'Hero',
            isDefault: true,
          },
        ],
        dependencies: ['react', 'next/image'],
        props: 'interface HeroProps { title: string; }',
      };

      expect(() => ComponentFilesSchema.parse(validComponentFiles)).not.toThrow();
    });

    it('should validate all file types', () => {
      const types = ['tsx', 'css', 'test', 'story'];

      types.forEach((type) => {
        const files = {
          version: '1.0' as const,
          componentId: 'test',
          files: [
            {
              path: `test.${type}`,
              content: 'content',
              type: type as any,
            },
          ],
          exports: [],
          dependencies: [],
          props: {},
        };

        expect(() => ComponentFilesSchema.parse(files)).not.toThrow();
      });
    });
  });

  describe('PageFilesSchema', () => {
    it('should validate PageFiles', () => {
      const validPageFiles = {
        version: '1.0' as const,
        route: '/',
        files: [
          {
            path: 'app/page.tsx',
            content: 'export default function Page() {}',
            type: 'page' as const,
          },
          {
            path: 'app/layout.tsx',
            content: 'export default function Layout() {}',
            type: 'layout' as const,
          },
        ],
        imports: ['@/components/Hero', 'next/image'],
        dataFetching: [
          {
            source: 'api',
            method: 'GET',
            cache: 'force-cache',
          },
        ],
      };

      expect(() => PageFilesSchema.parse(validPageFiles)).not.toThrow();
    });

    it('should allow optional dataFetching', () => {
      const valid = {
        version: '1.0' as const,
        route: '/static',
        files: [],
        imports: [],
        // dataFetching omitted
      };

      expect(() => PageFilesSchema.parse(valid)).not.toThrow();
    });
  });

  // ============================================================
  // TIER 3: Quality & Deploy Contracts
  // ============================================================

  describe('FindingsSchema', () => {
    it('should validate Findings', () => {
      const validFindings = {
        version: '1.0' as const,
        agentId: 'static-analyzer',
        findings: [
          {
            id: 'finding-1',
            severity: 'high' as const,
            ruleId: 'TS001',
            ruleName: 'Type Error',
            location: {
              file: 'components/Hero.tsx',
              line: 42,
              column: 12,
            },
            message: 'Type string is not assignable to number',
            suggestion: 'Change type to number',
            autoFixable: true,
            estimatedCost: 5,
            references: ['https://typescript.com/docs'],
          },
        ],
        summary: {
          total: 1,
          bySeverity: {
            high: 1,
          },
          autoFixable: 1,
          estimatedTotalCost: 5,
        },
      };

      expect(() => FindingsSchema.parse(validFindings)).not.toThrow();
    });

    it('should validate all severity levels', () => {
      const severities = ['critical', 'high', 'medium', 'low', 'info'];

      severities.forEach((severity) => {
        const findings = {
          version: '1.0' as const,
          agentId: 'test',
          findings: [
            {
              id: 'f1',
              severity: severity as any,
              ruleId: 'R1',
              ruleName: 'Test Rule',
              location: {},
              message: 'Test',
              autoFixable: false,
              estimatedCost: 1,
            },
          ],
          summary: {
            total: 1,
            bySeverity: {},
            autoFixable: 0,
            estimatedTotalCost: 1,
          },
        };

        expect(() => FindingsSchema.parse(findings)).not.toThrow();
      });
    });
  });

  describe('PatchesSchema', () => {
    it('should validate Patches', () => {
      const validPatches = {
        version: '1.0' as const,
        patches: [
          {
            id: 'patch-1',
            findingId: 'finding-1',
            type: 'replace' as const,
            file: 'components/Hero.tsx',
            diff: '--- a/file\n+++ b/file\n...',
            appliedAt: '2024-01-01T00:00:00Z',
            status: 'applied' as const,
          },
        ],
        budget: {
          used: 50,
          limit: 200,
          remaining: 150,
        },
        summary: {
          totalPatches: 1,
          applied: 1,
          failed: 0,
          skipped: 0,
        },
      };

      expect(() => PatchesSchema.parse(validPatches)).not.toThrow();
    });

    it('should validate all patch types', () => {
      const types = ['insert', 'replace', 'delete'];

      types.forEach((type) => {
        const patches = {
          version: '1.0' as const,
          patches: [
            {
              id: 'p1',
              findingId: 'f1',
              type: type as any,
              file: 'test.ts',
              diff: 'diff',
              status: 'pending' as const,
            },
          ],
          budget: { used: 0, limit: 100, remaining: 100 },
          summary: { totalPatches: 1, applied: 0, failed: 0, skipped: 0 },
        };

        expect(() => PatchesSchema.parse(patches)).not.toThrow();
      });
    });

    it('should validate all patch statuses', () => {
      const statuses = ['pending', 'applied', 'failed', 'skipped'];

      statuses.forEach((status) => {
        const patches = {
          version: '1.0' as const,
          patches: [
            {
              id: 'p1',
              findingId: 'f1',
              type: 'replace' as const,
              file: 'test.ts',
              diff: 'diff',
              status: status as any,
            },
          ],
          budget: { used: 0, limit: 100, remaining: 100 },
          summary: { totalPatches: 1, applied: 0, failed: 0, skipped: 0 },
        };

        expect(() => PatchesSchema.parse(patches)).not.toThrow();
      });
    });
  });

  describe('BuildReportSchema', () => {
    it('should validate BuildReport', () => {
      const validBuildReport = {
        version: '1.0' as const,
        static: {
          typeErrors: [],
          lintErrors: [],
          buildErrors: [],
          bundleSize: {
            total: 500000,
            byRoute: {
              '/': 250000,
              '/about': 150000,
            },
            byChunk: {
              main: 300000,
              vendors: 200000,
            },
          },
          treemap: 'https://example.com/treemap.html',
        },
        runtime: {
          lighthouse: {
            performance: 95,
            accessibility: 98,
            bestPractices: 100,
            seo: 97,
          },
          coreWebVitals: {
            lcp: 1200,
            fid: 50,
            cls: 0.05,
            ttfb: 400,
          },
        },
      };

      expect(() => BuildReportSchema.parse(validBuildReport)).not.toThrow();
    });

    it('should allow optional runtime metrics', () => {
      const valid = {
        version: '1.0' as const,
        static: {
          typeErrors: [],
          lintErrors: [],
          buildErrors: [],
          bundleSize: {
            total: 100000,
            byRoute: {},
            byChunk: {},
          },
        },
        runtime: {
          // lighthouse omitted
          // coreWebVitals omitted
        },
      };

      expect(() => BuildReportSchema.parse(valid)).not.toThrow();
    });
  });

  describe('DeployReportSchema', () => {
    it('should validate DeployReport', () => {
      const validDeployReport = {
        version: '1.0' as const,
        environment: 'production' as const,
        provider: 'vercel',
        urls: {
          main: 'https://example.com',
          preview: 'https://preview.example.com',
          api: 'https://api.example.com',
        },
        deployment: {
          id: 'deploy-123',
          status: 'ready' as const,
          startedAt: '2024-01-01T00:00:00Z',
          completedAt: '2024-01-01T00:05:00Z',
          duration: 300000,
        },
        checks: [
          {
            name: 'Build',
            status: 'completed' as const,
            conclusion: 'success' as const,
            output: { exitCode: 0 },
          },
        ],
        rollback: {
          available: true,
          previousDeploymentId: 'deploy-122',
        },
      };

      expect(() => DeployReportSchema.parse(validDeployReport)).not.toThrow();
    });

    it('should validate both environments', () => {
      ['preview', 'production'].forEach((env) => {
        const report = {
          version: '1.0' as const,
          environment: env as any,
          provider: 'vercel',
          urls: { main: 'https://example.com' },
          deployment: {
            id: 'd1',
            status: 'ready' as const,
            startedAt: '2024-01-01T00:00:00Z',
          },
          checks: [],
          rollback: { available: false },
        };

        expect(() => DeployReportSchema.parse(report)).not.toThrow();
      });
    });

    it('should validate all deployment statuses', () => {
      const statuses = ['pending', 'building', 'ready', 'error', 'canceled'];

      statuses.forEach((status) => {
        const report = {
          version: '1.0' as const,
          environment: 'preview' as const,
          provider: 'vercel',
          urls: { main: 'https://example.com' },
          deployment: {
            id: 'd1',
            status: status as any,
            startedAt: '2024-01-01T00:00:00Z',
          },
          checks: [],
          rollback: { available: false },
        };

        expect(() => DeployReportSchema.parse(report)).not.toThrow();
      });
    });
  });

  // ============================================================
  // Event Message Wrapper
  // ============================================================

  describe('AgentMessageSchema', () => {
    it('should validate AgentMessage', () => {
      const validMessage = {
        eventType: 'agent.completed',
        projectId: 'proj_123',
        runId: 'run_456',
        agentId: 'planner',
        timestamp: '2024-01-01T00:00:00Z',
        schemaVersion: '1.0',
        payload: { output: 'test' },
        metadata: {
          phase: 'plan' as const,
          iteration: 1,
          parentMessageId: 'msg_000',
          traceId: 'trace_789',
        },
      };

      expect(() => AgentMessageSchema.parse(validMessage)).not.toThrow();
    });

    it('should validate all phases', () => {
      const phases = ['plan', 'synthesize', 'validate', 'deploy'];

      phases.forEach((phase) => {
        const message = {
          eventType: 'agent.started',
          projectId: 'p1',
          runId: 'r1',
          agentId: 'test',
          timestamp: '2024-01-01T00:00:00Z',
          schemaVersion: '1.0',
          payload: {},
          metadata: {
            phase: phase as any,
            traceId: 't1',
          },
        };

        expect(() => AgentMessageSchema.parse(message)).not.toThrow();
      });
    });

    it('should allow optional iteration and parentMessageId', () => {
      const valid = {
        eventType: 'agent.started',
        projectId: 'p1',
        runId: 'r1',
        agentId: 'test',
        timestamp: '2024-01-01T00:00:00Z',
        schemaVersion: '1.0',
        payload: {},
        metadata: {
          phase: 'plan' as const,
          traceId: 't1',
          // iteration and parentMessageId omitted
        },
      };

      expect(() => AgentMessageSchema.parse(valid)).not.toThrow();
    });
  });
});

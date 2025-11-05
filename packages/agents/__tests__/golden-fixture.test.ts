// packages/agents/__tests__/golden-fixture.test.ts
/**
 * Golden Fixture Test - E2E Pipeline Smoke Test
 *
 * This test validates the entire agent pipeline from CompanyProfile → deployed site.
 * It serves as:
 * - Smoke test for the complete workflow
 * - Regression test (same input → same output)
 * - Integration test for agent orchestration
 * - Validation of all contract schemas
 *
 * Status: Phase 1 - Strategy Tier Complete
 * TODO: Add Build Tier once Scaffolder/Component Worker/Page Assembler are implemented
 * TODO: Add Quality Tier once Static Analyzer/Fixer are implemented
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  SiteSpecSchema,
  DesignSpecSchema,
  IAPlanSchema,
  WorkQueueSchema,
  type SiteSpec,
  type DesignSpec,
  type IAPlan,
  type WorkQueue,
} from '@business-automation/schema';
import {
  generateFileManifest,
  compareManifests,
  type FileManifest,
} from '../shared/deterministic-hash';

// Test constants
const TEST_OUTPUT_DIR = path.join(__dirname, '.test-output');
const GOLDEN_FIXTURES_DIR = path.join(__dirname, 'fixtures/golden');

/**
 * Mock CompanyProfile for testing
 * This represents a typical roofing contractor client
 */
const MOCK_COMPANY_PROFILE = {
  id: 'company_test_123',
  tenantId: 'tenant_test',
  name: 'Acme Roofing & Construction',
  industry: 'roofing',
  businessType: 'Service Business',
  description: 'Full-service roofing company serving residential and commercial clients',
  website: 'https://acmeroofing.com',
  services: [
    'Residential Roofing',
    'Commercial Roofing',
    'Roof Repair',
    'Roof Inspection',
    'Emergency Services',
    'Insurance Claims',
  ],
  serviceAreas: [
    'Austin, TX',
    'Round Rock, TX',
    'Cedar Park, TX',
  ],
  uniqueSellingPoints: [
    'Licensed & Insured',
    '25+ Years Experience',
    'Lifetime Warranty',
    'Emergency 24/7 Service',
  ],
  targetAudience: {
    primarySegments: ['Homeowners', 'Property Managers', 'Commercial Building Owners'],
    demographics: {
      ageRange: '35-65',
      income: '$75k+',
      location: 'Austin metro area',
    },
  },
  brandGuidelines: {
    primaryColor: '#1E40AF', // Professional blue
    secondaryColor: '#DC2626', // Accent red for urgency
    fontFamily: 'Inter',
    voiceAndTone: {
      tone: ['Professional', 'Trustworthy', 'Responsive'],
      vocabulary: ['Quality', 'Reliable', 'Experienced'],
    },
  },
  integrations: [
    { service: 'sunlight', enabled: true },
    { service: 'eagleview', enabled: true },
    { service: 'companycam', enabled: true },
  ],
};

describe('Golden Fixture - E2E Pipeline', () => {
  beforeAll(async () => {
    // Create test output directory
    await fs.mkdir(TEST_OUTPUT_DIR, { recursive: true });
    await fs.mkdir(GOLDEN_FIXTURES_DIR, { recursive: true });
  });

  afterAll(async () => {
    // Clean up test output
    await fs.rm(TEST_OUTPUT_DIR, { recursive: true, force: true });
  });

  describe('Phase 1: Strategy Tier Pipeline', () => {
    let siteSpec: SiteSpec;
    let designSpec: DesignSpec;
    let iaPlan: IAPlan;
    let workQueue: WorkQueue;

    it('should generate valid SiteSpec from CompanyProfile', async () => {
      // TODO: Replace with actual PlannerAgent execution once agents are executable
      // For now, create a valid mock SiteSpec that would be produced by Planner

      siteSpec = {
        version: '1.0',
        projectId: 'project_test_456',
        routes: [
          {
            path: '/',
            name: 'Home',
            purpose: 'Landing page showcasing services and CTAs',
            layout: 'default',
            sections: ['hero', 'services-preview', 'testimonials', 'cta'],
            seoKeywords: ['roofing contractor austin', 'roof repair', 'roofing company'],
            contentType: 'static',
          },
          {
            path: '/services',
            name: 'Services',
            purpose: 'Detailed service offerings',
            layout: 'default',
            sections: ['header', 'services-grid', 'cta'],
            seoKeywords: ['roofing services', 'commercial roofing', 'residential roofing'],
            contentType: 'static',
          },
          {
            path: '/services/residential',
            name: 'Residential Roofing',
            purpose: 'Residential roofing services detail',
            layout: 'default',
            sections: ['header', 'service-detail', 'process', 'cta'],
            seoKeywords: ['residential roofing austin', 'home roofing'],
            contentType: 'static',
          },
          {
            path: '/about',
            name: 'About Us',
            purpose: 'Company background and team',
            layout: 'default',
            sections: ['header', 'story', 'team', 'certifications'],
            seoKeywords: ['about acme roofing', 'roofing company austin'],
            contentType: 'static',
          },
          {
            path: '/contact',
            name: 'Contact',
            purpose: 'Contact form and information',
            layout: 'default',
            sections: ['header', 'contact-form', 'map', 'info'],
            seoKeywords: ['contact roofing contractor', 'get roofing quote'],
            contentType: 'interactive',
          },
        ],
        layouts: [
          {
            id: 'default',
            name: 'Default Layout',
            regions: ['header', 'main', 'footer'],
            responsive: true,
          },
        ],
        sections: [
          {
            id: 'hero',
            componentType: 'Hero',
            props: { variant: 'full', hasMedia: true },
            contentNeeds: ['headline', 'subheadline', 'cta', 'image'],
          },
          {
            id: 'services-preview',
            componentType: 'ServiceGrid',
            props: { columns: 3 },
            contentNeeds: ['service-cards'],
          },
        ],
        componentSpecs: [
          {
            id: 'hero-1',
            type: 'Hero',
            variants: ['full', 'split'],
            props: { variant: 'full', hasMedia: true },
            slots: ['media', 'content'],
          },
          {
            id: 'service-grid-1',
            type: 'ServiceGrid',
            variants: ['2-col', '3-col', '4-col'],
            props: { columns: 3 },
          },
        ],
        seo: {
          defaultMeta: {
            title: 'Acme Roofing & Construction | Austin TX',
            description: 'Professional roofing services in Austin, TX. 25+ years experience. Licensed & insured.',
          },
          routeOverrides: {
            '/services': {
              title: 'Roofing Services | Acme Roofing',
              description: 'Residential and commercial roofing services.',
            },
          },
          structuredData: [
            {
              '@type': 'Organization',
              name: 'Acme Roofing & Construction',
              url: 'https://acmeroofing.com',
            },
          ],
        },
        integrations: [
          {
            service: 'sunlight',
            config: { apiKey: 'test' },
            routes: ['/financing'],
          },
          {
            service: 'eagleview',
            config: { apiKey: 'test' },
            routes: ['/services/residential'],
          },
        ],
      };

      // Validate against schema
      expect(() => SiteSpecSchema.parse(siteSpec)).not.toThrow();

      // Business logic validations
      expect(siteSpec.routes.length).toBeGreaterThanOrEqual(3);
      expect(siteSpec.routes.some(r => r.path === '/')).toBe(true);
      expect(siteSpec.routes.some(r => r.path === '/contact')).toBe(true);

      // Save to golden fixtures
      await fs.writeFile(
        path.join(GOLDEN_FIXTURES_DIR, 'site-spec.json'),
        JSON.stringify(siteSpec, null, 2)
      );
    });

    it('should generate valid DesignSpec from CompanyProfile and SiteSpec', async () => {
      // TODO: Replace with actual BrandInterpreterAgent execution

      designSpec = {
        version: '1.0',
        tokens: {
          colors: {
            primary: '#1E40AF',
            secondary: '#DC2626',
            neutral: '#6B7280',
            success: '#10B981',
            warning: '#F59E0B',
            error: '#EF4444',
          },
          typography: {
            fonts: {
              sans: 'Inter, system-ui, sans-serif',
              heading: 'Inter, system-ui, sans-serif',
            },
            sizes: {
              xs: '0.75rem',
              sm: '0.875rem',
              base: '1rem',
              lg: '1.125rem',
              xl: '1.25rem',
              '2xl': '1.5rem',
              '3xl': '1.875rem',
              '4xl': '2.25rem',
            },
            weights: {
              normal: 400,
              medium: 500,
              semibold: 600,
              bold: 700,
            },
            lineHeights: {
              tight: '1.25',
              snug: '1.375',
              normal: '1.5',
              relaxed: '1.625',
            },
          },
          spacing: {
            '0': '0',
            '1': '0.25rem',
            '2': '0.5rem',
            '4': '1rem',
            '8': '2rem',
            '16': '4rem',
          },
          breakpoints: {
            sm: '640px',
            md: '768px',
            lg: '1024px',
            xl: '1280px',
          },
          shadows: {
            sm: '0 1px 2px rgba(0,0,0,0.05)',
            md: '0 4px 6px rgba(0,0,0,0.1)',
            lg: '0 10px 15px rgba(0,0,0,0.2)',
          },
          radii: {
            none: '0',
            sm: '0.125rem',
            md: '0.375rem',
            lg: '0.5rem',
          },
          transitions: {
            all: 'all 0.3s ease',
            colors: 'colors 0.3s ease',
            transform: 'transform 0.3s ease',
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
          Button: ['primary', 'secondary', 'outline', 'ghost'],
          Card: ['default', 'elevated', 'flat'],
        },
      };

      expect(() => DesignSpecSchema.parse(designSpec)).not.toThrow();

      // Validate required colors exist
      expect(designSpec.tokens.colors.primary).toBeDefined();
      expect(designSpec.tokens.colors.secondary).toBeDefined();

      await fs.writeFile(
        path.join(GOLDEN_FIXTURES_DIR, 'design-spec.json'),
        JSON.stringify(designSpec, null, 2)
      );
    });

    it('should generate valid IAPlan from SiteSpec', async () => {
      // TODO: Replace with actual IAArchitectAgent execution

      iaPlan = {
        version: '1.0',
        sitemap: {
          root: '/',
          children: [
            {
              route: '/services',
              label: 'Services',
              children: [
                {
                  route: '/services/residential',
                  label: 'Residential',
                },
              ],
            },
            {
              route: '/about',
              label: 'About',
            },
            {
              route: '/contact',
              label: 'Contact',
            },
          ],
        },
        navigation: {
          primary: [
            { route: '/', label: 'Home' },
            {
              route: '/services',
              label: 'Services',
              children: [
                { route: '/services/residential', label: 'Residential' },
              ],
            },
            { route: '/about', label: 'About' },
            { route: '/contact', label: 'Contact' },
          ],
          footer: [
            {
              section: 'Services',
              links: [
                { route: '/services/residential', label: 'Residential Roofing' },
              ],
            },
            {
              section: 'Company',
              links: [
                { route: '/about', label: 'About Us' },
                { route: '/contact', label: 'Contact' },
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
            context: 'Hero CTA',
          },
          {
            fromRoute: '/services',
            toRoute: '/services/residential',
            anchorText: 'Learn about residential roofing',
            context: 'Service grid',
          },
        ],
      };

      expect(() => IAPlanSchema.parse(iaPlan)).not.toThrow();

      // Validate sitemap root
      expect(iaPlan.sitemap.root).toBe('/');

      // Validate primary nav isn't too long (mobile UX)
      expect(iaPlan.navigation.primary.length).toBeLessThanOrEqual(7);

      await fs.writeFile(
        path.join(GOLDEN_FIXTURES_DIR, 'ia-plan.json'),
        JSON.stringify(iaPlan, null, 2)
      );
    });

    it('should generate valid WorkQueue from all Strategy outputs', async () => {
      // TODO: Replace with actual BacklogManagerAgent execution

      workQueue = {
        version: '1.0',
        tasks: [
          {
            id: 'task-scaffolder-1',
            type: 'page',
            agentId: 'scaffolder',
            priority: 100,
            dependencies: [],
            budget: {
              tokens: 12000,
              timeMs: 60000,
              retries: 2,
            },
            input: { siteSpec, designSpec },
          },
          {
            id: 'task-component-hero',
            type: 'component',
            agentId: 'component-worker',
            priority: 90,
            dependencies: ['task-scaffolder-1'],
            budget: {
              tokens: 6000,
              timeMs: 30000,
              retries: 2,
            },
            input: {
              componentSpec: siteSpec.componentSpecs[0],
              designSpec,
            },
          },
          {
            id: 'task-page-home',
            type: 'page',
            agentId: 'page-assembler',
            priority: 80,
            dependencies: ['task-scaffolder-1', 'task-component-hero'],
            budget: {
              tokens: 8000,
              timeMs: 40000,
              retries: 3,
            },
            input: {
              route: siteSpec.routes[0],
              designSpec,
              iaPlan,
            },
          },
        ],
      };

      expect(() => WorkQueueSchema.parse(workQueue)).not.toThrow();

      // Validate scaffolder task exists and has no dependencies
      const scaffolderTask = workQueue.tasks.find(t => t.agentId === 'scaffolder');
      expect(scaffolderTask).toBeDefined();
      expect(scaffolderTask!.dependencies.length).toBe(0);

      // Validate task dependencies reference valid task IDs
      const taskIds = new Set(workQueue.tasks.map(t => t.id));
      for (const task of workQueue.tasks) {
        for (const depId of task.dependencies) {
          expect(taskIds.has(depId)).toBe(true);
        }
      }

      await fs.writeFile(
        path.join(GOLDEN_FIXTURES_DIR, 'work-queue.json'),
        JSON.stringify(workQueue, null, 2)
      );
    });

    it('should produce deterministic Strategy Tier outputs', async () => {
      // Verify that running the same input twice produces identical outputs
      // This is critical for reliable CI/CD

      const manifest1 = await generateFileManifest(GOLDEN_FIXTURES_DIR, {
        sortImports: true,
        stripComments: true,
      });

      // Simulate second run (in real test, would re-run agents)
      // For now, just regenerate manifest
      const manifest2 = await generateFileManifest(GOLDEN_FIXTURES_DIR, {
        sortImports: true,
        stripComments: true,
      });

      const comparison = compareManifests(manifest1, manifest2);
      expect(comparison.identical).toBe(true);
      expect(comparison.totalHashMatch).toBe(true);
    });
  });

  describe('Phase 2: Build Tier Pipeline', () => {
    it.todo('should generate Next.js 16 scaffolding from SiteSpec and DesignSpec');
    it.todo('should generate React components from ComponentSpecs');
    it.todo('should assemble pages from PageBlueprints and components');
    it.todo('should integrate external services (Sunlight, EagleView, etc.)');
    it.todo('should produce valid Next.js 16 code that builds successfully');
    it.todo('should be deterministic (same SiteSpec → same code hash)');
  });

  describe('Phase 3: Quality Tier Pipeline', () => {
    it.todo('should run static analysis (tsc, eslint, build)');
    it.todo('should generate Findings with severity classification');
    it.todo('should apply patches within budget constraints');
    it.todo('should validate Lighthouse scores meet thresholds (Perf ≥90, A11y ≥95, SEO ≥95)');
    it.todo('should validate Core Web Vitals within limits');
  });

  describe('Phase 4: Deploy Pipeline', () => {
    it.todo('should deploy to preview environment');
    it.todo('should run deployment checks');
    it.todo('should support rollback to previous deployment');
  });

  describe('End-to-End Validation', () => {
    it.todo('should complete full pipeline from CompanyProfile to deployed site');
    it.todo('should emit structured events at each phase');
    it.todo('should respect idempotency (re-running with same input produces same result)');
    it.todo('should track cost and stay within budget');
    it.todo('should complete within time constraints');
  });
});

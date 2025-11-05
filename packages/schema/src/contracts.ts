// packages/schema/src/contracts.ts
import { z } from 'zod';

/**
 * Core contracts for agent communication
 * These define the stable interfaces between agent tiers
 */

// ============================================================
// TIER 1: Strategy & Planning Contracts
// ============================================================

// SiteSpec - Output from Planner, input to all Build agents
export const SiteSpecSchema = z.object({
  version: z.literal('1.0'),
  projectId: z.string(),
  routes: z.array(z.object({
    path: z.string(),
    name: z.string(),
    purpose: z.string(),
    layout: z.string(),
    sections: z.array(z.string()),
    seoKeywords: z.array(z.string()),
    contentType: z.enum(['static', 'dynamic', 'interactive']),
  })),
  layouts: z.array(z.object({
    id: z.string(),
    name: z.string(),
    regions: z.array(z.enum(['header', 'main', 'aside', 'footer'])),
    responsive: z.boolean(),
  })),
  sections: z.array(z.object({
    id: z.string(),
    componentType: z.string(),
    props: z.any(),
    contentNeeds: z.array(z.string()),
  })),
  componentSpecs: z.array(z.object({
    id: z.string(),
    type: z.string(),
    variants: z.array(z.string()),
    props: z.record(z.any()),
    slots: z.array(z.string()).optional(),
  })),
  seo: z.object({
    defaultMeta: z.record(z.string()),
    routeOverrides: z.record(z.record(z.string())),
    structuredData: z.array(z.any()),
  }),
  integrations: z.array(z.object({
    service: z.string(),
    config: z.any(),
    routes: z.array(z.string()),
  })),
});

// DesignSpec - Output from Brand Interpreter
export const DesignSpecSchema = z.object({
  version: z.literal('1.0'),
  tokens: z.object({
    colors: z.record(z.string()),
    typography: z.object({
      fonts: z.record(z.string()),
      sizes: z.record(z.string()),
      weights: z.record(z.number()),
      lineHeights: z.record(z.string()),
    }),
    spacing: z.record(z.string()),
    breakpoints: z.record(z.string()),
    shadows: z.record(z.string()),
    radii: z.record(z.string()),
    transitions: z.record(z.string()),
  }),
  grid: z.object({
    columns: z.number(),
    gap: z.string(),
    maxWidth: z.string(),
  }),
  motion: z.object({
    durations: z.record(z.number()),
    easings: z.record(z.string()),
  }),
  componentVariants: z.record(z.array(z.string())),
});

// IAPlan - Output from IA Architect
export const IAPlanSchema = z.object({
  version: z.literal('1.0'),
  sitemap: z.object({
    root: z.string(),
    children: z.array(z.lazy(() =>
      z.object({
        route: z.string(),
        label: z.string(),
        children: z.array(z.any()).optional(),
      })
    )),
  }),
  navigation: z.object({
    primary: z.array(z.object({
      route: z.string(),
      label: z.string(),
      children: z.array(z.any()).optional(),
    })),
    footer: z.array(z.object({
      section: z.string(),
      links: z.array(z.object({
        route: z.string(),
        label: z.string(),
      })),
    })),
    breadcrumbs: z.boolean(),
  }),
  internalLinks: z.array(z.object({
    fromRoute: z.string(),
    toRoute: z.string(),
    anchorText: z.string(),
    context: z.string(),
  })),
});

// WorkQueue - Output from Backlog Manager
export const WorkQueueSchema = z.object({
  version: z.literal('1.0'),
  tasks: z.array(z.object({
    id: z.string(),
    type: z.enum(['component', 'page', 'integration', 'content', 'media']),
    agentId: z.string(),
    priority: z.number(),
    dependencies: z.array(z.string()),
    budget: z.object({
      tokens: z.number(),
      timeMs: z.number(),
      retries: z.number(),
    }),
    input: z.any(),
  })),
});

// ============================================================
// TIER 2: Build Contracts
// ============================================================

// PageBlueprint - Output from Page Planner
export const PageBlueprintSchema = z.object({
  version: z.literal('1.0'),
  route: z.string(),
  layout: z.string(),
  sections: z.array(z.object({
    id: z.string(),
    component: z.string(),
    props: z.any(),
    contentNeeds: z.array(z.object({
      type: z.enum(['headline', 'body', 'cta', 'image', 'video']),
      requirements: z.string(),
      seoOptimized: z.boolean(),
    })),
    position: z.number(),
  })),
  metadata: z.object({
    title: z.string(),
    description: z.string(),
    openGraph: z.any().optional(),
  }),
});

// ComponentFiles - Output from Component Worker
export const ComponentFilesSchema = z.object({
  version: z.literal('1.0'),
  componentId: z.string(),
  files: z.array(z.object({
    path: z.string(),
    content: z.string(),
    type: z.enum(['tsx', 'css', 'test', 'story']),
  })),
  exports: z.array(z.object({
    name: z.string(),
    isDefault: z.boolean(),
  })),
  dependencies: z.array(z.string()),
  props: z.any(), // TypeScript interface as string
});

// PageFiles - Output from Page Assembler
export const PageFilesSchema = z.object({
  version: z.literal('1.0'),
  route: z.string(),
  files: z.array(z.object({
    path: z.string(),
    content: z.string(),
    type: z.enum(['page', 'layout', 'loading', 'error', 'route']),
  })),
  imports: z.array(z.string()),
  dataFetching: z.array(z.object({
    source: z.string(),
    method: z.string(),
    cache: z.string().optional(),
  })).optional(),
});

// ============================================================
// TIER 3: Quality & Deploy Contracts
// ============================================================

// Findings - Output from all Grader agents
export const FindingsSchema = z.object({
  version: z.literal('1.0'),
  agentId: z.string(),
  findings: z.array(z.object({
    id: z.string(),
    severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
    ruleId: z.string(),
    ruleName: z.string(),
    location: z.object({
      file: z.string().optional(),
      line: z.number().optional(),
      column: z.number().optional(),
      route: z.string().optional(),
      section: z.string().optional(),
    }),
    message: z.string(),
    suggestion: z.string().optional(),
    autoFixable: z.boolean(),
    estimatedCost: z.number(), // in abstract units
    references: z.array(z.string()).optional(),
  })),
  summary: z.object({
    total: z.number(),
    bySeverity: z.record(z.number()),
    autoFixable: z.number(),
    estimatedTotalCost: z.number(),
  }),
});

// Patches - Output from Fixer agent
export const PatchesSchema = z.object({
  version: z.literal('1.0'),
  patches: z.array(z.object({
    id: z.string(),
    findingId: z.string(),
    type: z.enum(['insert', 'replace', 'delete']),
    file: z.string(),
    diff: z.string(), // unified diff format
    appliedAt: z.string().optional(),
    status: z.enum(['pending', 'applied', 'failed', 'skipped']),
    error: z.string().optional(),
  })),
  budget: z.object({
    used: z.number(),
    limit: z.number(),
    remaining: z.number(),
  }),
  summary: z.object({
    totalPatches: z.number(),
    applied: z.number(),
    failed: z.number(),
    skipped: z.number(),
  }),
});

// BuildReport - Output from Static Analyzer
export const BuildReportSchema = z.object({
  version: z.literal('1.0'),
  static: z.object({
    typeErrors: z.array(z.any()),
    lintErrors: z.array(z.any()),
    buildErrors: z.array(z.any()),
    bundleSize: z.object({
      total: z.number(),
      byRoute: z.record(z.number()),
      byChunk: z.record(z.number()),
    }),
    treemap: z.string().optional(), // URL to visualization
  }),
  runtime: z.object({
    lighthouse: z.object({
      performance: z.number(),
      accessibility: z.number(),
      bestPractices: z.number(),
      seo: z.number(),
    }).optional(),
    coreWebVitals: z.object({
      lcp: z.number(),
      fid: z.number(),
      cls: z.number(),
      ttfb: z.number(),
    }).optional(),
  }),
});

// DeployReport - Output from Deployer
export const DeployReportSchema = z.object({
  version: z.literal('1.0'),
  environment: z.enum(['preview', 'production']),
  provider: z.string(),
  urls: z.object({
    main: z.string(),
    preview: z.string().optional(),
    api: z.string().optional(),
  }),
  deployment: z.object({
    id: z.string(),
    status: z.enum(['pending', 'building', 'ready', 'error', 'canceled']),
    startedAt: z.string(),
    completedAt: z.string().optional(),
    duration: z.number().optional(),
  }),
  checks: z.array(z.object({
    name: z.string(),
    status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped']),
    conclusion: z.enum(['success', 'failure', 'neutral', 'canceled', 'skipped']).optional(),
    output: z.any().optional(),
  })),
  rollback: z.object({
    available: z.boolean(),
    previousDeploymentId: z.string().optional(),
  }),
});

// ============================================================
// Event Message Wrapper
// ============================================================

export const AgentMessageSchema = z.object({
  eventType: z.string(),
  projectId: z.string(),
  runId: z.string(),
  agentId: z.string(),
  timestamp: z.string(),
  schemaVersion: z.string(),
  payload: z.any(),
  metadata: z.object({
    phase: z.enum(['plan', 'synthesize', 'validate', 'deploy']),
    iteration: z.number().optional(),
    parentMessageId: z.string().optional(),
    traceId: z.string(),
  }),
});

// ============================================================
// Type exports
// ============================================================

export type SiteSpec = z.infer<typeof SiteSpecSchema>;
export type DesignSpec = z.infer<typeof DesignSpecSchema>;
export type IAPlan = z.infer<typeof IAPlanSchema>;
export type WorkQueue = z.infer<typeof WorkQueueSchema>;
export type PageBlueprint = z.infer<typeof PageBlueprintSchema>;
export type ComponentFiles = z.infer<typeof ComponentFilesSchema>;
export type PageFiles = z.infer<typeof PageFilesSchema>;
export type Findings = z.infer<typeof FindingsSchema>;
export type Patches = z.infer<typeof PatchesSchema>;
export type BuildReport = z.infer<typeof BuildReportSchema>;
export type DeployReport = z.infer<typeof DeployReportSchema>;
export type AgentMessage = z.infer<typeof AgentMessageSchema>;

// packages/schema/src/agents.ts
import { z } from 'zod';

// Base schemas for all agents
export const AgentRunSchema = z.object({
  runId: z.string().uuid(),
  projectId: z.string().uuid(),
  buildId: z.string().uuid().optional(),
  timestamp: z.string().datetime(),
  retryCount: z.number().default(0)
});

export const AgentErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
  details: z.any().optional()
});

export const AgentResultSchema = z.object({
  success: z.boolean(),
  duration: z.number(),
  artifacts: z.array(z.object({
    type: z.enum(['file', 'code', 'image', 'data']),
    url: z.string(),
    metadata: z.record(z.any())
  })),
  metrics: z.record(z.number()).optional(),
  nextSteps: z.array(z.string()).optional()
});

// Component-specific schemas
export const ComponentConfigSchema = z.object({
  name: z.string(),
  category: z.enum(['conversion', 'seo', 'operations', 'trust', 'performance', 'industry']),
  variant: z.enum(['minimal', 'standard', 'premium', 'custom']),
  props: z.record(z.any()),
  customization: z.object({
    colors: z.record(z.string()),
    typography: z.record(z.string()),
    spacing: z.record(z.string()),
    animations: z.boolean()
  }),
  position: z.object({
    page: z.string(),
    section: z.string(),
    order: z.number()
  })
});

// Grading schemas
export const GradeSchema = z.object({
  score: z.number().min(0).max(100),
  passed: z.boolean(),
  category: z.string(),
  issues: z.array(z.object({
    severity: z.enum(['critical', 'warning', 'info']),
    message: z.string(),
    element: z.string().optional(),
    remediation: z.string(),
    autoFixable: z.boolean()
  })),
  suggestions: z.array(z.string())
});

// Client schema (comprehensive)
export const ClientIndustryEnum = z.enum([
  'roofing', 'plumbing', 'auto', 'restoration', 
  'biohazard', 'adjuster', 'hvac', 'solar', 'electrical'
]);

export const ClientSchemaV2 = z.object({
  // Basic Information
  company: z.object({
    name: z.string(),
    legalName: z.string().optional(),
    dba: z.array(z.string()).optional(),
    industry: ClientIndustryEnum,
    subSpecialties: z.array(z.string()).optional(),
    established: z.string().optional(),
    size: z.enum(['solo', 'small', 'medium', 'large']).optional()
  }),
  
  // Brand Identity
  brand: z.object({
    logo: z.object({
      primary: z.string(), // S3/CDN URL
      variations: z.record(z.string()).optional(),
      usage: z.string().optional()
    }),
    colors: z.object({
      primary: z.string(),
      secondary: z.string().optional(),
      accent: z.string().optional(),
      semantic: z.record(z.string()).optional() // success, warning, etc.
    }),
    typography: z.object({
      headingFont: z.string().optional(),
      bodyFont: z.string().optional(),
      tone: z.enum(['professional', 'friendly', 'urgent', 'technical'])
    }),
    tagline: z.string().optional(),
    valueProps: z.array(z.string()),
    differentiators: z.array(z.string())
  }),
  
  // Contact & Location
  contact: z.object({
    phone: z.object({
      primary: z.string(),
      emergency: z.string().optional(),
      sms: z.string().optional()
    }),
    email: z.object({
      info: z.string(),
      support: z.string().optional(),
      sales: z.string().optional()
    }),
    address: z.object({
      street: z.string(),
      city: z.string(),
      state: z.string(),
      zip: z.string(),
      country: z.string().default('US')
    }),
    serviceAreas: z.array(z.object({
      city: z.string(),
      state: z.string(),
      zip: z.array(z.string()).optional(),
      radius: z.number().optional() // miles
    })),
    hours: z.object({
      regular: z.record(z.string()), // day -> hours
      emergency: z.boolean(),
      holidays: z.record(z.string()).optional()
    })
  }),
  
  // Services & Pricing
  services: z.object({
    primary: z.array(z.object({
      name: z.string(),
      description: z.string(),
      keywords: z.array(z.string()),
      priceRange: z.string().optional(),
      duration: z.string().optional()
    })),
    emergency: z.array(z.string()).optional(),
    seasonal: z.array(z.object({
      name: z.string(),
      months: z.array(z.number())
    })).optional()
  }),
  
  // Credentials & Trust
  credentials: z.object({
    licenses: z.array(z.object({
      type: z.string(),
      number: z.string(),
      state: z.string(),
      expiry: z.string().optional()
    })),
    insurance: z.object({
      liability: z.boolean(),
      bonded: z.boolean(),
      workersComp: z.boolean(),
      carriers: z.array(z.string()).optional()
    }),
    certifications: z.array(z.object({
      name: z.string(),
      issuer: z.string(),
      badge: z.string().optional(), // image URL
      verifyUrl: z.string().optional()
    })),
    associations: z.array(z.string()),
    awards: z.array(z.object({
      name: z.string(),
      year: z.number(),
      issuer: z.string()
    })).optional()
  }),
  
  // Team
  team: z.object({
    size: z.number(),
    keyMembers: z.array(z.object({
      name: z.string(),
      role: z.string(),
      bio: z.string().optional(),
      photo: z.string().optional(),
      certifications: z.array(z.string()).optional()
    })).optional(),
    languages: z.array(z.string()).default(['English'])
  }),
  
  // Marketing Preferences
  marketing: z.object({
    targetAudience: z.array(z.string()),
    competitors: z.array(z.string()).optional(),
    currentWebsite: z.string().optional(),
    socialMedia: z.record(z.string()).optional(), // platform -> URL
    reviewPlatforms: z.record(z.string()).optional(), // platform -> URL
    preferredKeywords: z.array(z.string()).optional(),
    campaigns: z.array(z.string()).optional(), // active campaigns
    budget: z.object({
      monthly: z.number().optional(),
      allocation: z.record(z.number()).optional() // channel -> percentage
    }).optional()
  }),
  
  // Integrations
  integrations: z.object({
    crm: z.object({
      platform: z.string().optional(),
      apiKey: z.string().optional(),
      syncFields: z.array(z.string()).optional()
    }).optional(),
    scheduling: z.object({
      platform: z.string().optional(),
      calendarId: z.string().optional()
    }).optional(),
    payments: z.object({
      processor: z.string().optional(),
      acceptedMethods: z.array(z.string())
    }).optional(),
    apis: z.array(z.object({
      name: z.string(),
      credentials: z.record(z.string()),
      enabled: z.boolean()
    })).optional()
  }),
  
  // Content Assets
  assets: z.object({
    photos: z.array(z.object({
      url: z.string(),
      type: z.enum(['team', 'work', 'equipment', 'location', 'certification']),
      caption: z.string().optional()
    })),
    videos: z.array(z.object({
      url: z.string(),
      title: z.string(),
      duration: z.number()
    })).optional(),
    documents: z.array(z.object({
      type: z.string(),
      url: z.string(),
      public: z.boolean()
    })).optional(),
    testimonials: z.array(z.object({
      client: z.string(),
      text: z.string(),
      rating: z.number(),
      date: z.string(),
      verified: z.boolean()
    }))
  })
});

export type ClientSchema = z.infer<typeof ClientSchemaV2>;
export type ComponentConfig = z.infer<typeof ComponentConfigSchema>;
export type Grade = z.infer<typeof GradeSchema>;
export type AgentRun = z.infer<typeof AgentRunSchema>;
export type AgentResult = z.infer<typeof AgentResultSchema>;

// Agent Manifest for registration
export interface AgentManifest {
  id: string;
  name: string;
  version: string;
  category: 'orchestrator' | 'planner' | 'builder' | 'grader' | 'monitor';
  tier: 'strategy' | 'build' | 'quality'; // Agent tier in the 3-tier architecture
  type: 'core' | 'ephemeral'; // Core = single instance, Ephemeral = many parallel instances
  description: string;
  capabilities: string[];
  requiredEnvVars: string[];
  mcpServers: string[];
  dependencies?: string[]; // Other agent IDs
  inputSchema: z.ZodSchema;
  outputSchema: z.ZodSchema;
  sideEffects: string[];
  retryable: boolean;
  maxRetries: number;
  timeout?: number; // milliseconds
  priority?: number; // execution priority
  maxTokens?: number; // Max tokens for Claude calls
  temperature?: number; // Temperature for Claude calls
  systemPrompt?: string; // System prompt for Claude
}

// Base Agent Class
export abstract class AgentBase {
  static manifest: AgentManifest;
  protected context: AgentContext;
  
  constructor(context: AgentContext) {
    this.context = context;
  }
  
  abstract execute(input: any): Promise<AgentResult>;
  
  protected async logProgress(message: string, percentage?: number) {
    await this.context.redis.hset(`run:${this.context.runId}`, {
      lastUpdate: new Date().toISOString(),
      message,
      progress: percentage || 0
    });
  }
  
  protected async saveArtifact(type: string, content: any, metadata?: Record<string, any>) {
    const key = `${this.context.projectId}/${this.context.runId}/${Date.now()}-${type}`;
    const url = await this.context.storage.upload(key, content);
    
    return {
      type,
      url,
      metadata: metadata || {}
    };
  }
  
  protected async callAgent(agentId: string, input: any): Promise<any> {
    return this.context.orchestrator.dispatch(agentId, input);
  }
}

// Agent Context passed to all agents
export interface AgentContext {
  runId: string;
  projectId: string;
  buildId?: string;
  clientSchema: ClientSchema;
  redis: any; // Redis client
  storage: any; // S3/R2 client
  prisma: any; // Prisma client
  orchestrator: any; // For calling other agents
  mcp: Map<string, any>; // MCP server connections
  config: Record<string, any>; // Environment config
}
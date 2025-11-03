import { z } from 'zod';

/**
 * Agent execution and orchestration schemas
 */

export const AgentLayerSchema = z.enum([
  'orchestrator',
  'discovery',
  'design',
  'content',
  'code',
  'quality',
]);

export const AgentStatusSchema = z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']);

export const AgentRoleSchema = z.enum([
  // Orchestrator
  'orchestrator',

  // Discovery Layer (8 agents)
  'business_requirements',
  'service_definition',
  'brand_identity',
  'seo_strategy',
  'content_asset',
  'legal_compliance',
  'technical_requirements',
  'discovery_validator',

  // Design & Branding Layer (10 agents)
  'color_palette',
  'typography',
  'layout_architecture',
  'component_design',
  'responsive_design',
  'animation',
  'image_selection',
  'icon_design',
  'brand_consistency',
  'accessibility',

  // Content Generation Layer (10 agents)
  'hero_copy',
  'service_description',
  'about_page',
  'blog_content',
  'faq',
  'testimonial',
  'meta_description',
  'schema_markup',
  'local_seo',
  'call_to_action',

  // Code Generation Layer (5 agents)
  'nextjs_scaffold',
  'component_code',
  'api_route',
  'styling',
  'integration',

  // Quality Grading Layer (5 agents)
  'performance_evaluator',
  'seo_evaluator',
  'accessibility_evaluator',
  'code_quality_evaluator',
  'content_quality_evaluator',
]);

// Agent Configuration Schema
export const AgentConfigSchema = z.object({
  role: AgentRoleSchema,
  layer: AgentLayerSchema,
  name: z.string(),
  description: z.string(),
  modelName: z.enum(['claude-4.5-sonnet', 'claude-4-opus', 'claude-haiku-4.0']),
  temperature: z.number().min(0).max(1).default(0.7),
  maxTokens: z.number().default(4096),
  systemPrompt: z.string(),
  tools: z.array(z.string()).optional(),
  mcpServers: z.array(z.string()).optional(),
  dependencies: z.array(AgentRoleSchema).optional(),
  retryConfig: z
    .object({
      maxRetries: z.number().default(3),
      backoffMs: z.number().default(1000),
      backoffMultiplier: z.number().default(2),
    })
    .optional(),
});

// Agent Execution Schema
export const AgentExecutionSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  projectId: z.string().uuid(),
  workflowExecutionId: z.string().uuid().optional(),

  // Agent Information
  agentName: z.string(),
  agentRole: AgentRoleSchema,
  layer: AgentLayerSchema,
  config: AgentConfigSchema,

  // Execution State
  status: AgentStatusSchema,
  iteration: z.number().default(1),

  // Input/Output
  input: z.record(z.any()),
  output: z.record(z.any()).optional(),
  error: z
    .object({
      message: z.string(),
      stack: z.string().optional(),
      code: z.string().optional(),
    })
    .optional(),

  // Evaluation (for quality grading agents)
  evaluation: z.any().optional(),

  // Performance Metrics
  executionTimeMs: z.number().optional(),
  tokensUsed: z.number().optional(),
  cost: z.number().optional(),

  // Tracing and Observability
  traceId: z.string().uuid().optional(),
  spanId: z.string().optional(),
  parentSpanId: z.string().optional(),

  // Metadata
  createdAt: z.date(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  metadata: z.record(z.any()).optional(),
});

// Agent Execution with Relations
export const AgentExecutionWithRelationsSchema = AgentExecutionSchema.extend({
  project: z.any().optional(),
  workflowExecution: z.any().optional(),
  childExecutions: z.array(z.lazy(() => AgentExecutionSchema)).optional(),
});

// Agent Event Schema (for event-driven communication)
export const AgentEventSchema = z.object({
  id: z.string().uuid(),
  type: z.enum([
    'agent.started',
    'agent.completed',
    'agent.failed',
    'agent.output',
    'agent.progress',
  ]),
  agentExecutionId: z.string().uuid(),
  agentRole: AgentRoleSchema,
  projectId: z.string().uuid(),
  tenantId: z.string().uuid(),
  payload: z.record(z.any()),
  timestamp: z.date(),
});

// Export types
export type AgentLayer = z.infer<typeof AgentLayerSchema>;
export type AgentStatus = z.infer<typeof AgentStatusSchema>;
export type AgentRole = z.infer<typeof AgentRoleSchema>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type AgentExecution = z.infer<typeof AgentExecutionSchema>;
export type AgentExecutionWithRelations = z.infer<typeof AgentExecutionWithRelationsSchema>;
export type AgentEvent = z.infer<typeof AgentEventSchema>;

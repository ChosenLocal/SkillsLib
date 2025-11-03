import { z } from 'zod';

/**
 * Workflow orchestration schemas
 */

export const WorkflowTypeSchema = z.enum([
  'website_generation',
  'content_generation',
  'seo_audit',
  'data_processing',
  'customer_service',
  'workflow_orchestration',
]);

export const WorkflowStatusSchema = z.enum([
  'queued',
  'running',
  'paused',
  'completed',
  'failed',
  'cancelled',
]);

export const WorkflowStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['agent', 'parallel', 'sequential', 'conditional', 'loop']),
  agentRole: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  condition: z.string().optional(),
  children: z.array(z.lazy(() => WorkflowStepSchema)).optional(),
});

// Workflow Definition Schema
export const WorkflowDefinitionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  type: WorkflowTypeSchema,
  version: z.string(),

  // Workflow Structure
  steps: z.array(WorkflowStepSchema),

  // Configuration
  config: z.object({
    maxRetries: z.number().default(3),
    timeout: z.number().optional(),
    parallelism: z.number().default(5),
    iterativeRefinement: z.boolean().default(true),
    maxIterations: z.number().default(3),
  }),

  // Metadata
  createdAt: z.date(),
  updatedAt: z.date(),
  isActive: z.boolean(),
  tags: z.array(z.string()),
});

// Workflow Execution Schema
export const WorkflowExecutionSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  projectId: z.string().uuid(),

  // Workflow Information
  workflowId: z.string().uuid(),
  workflowType: WorkflowTypeSchema,
  workflowVersion: z.string(),

  // Execution State
  status: WorkflowStatusSchema,
  currentStep: z.string().optional(),
  currentStepName: z.string().optional(),
  totalSteps: z.number(),
  completedSteps: z.number(),
  progressPercentage: z.number().min(0).max(100),

  // Agent Executions
  agentExecutions: z.array(z.string().uuid()),

  // Input/Output
  input: z.record(z.any()),
  output: z.record(z.any()).optional(),
  context: z.record(z.any()),

  // Error Handling
  error: z
    .object({
      message: z.string(),
      step: z.string(),
      stack: z.string().optional(),
    })
    .optional(),
  retryCount: z.number().default(0),

  // Iteration (for refinement)
  iteration: z.number().default(1),
  maxIterations: z.number().default(3),
  shouldContinueIteration: z.boolean(),

  // Performance Metrics
  executionTimeMs: z.number().optional(),
  totalCost: z.number().optional(),

  // Tracing
  traceId: z.string().uuid().optional(),

  // Metadata
  createdAt: z.date(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  pausedAt: z.date().optional(),
  metadata: z.record(z.any()).optional(),
});

// Workflow Execution with Relations
export const WorkflowExecutionWithRelationsSchema = WorkflowExecutionSchema.extend({
  project: z.any().optional(),
  workflowDefinition: z.any().optional(),
  agentExecutionDetails: z.array(z.any()).optional(),
});

// Workflow Event Schema
export const WorkflowEventSchema = z.object({
  id: z.string().uuid(),
  type: z.enum([
    'workflow.started',
    'workflow.step.started',
    'workflow.step.completed',
    'workflow.completed',
    'workflow.failed',
    'workflow.paused',
    'workflow.resumed',
  ]),
  workflowExecutionId: z.string().uuid(),
  workflowType: WorkflowTypeSchema,
  projectId: z.string().uuid(),
  tenantId: z.string().uuid(),
  payload: z.record(z.any()),
  timestamp: z.date(),
});

// Export types
export type WorkflowType = z.infer<typeof WorkflowTypeSchema>;
export type WorkflowStatus = z.infer<typeof WorkflowStatusSchema>;
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;
export type WorkflowExecution = z.infer<typeof WorkflowExecutionSchema>;
export type WorkflowExecutionWithRelations = z.infer<typeof WorkflowExecutionWithRelationsSchema>;
export type WorkflowEvent = z.infer<typeof WorkflowEventSchema>;

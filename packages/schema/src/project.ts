import { z } from 'zod';

/**
 * Project schema for tracking website generation and other automation projects
 */

export const ProjectStatusSchema = z.enum([
  'draft',
  'in_progress',
  'completed',
  'archived',
  'failed',
]);

export const ProjectTypeSchema = z.enum([
  'website',
  'content',
  'seo_audit',
  'workflow',
  'data_processing',
  'customer_service',
]);

// Discovery Data Schema
export const DiscoveryDataSchema = z.object({
  businessInfo: z.record(z.any()),
  services: z.record(z.any()),
  brandIdentity: z.record(z.any()),
  seoStrategy: z.record(z.any()),
  contentAssets: z.record(z.any()),
  legalCompliance: z.record(z.any()),
  technicalRequirements: z.record(z.any()),
  completeness: z.number().min(0).max(100),
});

// Generated Asset Schema
export const GeneratedAssetSchema = z.object({
  id: z.string().uuid(),
  type: z.enum([
    'page',
    'component',
    'content',
    'image',
    'style',
    'config',
    'documentation',
  ]),
  name: z.string(),
  path: z.string(),
  url: z.string().url().optional(),
  content: z.string().optional(),
  metadata: z.record(z.any()),
  agentId: z.string(),
  createdAt: z.date(),
});

// Quality Grade Schema
export const QualityGradeSchema = z.object({
  dimension: z.string(),
  score: z.number().min(0).max(1),
  grade: z.enum(['A', 'B', 'C', 'D', 'F']),
  passFailGrade: z.enum(['pass', 'fail']),
  issues: z.array(
    z.object({
      severity: z.enum(['critical', 'major', 'minor', 'info']),
      message: z.string(),
      location: z.string().optional(),
    })
  ),
  suggestions: z.array(
    z.object({
      priority: z.enum(['high', 'medium', 'low']),
      message: z.string(),
      context: z.string().optional(),
    })
  ),
  agentId: z.string(),
  evaluatedAt: z.date(),
});

// Website Evaluation Schema
export const WebsiteEvaluationSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  iteration: z.number(),
  overallScore: z.number().min(0).max(1),
  grades: z.array(QualityGradeSchema),
  shouldRefine: z.boolean(),
  refinementInstructions: z.array(z.string()),
  createdAt: z.date(),
});

// Main Project Schema
export const ProjectSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  type: ProjectTypeSchema,
  status: ProjectStatusSchema,

  // Discovery and Planning
  discoveryData: DiscoveryDataSchema,
  companyProfileId: z.string().uuid().optional(),

  // Generated Assets
  generatedAssets: z.array(GeneratedAssetSchema),

  // Quality Evaluation
  evaluations: z.array(WebsiteEvaluationSchema),
  currentIteration: z.number(),
  maxIterations: z.number().default(3),

  // Workflow State
  currentWorkflowId: z.string().uuid().optional(),
  workflowState: z.record(z.any()),

  // Output and Deployment
  outputPath: z.string().optional(),
  deploymentUrl: z.string().url().optional(),
  repositoryUrl: z.string().url().optional(),

  // Metadata
  createdAt: z.date(),
  updatedAt: z.date(),
  completedAt: z.date().optional(),
  tags: z.array(z.string()),
  notes: z.string().optional(),
});

// Project with Relations (for API responses)
export const ProjectWithRelationsSchema = ProjectSchema.extend({
  companyProfile: z.any().optional(),
  workflowExecutions: z.array(z.any()),
  agentExecutions: z.array(z.any()),
});

// Export types
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;
export type ProjectType = z.infer<typeof ProjectTypeSchema>;
export type DiscoveryData = z.infer<typeof DiscoveryDataSchema>;
export type GeneratedAsset = z.infer<typeof GeneratedAssetSchema>;
export type QualityGrade = z.infer<typeof QualityGradeSchema>;
export type WebsiteEvaluation = z.infer<typeof WebsiteEvaluationSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type ProjectWithRelations = z.infer<typeof ProjectWithRelationsSchema>;

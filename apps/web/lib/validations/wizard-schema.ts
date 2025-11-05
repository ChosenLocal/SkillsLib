import { z } from 'zod';

/**
 * Discovery Data Validation Schemas
 * Structured data collection for project planning
 */

export const businessInfoSchema = z.object({
  targetAudience: z.string().optional(),
  uniqueValue: z.string().optional(),
  businessGoals: z.string().optional(),
  challenges: z.string().optional(),
}).optional();

export const servicesSchema = z.object({
  offerings: z.array(z.string()).optional(),
  pricing: z.string().optional(),
  process: z.string().optional(),
  deliverables: z.string().optional(),
}).optional();

export const brandIdentitySchema = z.object({
  primaryColor: z.string().optional(),
  secondaryColors: z.array(z.string()).optional(),
  brandVoice: z.string().optional(),
  styleGuide: z.string().optional(),
  logoUrl: z.string().url().optional(),
}).optional();

export const seoStrategySchema = z.object({
  targetKeywords: z.array(z.string()).optional(),
  competitors: z.array(z.string()).optional(),
  rankingGoals: z.string().optional(),
  localSEO: z.boolean().optional(),
}).optional();

export const contentAssetsSchema = z.object({
  existingContent: z.array(z.string()).optional(),
  mediaAssets: z.array(z.string()).optional(),
  resources: z.string().optional(),
}).optional();

export const legalComplianceSchema = z.object({
  disclaimers: z.string().optional(),
  licenses: z.array(z.string()).optional(),
  privacyPolicy: z.string().optional(),
  terms: z.string().optional(),
}).optional();

export const technicalRequirementsSchema = z.object({
  hosting: z.string().optional(),
  integrations: z.array(z.string()).optional(),
  specialFeatures: z.string().optional(),
  performance: z.string().optional(),
}).optional();

export const discoveryDataSchema = z.object({
  businessInfo: businessInfoSchema,
  services: servicesSchema,
  brandIdentity: brandIdentitySchema,
  seoStrategy: seoStrategySchema,
  contentAssets: contentAssetsSchema,
  legalCompliance: legalComplianceSchema,
  technicalRequirements: technicalRequirementsSchema,
  completeness: z.number().min(0).max(100).default(0),
});

/**
 * Company Profile Quick Create Schema
 * Simplified form for creating company profile within wizard
 */
export const companyProfileQuickCreateSchema = z.object({
  name: z.string().min(1, 'Company name is required').max(200),
  industry: z.string().optional(),
  tagline: z.string().max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  website: z.string().url().optional(),
  address: z.string().optional(),
});

/**
 * Step-specific validation schemas
 */

// Step 1: Project Type
export const step1Schema = z.object({
  type: z.enum(['website', 'content', 'seo_audit', 'workflow', 'data_processing', 'customer_service'], {
    required_error: 'Please select a project type',
  }),
});

// Step 2: Basic Information
export const step2Schema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Name must be 100 characters or less'),
  description: z.string().max(500).optional(),
  tags: z.array(z.string()).optional(),
  maxIterations: z.number().int().min(1).max(10).default(3),
});

// Step 3: Company Profile (optional step)
const step3BaseSchema = z.object({
  companyProfileId: z.string().uuid().optional(),
  companyProfileData: companyProfileQuickCreateSchema.optional(),
});

export const step3Schema = step3BaseSchema.refine(
  () => {
    // Either select existing OR create new, but not both required
    return true;
  },
  {
    message: 'Select an existing company profile or create a new one',
  }
);

// Step 4: Discovery Data (all optional)
export const step4Schema = discoveryDataSchema.optional();

// Step 5: Review (no additional fields, just validation)
export const step5Schema = z.object({
  termsAccepted: z.boolean().optional(),
});

/**
 * Complete wizard form schema
 * Combines all steps for final validation
 */
export const wizardFormSchema = z.object({
  // Step 1
  type: step1Schema.shape.type,

  // Step 2
  name: step2Schema.shape.name,
  description: step2Schema.shape.description,
  tags: step2Schema.shape.tags,
  maxIterations: step2Schema.shape.maxIterations,

  // Step 3
  companyProfileId: step3BaseSchema.shape.companyProfileId,
  companyProfileData: step3BaseSchema.shape.companyProfileData,

  // Step 4
  discoveryData: discoveryDataSchema.optional(),

  // Step 5
  termsAccepted: step5Schema.shape.termsAccepted,
});

export type WizardFormData = z.infer<typeof wizardFormSchema>;
export type Step1Data = z.infer<typeof step1Schema>;
export type Step2Data = z.infer<typeof step2Schema>;
export type Step3Data = z.infer<typeof step3Schema>;
export type Step4Data = z.infer<typeof step4Schema>;
export type Step5Data = z.infer<typeof step5Schema>;
export type DiscoveryData = z.infer<typeof discoveryDataSchema>;
export type CompanyProfileQuickCreate = z.infer<typeof companyProfileQuickCreateSchema>;

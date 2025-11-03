import { z } from 'zod';

/**
 * Multi-tenant schemas
 */

export const SubscriptionTierSchema = z.enum(['free', 'pro', 'enterprise']);

export const TenantSettingsSchema = z.object({
  // Branding
  companyName: z.string().optional(),
  logoUrl: z.string().url().optional(),

  // Limits
  maxProjects: z.number().optional(),
  maxAgentExecutionsPerMonth: z.number().optional(),
  maxStorageGB: z.number().optional(),

  // Features
  features: z.object({
    websiteGeneration: z.boolean().default(true),
    contentGeneration: z.boolean().default(true),
    seoAudit: z.boolean().default(false),
    dataProcessing: z.boolean().default(false),
    customerService: z.boolean().default(false),
    apiAccess: z.boolean().default(false),
    customMCPServers: z.boolean().default(false),
  }),

  // Notifications
  notifications: z.object({
    email: z.boolean().default(true),
    slack: z.boolean().default(false),
    slackWebhookUrl: z.string().url().optional(),
  }),

  // Integrations
  integrations: z.record(z.any()).optional(),
});

export const TenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  subscriptionTier: SubscriptionTierSchema,
  settings: TenantSettingsSchema,

  // Billing
  stripeCustomerId: z.string().optional(),
  subscriptionStatus: z.enum(['active', 'trialing', 'past_due', 'canceled']).optional(),

  // Usage Metrics
  usageMetrics: z.object({
    projectsCount: z.number(),
    agentExecutionsThisMonth: z.number(),
    storageUsedGB: z.number(),
    lastResetDate: z.date(),
  }),

  // Metadata
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().optional(),
});

export const UserRoleSchema = z.enum(['owner', 'admin', 'member', 'viewer']);

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  tenantId: z.string().uuid(),
  role: UserRoleSchema,

  // Authentication
  passwordHash: z.string().optional(),
  emailVerified: z.date().optional(),

  // Profile
  avatarUrl: z.string().url().optional(),
  timezone: z.string().default('America/New_York'),
  preferences: z.record(z.any()).optional(),

  // Metadata
  createdAt: z.date(),
  updatedAt: z.date(),
  lastLoginAt: z.date().optional(),
  deletedAt: z.date().optional(),
});

// Export types
export type SubscriptionTier = z.infer<typeof SubscriptionTierSchema>;
export type TenantSettings = z.infer<typeof TenantSettingsSchema>;
export type Tenant = z.infer<typeof TenantSchema>;
export type UserRole = z.infer<typeof UserRoleSchema>;
export type User = z.infer<typeof UserSchema>;

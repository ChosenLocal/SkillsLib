import { z } from 'zod';

/**
 * Validation schemas for tenant-related operations
 */

export const subscriptionTierSchema = z.enum(['FREE', 'PRO', 'ENTERPRISE']);
export const subscriptionStatusSchema = z.enum(['ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED']);

/**
 * Tenant settings schema
 * Stored as JSON in the database
 */
export const tenantSettingsSchema = z.object({
  // Feature flags
  enableAdvancedAnalytics: z.boolean().default(false),
  enableAPIAccess: z.boolean().default(false),
  enableCustomBranding: z.boolean().default(false),
  enableSSO: z.boolean().default(false),

  // Limits
  maxProjects: z.number().int().positive().optional(),
  maxUsers: z.number().int().positive().optional(),
  maxAgentExecutionsPerMonth: z.number().int().positive().optional(),
  maxStorageGB: z.number().positive().optional(),

  // Notifications
  emailNotifications: z.boolean().default(true),
  slackWebhook: z.string().url().optional(),
  discordWebhook: z.string().url().optional(),

  // Branding
  logoUrl: z.string().url().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  companyName: z.string().optional(),
});

export type TenantSettings = z.infer<typeof tenantSettingsSchema>;

/**
 * Schema for updating tenant settings
 */
export const updateTenantSettingsSchema = z.object({
  settings: tenantSettingsSchema.partial(),
});

export type UpdateTenantSettingsInput = z.infer<typeof updateTenantSettingsSchema>;

/**
 * Schema for updating tenant information
 */
export const updateTenantSchema = z.object({
  name: z.string().min(1, 'Tenant name is required').max(100).optional(),
  slug: z.string()
    .min(3, 'Slug must be at least 3 characters')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens')
    .optional(),
});

export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;

/**
 * Schema for inviting a team member
 */
export const inviteMemberSchema = z.object({
  email: z.string().email('Valid email is required'),
  role: z.enum(['USER', 'ADMIN', 'OWNER']),
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

/**
 * Schema for removing a team member
 */
export const removeMemberSchema = z.object({
  userId: z.string().uuid('Valid user ID is required'),
});

export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;

/**
 * Schema for updating team member role
 */
export const updateMemberRoleSchema = z.object({
  userId: z.string().uuid('Valid user ID is required'),
  role: z.enum(['USER', 'ADMIN', 'OWNER']),
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

/**
 * Schema for listing team members with pagination
 */
export const listMembersSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
  role: z.enum(['USER', 'ADMIN', 'OWNER']).optional(),
  search: z.string().optional(),
});

export type ListMembersInput = z.infer<typeof listMembersSchema>;

/**
 * Schema for updating subscription
 */
export const updateSubscriptionSchema = z.object({
  tier: subscriptionTierSchema,
});

export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;

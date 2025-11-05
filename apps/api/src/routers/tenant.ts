/**
 * Tenant Router
 *
 * tRPC router for tenant management operations.
 * Handles tenant settings, team members, billing, and subscription management.
 */

import { router, protectedProcedure, adminProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

// Inline validation schemas (from apps/web/lib/validations/tenant.ts)
const subscriptionTierSchema = z.enum(['FREE', 'PRO', 'ENTERPRISE']);

const tenantSettingsSchema = z.object({
  enableAdvancedAnalytics: z.boolean().default(false),
  enableAPIAccess: z.boolean().default(false),
  enableCustomBranding: z.boolean().default(false),
  enableSSO: z.boolean().default(false),
  maxProjects: z.number().int().positive().optional(),
  maxUsers: z.number().int().positive().optional(),
  maxAgentExecutionsPerMonth: z.number().int().positive().optional(),
  maxStorageGB: z.number().positive().optional(),
  emailNotifications: z.boolean().default(true),
  slackWebhook: z.string().url().optional(),
  discordWebhook: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  companyName: z.string().optional(),
});

const updateTenantSettingsSchema = z.object({
  settings: tenantSettingsSchema.partial(),
});

const updateTenantSchema = z.object({
  name: z.string().min(1, 'Tenant name is required').max(100).optional(),
  slug: z.string()
    .min(3, 'Slug must be at least 3 characters')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens')
    .optional(),
});

const inviteMemberSchema = z.object({
  email: z.string().email('Valid email is required'),
  role: z.enum(['USER', 'ADMIN', 'OWNER']),
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
});

const removeMemberSchema = z.object({
  userId: z.string().uuid('Valid user ID is required'),
});

const updateMemberRoleSchema = z.object({
  userId: z.string().uuid('Valid user ID is required'),
  role: z.enum(['USER', 'ADMIN', 'OWNER']),
});

const listMembersSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
  role: z.enum(['USER', 'ADMIN', 'OWNER']).optional(),
  search: z.string().optional(),
});

const updateSubscriptionSchema = z.object({
  tier: subscriptionTierSchema,
});

export const tenantRouter = router({
  /**
   * Get current tenant information
   */
  get: protectedProcedure.query(async ({ ctx }) => {
    const tenant = await ctx.prisma.tenant.findUnique({
      where: {
        id: ctx.user.tenantId,
      },
      include: {
        _count: {
          select: {
            users: true,
            projects: true,
            agentExecutions: true,
            workflowExecutions: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Tenant not found',
      });
    }

    return tenant;
  }),

  /**
   * Update tenant settings (JSON field)
   * Requires ADMIN or OWNER role
   */
  updateSettings: adminProcedure
    .input(updateTenantSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      // Fetch current settings
      const tenant = await ctx.prisma.tenant.findUnique({
        where: { id: ctx.user.tenantId },
        select: { settings: true },
      });

      if (!tenant) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Tenant not found',
        });
      }

      // Merge new settings with existing settings
      const currentSettings = (tenant.settings as object) || {};
      const updatedSettings = {
        ...currentSettings,
        ...input.settings,
      };

      const updatedTenant = await ctx.prisma.tenant.update({
        where: { id: ctx.user.tenantId },
        data: {
          settings: updatedSettings,
        },
      });

      return updatedTenant;
    }),

  /**
   * Update tenant information (name, slug)
   * Requires ADMIN or OWNER role
   */
  update: adminProcedure
    .input(updateTenantSchema)
    .mutation(async ({ ctx, input }) => {
      // Check if slug is already taken (if updating slug)
      if (input.slug) {
        const existing = await ctx.prisma.tenant.findUnique({
          where: { slug: input.slug },
        });

        if (existing && existing.id !== ctx.user.tenantId) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'This slug is already taken',
          });
        }
      }

      const tenant = await ctx.prisma.tenant.update({
        where: { id: ctx.user.tenantId },
        data: input,
      });

      return tenant;
    }),

  /**
   * List team members with pagination
   */
  listMembers: protectedProcedure
    .input(listMembersSchema)
    .query(async ({ ctx, input }) => {
      const { limit, cursor, role, search } = input;

      // Build where clause
      const where: any = {
        tenantId: ctx.user.tenantId,
        deletedAt: null,
      };

      if (role) {
        where.role = role;
      }

      if (search) {
        where.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Fetch members
      const members = await ctx.prisma.user.findMany({
        where,
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const hasMore = members.length > limit;
      const items = hasMore ? members.slice(0, limit) : members;
      const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]!.id : null;

      return {
        items,
        nextCursor,
      };
    }),

  /**
   * Invite a new team member
   * Requires ADMIN or OWNER role
   * Creates a user with a verification token
   */
  inviteMember: adminProcedure
    .input(inviteMemberSchema)
    .mutation(async ({ ctx, input }) => {
      // Check if user already exists
      const existingUser = await ctx.prisma.user.findUnique({
        where: { email: input.email },
      });

      if (existingUser) {
        if (existingUser.tenantId === ctx.user.tenantId) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'This user is already a member of your organization',
          });
        } else {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'This email is already registered with another organization',
          });
        }
      }

      // Generate verification token
      const crypto = await import('crypto');
      const token = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      // Create user with pending verification
      const user = await ctx.prisma.user.create({
        data: {
          email: input.email,
          firstName: input.firstName || '',
          lastName: input.lastName || '',
          role: input.role,
          tenantId: ctx.user.tenantId,
          emailVerified: null, // Will be verified via invitation link
        },
      });

      // Create verification token
      await ctx.prisma.verificationToken.create({
        data: {
          identifier: input.email,
          token: hashedToken,
          expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      // TODO: Send invitation email with token
      // await sendInvitationEmail(input.email, token);

      return {
        user,
        invitationToken: token, // Return unhashed token for email
      };
    }),

  /**
   * Remove a team member
   * Requires OWNER role
   * Cannot remove the last owner
   */
  removeMember: protectedProcedure
    .input(removeMemberSchema)
    .mutation(async ({ ctx, input }) => {
      // Only OWNER can remove members
      if (ctx.user.role !== 'OWNER') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only organization owners can remove team members',
        });
      }

      // Cannot remove yourself
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You cannot remove yourself from the organization',
        });
      }

      // Check if user belongs to this tenant
      const targetUser = await ctx.prisma.user.findFirst({
        where: {
          id: input.userId,
          tenantId: ctx.user.tenantId,
        },
      });

      if (!targetUser) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found in your organization',
        });
      }

      // Check if removing the last owner
      if (targetUser.role === 'OWNER') {
        const ownerCount = await ctx.prisma.user.count({
          where: {
            tenantId: ctx.user.tenantId,
            role: 'OWNER',
            deletedAt: null,
          },
        });

        if (ownerCount <= 1) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot remove the last owner. Transfer ownership first.',
          });
        }
      }

      // Soft delete the user
      await ctx.prisma.user.update({
        where: { id: input.userId },
        data: {
          deletedAt: new Date(),
        },
      });

      return { success: true };
    }),

  /**
   * Update team member role
   * Requires OWNER role
   */
  updateMemberRole: protectedProcedure
    .input(updateMemberRoleSchema)
    .mutation(async ({ ctx, input }) => {
      // Only OWNER can update roles
      if (ctx.user.role !== 'OWNER') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only organization owners can update member roles',
        });
      }

      // Cannot change your own role
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You cannot change your own role',
        });
      }

      // Check if user belongs to this tenant
      const targetUser = await ctx.prisma.user.findFirst({
        where: {
          id: input.userId,
          tenantId: ctx.user.tenantId,
        },
      });

      if (!targetUser) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found in your organization',
        });
      }

      // If demoting the last owner, prevent it
      if (targetUser.role === 'OWNER' && input.role !== 'OWNER') {
        const ownerCount = await ctx.prisma.user.count({
          where: {
            tenantId: ctx.user.tenantId,
            role: 'OWNER',
            deletedAt: null,
          },
        });

        if (ownerCount <= 1) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot demote the last owner. Promote another user to owner first.',
          });
        }
      }

      const updatedUser = await ctx.prisma.user.update({
        where: { id: input.userId },
        data: {
          role: input.role,
        },
      });

      return updatedUser;
    }),

  /**
   * Update subscription tier
   * Requires OWNER role
   */
  updateSubscription: protectedProcedure
    .input(updateSubscriptionSchema)
    .mutation(async ({ ctx, input }) => {
      // Only OWNER can update subscription
      if (ctx.user.role !== 'OWNER') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only organization owners can update the subscription',
        });
      }

      // Get current tier to validate upgrade/downgrade
      const currentTenant = await ctx.prisma.tenant.findUnique({
        where: { id: ctx.user.tenantId },
        select: { subscriptionTier: true },
      });

      if (!currentTenant) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Tenant not found',
        });
      }

      // TODO: Integrate with Stripe for payment processing
      // For now, just update the tier
      const tenant = await ctx.prisma.tenant.update({
        where: { id: ctx.user.tenantId },
        data: {
          subscriptionTier: input.tier,
          subscriptionStatus: 'ACTIVE',
        },
      });

      return tenant;
    }),

  /**
   * Get billing information
   * Requires OWNER role
   */
  getBillingInfo: protectedProcedure.query(async ({ ctx }) => {
    // Only OWNER can view billing
    if (ctx.user.role !== 'OWNER') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only organization owners can view billing information',
      });
    }

    const tenant = await ctx.prisma.tenant.findUnique({
      where: { id: ctx.user.tenantId },
      select: {
        subscriptionTier: true,
        subscriptionStatus: true,
        stripeCustomerId: true,
        projectsCount: true,
        agentExecutionsThisMonth: true,
        storageUsedGB: true,
        lastResetDate: true,
        settings: true,
      },
    });

    if (!tenant) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Tenant not found',
      });
    }

    // Extract usage limits from settings
    const settings = tenant.settings as any || {};
    const limits = {
      maxProjects: settings.maxProjects,
      maxUsers: settings.maxUsers,
      maxAgentExecutionsPerMonth: settings.maxAgentExecutionsPerMonth,
      maxStorageGB: settings.maxStorageGB,
    };

    return {
      ...tenant,
      limits,
      usage: {
        projects: tenant.projectsCount,
        agentExecutions: tenant.agentExecutionsThisMonth,
        storageGB: tenant.storageUsedGB,
      },
    };
  }),

  /**
   * Get usage statistics for the current billing period
   */
  getUsageStats: protectedProcedure.query(async ({ ctx }) => {
    const tenant = await ctx.prisma.tenant.findUnique({
      where: { id: ctx.user.tenantId },
      select: {
        projectsCount: true,
        agentExecutionsThisMonth: true,
        storageUsedGB: true,
        lastResetDate: true,
        settings: true,
      },
    });

    if (!tenant) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Tenant not found',
      });
    }

    const settings = tenant.settings as any || {};

    return {
      current: {
        projects: tenant.projectsCount,
        agentExecutions: tenant.agentExecutionsThisMonth,
        storageGB: tenant.storageUsedGB,
      },
      limits: {
        maxProjects: settings.maxProjects || Infinity,
        maxAgentExecutionsPerMonth: settings.maxAgentExecutionsPerMonth || Infinity,
        maxStorageGB: settings.maxStorageGB || Infinity,
      },
      lastResetDate: tenant.lastResetDate,
    };
  }),
});

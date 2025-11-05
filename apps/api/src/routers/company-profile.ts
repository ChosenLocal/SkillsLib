/**
 * Company Profile Router
 *
 * tRPC router for company profile CRUD operations.
 * Manages client company information for website generation.
 */

import { router, protectedProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

/**
 * Create input schema
 * Company profile data (simplified for creation)
 */
const CreateCompanyProfileInput = z.object({
  name: z.string().min(1).max(200),
  legalName: z.string().optional(),
  tagline: z.string().optional(),
  founded: z.string().optional(),
  industry: z.string().optional(),
  contact: z.record(z.any()).optional(),
  locations: z.array(z.any()).optional(),
  hours: z.record(z.any()).optional(),
  services: z.array(z.any()).optional(),
  serviceAreas: z.array(z.string()).optional(),
  brand: z.record(z.any()).optional(),
  certifications: z.array(z.any()).optional(),
  licenses: z.array(z.any()).optional(),
  insurance: z.record(z.any()).optional(),
  teamMembers: z.array(z.any()).optional(),
  projects: z.array(z.any()).optional(),
  testimonials: z.array(z.any()).optional(),
  seo: z.record(z.any()).optional(),
  metrics: z.record(z.any()).optional(),
  integrations: z.array(z.any()).optional(),
  websiteConfig: z.record(z.any()).optional(),
});

/**
 * Update input schema
 */
const UpdateCompanyProfileInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  legalName: z.string().optional(),
  tagline: z.string().optional(),
  founded: z.string().optional(),
  industry: z.string().optional(),
  contact: z.record(z.any()).optional(),
  locations: z.array(z.any()).optional(),
  hours: z.record(z.any()).optional(),
  services: z.array(z.any()).optional(),
  serviceAreas: z.array(z.string()).optional(),
  brand: z.record(z.any()).optional(),
  certifications: z.array(z.any()).optional(),
  licenses: z.array(z.any()).optional(),
  insurance: z.record(z.any()).optional(),
  teamMembers: z.array(z.any()).optional(),
  projects: z.array(z.any()).optional(),
  testimonials: z.array(z.any()).optional(),
  seo: z.record(z.any()).optional(),
  metrics: z.record(z.any()).optional(),
  integrations: z.array(z.any()).optional(),
  websiteConfig: z.record(z.any()).optional(),
});

export const companyProfileRouter = router({
  /**
   * Create a new company profile
   */
  create: protectedProcedure
    .input(CreateCompanyProfileInput)
    .mutation(async ({ ctx, input }) => {
      const profile = await ctx.prisma.companyProfile.create({
        data: {
          tenantId: ctx.user.tenantId,
          name: input.name,
          legalName: input.legalName || input.name, // Default to company name
          tagline: input.tagline || '',
          industry: input.industry || '',
          founded: input.founded ? new Date(input.founded) : null,
          contact: input.contact || {},
          locations: input.locations || [],
          hours: input.hours || {},
          emergencyAvailable: false,
          services: input.services || [],
          serviceAreas: input.serviceAreas || [],
          brand: input.brand || {},
          certifications: input.certifications || [],
          licenses: input.licenses || [],
          insurance: input.insurance || {},
          manufacturerCerts: {},
          industryAffiliations: {},
          teamMembers: input.teamMembers || [],
          projects: input.projects || [],
          testimonials: input.testimonials || [],
          awards: {},
          caseStudies: {},
          seo: input.seo || {},
          metrics: input.metrics || {},
          integrations: input.integrations || [],
          websiteConfig: input.websiteConfig || {},
        },
      });

      return profile;
    }),

  /**
   * List company profiles with pagination
   */
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().uuid().optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = {
        tenantId: ctx.user.tenantId,
      };

      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: 'insensitive' } },
          { industry: { contains: input.search, mode: 'insensitive' } },
        ];
      }

      const profiles = await ctx.prisma.companyProfile.findMany({
        where,
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          _count: {
            select: {
              websiteProjects: true,
            },
          },
        },
      });

      const hasMore = profiles.length > input.limit;
      const items = hasMore ? profiles.slice(0, input.limit) : profiles;
      const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]!.id : null;

      return {
        items,
        nextCursor,
      };
    }),

  /**
   * Get a single company profile by ID
   */
  getById: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const profile = await ctx.prisma.companyProfile.findFirst({
        where: {
          id: input.id,
          tenantId: ctx.user.tenantId,
        },
        include: {
          websiteProjects: {
            select: {
              id: true,
              name: true,
              status: true,
              type: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 10,
          },
          _count: {
            select: {
              websiteProjects: true,
            },
          },
        },
      });

      if (!profile) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Company profile not found',
        });
      }

      return profile;
    }),

  /**
   * Update a company profile
   */
  update: protectedProcedure
    .input(UpdateCompanyProfileInput)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Verify profile exists and belongs to tenant
      const existing = await ctx.prisma.companyProfile.findFirst({
        where: {
          id,
          tenantId: ctx.user.tenantId,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Company profile not found',
        });
      }

      const profile = await ctx.prisma.companyProfile.update({
        where: {
          id,
        },
        data,
      });

      return profile;
    }),

  /**
   * Delete a company profile
   */
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify profile exists and belongs to tenant
      const existing = await ctx.prisma.companyProfile.findFirst({
        where: {
          id: input.id,
          tenantId: ctx.user.tenantId,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Company profile not found',
        });
      }

      // Check if profile is used by any active projects
      const projectCount = await ctx.prisma.project.count({
        where: {
          companyProfileId: input.id,
          status: {
            in: ['DRAFT', 'IN_PROGRESS'],
          },
        },
      });

      if (projectCount > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot delete profile: ${projectCount} active project(s) are using it`,
        });
      }

      await ctx.prisma.companyProfile.delete({
        where: {
          id: input.id,
        },
      });

      return { success: true };
    }),
});

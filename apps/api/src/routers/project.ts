/**
 * Project Router
 *
 * tRPC router for project CRUD operations and management.
 * All procedures require authentication and enforce tenant isolation.
 */

import { router, protectedProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  ProjectTypeSchema,
  ProjectStatusSchema,
  DiscoveryDataSchema,
} from '@business-automation/schema';

/**
 * Input schema for creating a new project
 */
const CreateProjectInput = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().optional(),
  type: ProjectTypeSchema,
  companyProfileId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  discoveryData: DiscoveryDataSchema.optional(),
  maxIterations: z.number().int().min(1).max(10).optional().default(3),
});

/**
 * Input schema for updating a project
 */
const UpdateProjectInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  status: ProjectStatusSchema.optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  discoveryData: DiscoveryDataSchema.optional(),
});

/**
 * Input schema for pagination and filtering
 */
const ListProjectsInput = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.number().min(1).max(100).default(20),
  filters: z
    .object({
      status: ProjectStatusSchema.optional(),
      type: ProjectTypeSchema.optional(),
      search: z.string().optional(),
    })
    .optional(),
});

export const projectRouter = router({
  /**
   * Create a new project
   */
  create: protectedProcedure
    .input(CreateProjectInput)
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.create({
        data: {
          tenantId: ctx.user.tenantId,
          name: input.name,
          description: input.description || '',
          type: input.type.toUpperCase() as any,
          status: 'DRAFT',
          companyProfileId: input.companyProfileId,
          tags: input.tags || [],
          discoveryData: input.discoveryData || {},
          maxIterations: input.maxIterations,
          currentIteration: 0,
        },
        include: {
          companyProfile: {
            select: {
              name: true,
            },
          },
        },
      });

      return project;
    }),

  /**
   * List projects with pagination and filters
   */
  list: protectedProcedure
    .input(ListProjectsInput)
    .query(async ({ ctx, input }) => {
      const { cursor, limit, filters } = input;

      // Build WHERE clause
      const where: any = {
        tenantId: ctx.user.tenantId,
      };

      if (filters?.status) {
        where.status = filters.status.toUpperCase();
      }

      if (filters?.type) {
        where.type = filters.type.toUpperCase();
      }

      if (filters?.search) {
        where.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      // Cursor-based pagination
      const projects = await ctx.prisma.project.findMany({
        where,
        take: limit + 1, // Fetch one extra to determine if there's a next page
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: {
          updatedAt: 'desc',
        },
        include: {
          companyProfile: {
            select: {
              name: true,
            },
          },
          _count: {
            select: {
              agentExecutions: true,
              workflowExecutions: true,
            },
          },
        },
      });

      // Check if there are more results
      const hasMore = projects.length > limit;
      const items = hasMore ? projects.slice(0, limit) : projects;
      const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]!.id : null;

      return {
        items,
        nextCursor,
      };
    }),

  /**
   * Get a single project by ID
   */
  getById: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.id,
          tenantId: ctx.user.tenantId,
        },
        include: {
          companyProfile: true,
          workflowExecutions: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
          agentExecutions: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 20,
          },
          evaluations: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 5,
          },
          _count: {
            select: {
              agentExecutions: true,
              workflowExecutions: true,
              generatedAssets: true,
            },
          },
        },
      });

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      return project;
    }),

  /**
   * Update project status
   */
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: ProjectStatusSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify project exists and belongs to tenant
      const existing = await ctx.prisma.project.findFirst({
        where: {
          id: input.id,
          tenantId: ctx.user.tenantId,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      const project = await ctx.prisma.project.update({
        where: {
          id: input.id,
        },
        data: {
          status: input.status.toUpperCase() as any,
          completedAt:
            input.status.toLowerCase() === 'completed' ? new Date() : undefined,
          updatedAt: new Date(),
        },
        include: {
          companyProfile: {
            select: {
              name: true,
            },
          },
        },
      });

      return project;
    }),

  /**
   * Update project details
   */
  update: protectedProcedure
    .input(UpdateProjectInput)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Verify project exists and belongs to tenant
      const existing = await ctx.prisma.project.findFirst({
        where: {
          id,
          tenantId: ctx.user.tenantId,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      const project = await ctx.prisma.project.update({
        where: {
          id,
        },
        data: {
          ...data,
          status: data.status ? (data.status.toUpperCase() as any) : undefined,
          updatedAt: new Date(),
        },
        include: {
          companyProfile: {
            select: {
              name: true,
            },
          },
        },
      });

      return project;
    }),

  /**
   * Delete a project (cascades to related records)
   */
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify project exists and belongs to tenant
      const existing = await ctx.prisma.project.findFirst({
        where: {
          id: input.id,
          tenantId: ctx.user.tenantId,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      // Delete project (will cascade to workflow executions, agent executions, etc.)
      await ctx.prisma.project.delete({
        where: {
          id: input.id,
        },
      });

      return { success: true };
    }),
});

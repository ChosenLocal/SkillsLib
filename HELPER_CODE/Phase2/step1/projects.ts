import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { ProjectTypeSchema, ProjectStatusSchema } from '@business-automation/schema';

export const projectsRouter = router({
  /**
   * List all projects for the current tenant
   */
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
        status: ProjectStatusSchema.optional(),
        type: ProjectTypeSchema.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor, status, type } = input;

      const projects = await ctx.prisma.project.findMany({
        where: {
          tenantId: ctx.user.tenantId,
          ...(status && { status }),
          ...(type && { type }),
        },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          companyProfile: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              agentExecutions: true,
              generatedAssets: true,
              evaluations: true,
            },
          },
        },
      });

      let nextCursor: string | undefined = undefined;
      if (projects.length > limit) {
        const nextItem = projects.pop();
        nextCursor = nextItem!.id;
      }

      return {
        projects,
        nextCursor,
      };
    }),

  /**
   * Get a single project by ID
   */
  get: protectedProcedure
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
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          agentExecutions: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          generatedAssets: {
            orderBy: { createdAt: 'desc' },
          },
          evaluations: {
            orderBy: { createdAt: 'desc' },
            take: 1,
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
   * Create a new project
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        type: ProjectTypeSchema,
        companyProfileId: z.string().uuid().optional(),
        discoveryData: z.record(z.any()).default({}),
        tags: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.create({
        data: {
          tenantId: ctx.user.tenantId,
          name: input.name,
          description: input.description,
          type: input.type,
          companyProfileId: input.companyProfileId,
          discoveryData: input.discoveryData,
          tags: input.tags,
          status: 'DRAFT',
          workflowState: {},
          currentIteration: 1,
          maxIterations: 3,
        },
        include: {
          companyProfile: true,
        },
      });

      return project;
    }),

  /**
   * Update a project
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        status: ProjectStatusSchema.optional(),
        discoveryData: z.record(z.any()).optional(),
        tags: z.array(z.string()).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

      // Verify project belongs to tenant
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
        where: { id },
        data: updateData,
        include: {
          companyProfile: true,
        },
      });

      return project;
    }),

  /**
   * Delete a project
   */
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify project belongs to tenant
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

      await ctx.prisma.project.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  /**
   * Get project statistics
   */
  stats: protectedProcedure
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
          _count: {
            select: {
              agentExecutions: true,
              generatedAssets: true,
              evaluations: true,
              workflowExecutions: true,
            },
          },
          agentExecutions: {
            select: {
              status: true,
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

      const statusCounts = project.agentExecutions.reduce(
        (acc, exec) => {
          acc[exec.status] = (acc[exec.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      return {
        totalAgents: project._count.agentExecutions,
        totalAssets: project._count.generatedAssets,
        totalEvaluations: project._count.evaluations,
        totalWorkflows: project._count.workflowExecutions,
        agentStatusBreakdown: statusCounts,
      };
    }),
});

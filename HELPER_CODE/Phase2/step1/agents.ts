import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { AgentRoleSchema, AgentStatusSchema, AgentLayerSchema } from '@business-automation/schema';

export const agentsRouter = router({
  /**
   * List agent executions for a project
   */
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
        status: AgentStatusSchema.optional(),
        layer: AgentLayerSchema.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { projectId, limit, cursor, status, layer } = input;

      // Verify project belongs to tenant
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: projectId,
          tenantId: ctx.user.tenantId,
        },
      });

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      const executions = await ctx.prisma.agentExecution.findMany({
        where: {
          projectId,
          tenantId: ctx.user.tenantId,
          ...(status && { status }),
          ...(layer && { layer }),
        },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          workflowExecution: {
            select: {
              id: true,
              workflowType: true,
              status: true,
            },
          },
        },
      });

      let nextCursor: string | undefined = undefined;
      if (executions.length > limit) {
        const nextItem = executions.pop();
        nextCursor = nextItem!.id;
      }

      return {
        executions,
        nextCursor,
      };
    }),

  /**
   * Get a single agent execution by ID
   */
  get: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const execution = await ctx.prisma.agentExecution.findFirst({
        where: {
          id: input.id,
          tenantId: ctx.user.tenantId,
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
            },
          },
          workflowExecution: {
            select: {
              id: true,
              workflowType: true,
              status: true,
            },
          },
        },
      });

      if (!execution) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Agent execution not found',
        });
      }

      return execution;
    }),

  /**
   * Get agent executions grouped by layer for a project
   */
  byLayer: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify project belongs to tenant
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          tenantId: ctx.user.tenantId,
        },
      });

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      const executions = await ctx.prisma.agentExecution.findMany({
        where: {
          projectId: input.projectId,
          tenantId: ctx.user.tenantId,
        },
        orderBy: [{ layer: 'asc' }, { createdAt: 'desc' }],
      });

      // Group by layer
      const grouped = executions.reduce(
        (acc, exec) => {
          if (!acc[exec.layer]) {
            acc[exec.layer] = [];
          }
          acc[exec.layer].push(exec);
          return acc;
        },
        {} as Record<string, typeof executions>
      );

      return grouped;
    }),

  /**
   * Get agent execution statistics for a project
   */
  stats: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify project belongs to tenant
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          tenantId: ctx.user.tenantId,
        },
      });

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      const executions = await ctx.prisma.agentExecution.findMany({
        where: {
          projectId: input.projectId,
          tenantId: ctx.user.tenantId,
        },
        select: {
          status: true,
          layer: true,
          executionTimeMs: true,
          tokensUsed: true,
          cost: true,
        },
      });

      const stats = {
        total: executions.length,
        byStatus: {} as Record<string, number>,
        byLayer: {} as Record<string, number>,
        totalExecutionTimeMs: 0,
        totalTokensUsed: 0,
        totalCost: 0,
        avgExecutionTimeMs: 0,
      };

      executions.forEach((exec) => {
        // Count by status
        stats.byStatus[exec.status] = (stats.byStatus[exec.status] || 0) + 1;

        // Count by layer
        stats.byLayer[exec.layer] = (stats.byLayer[exec.layer] || 0) + 1;

        // Aggregate metrics
        stats.totalExecutionTimeMs += exec.executionTimeMs || 0;
        stats.totalTokensUsed += exec.tokensUsed || 0;
        stats.totalCost += exec.cost || 0;
      });

      stats.avgExecutionTimeMs =
        executions.length > 0 ? stats.totalExecutionTimeMs / executions.length : 0;

      return stats;
    }),

  /**
   * Get recent agent activity for dashboard
   */
  recentActivity: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const executions = await ctx.prisma.agentExecution.findMany({
        where: {
          tenantId: ctx.user.tenantId,
        },
        take: input.limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return executions;
    }),
});

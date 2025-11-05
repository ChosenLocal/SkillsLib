/**
 * Subscription Router
 *
 * tRPC router for real-time subscriptions and event streams.
 * This router provides metadata and helpers for the SSE-based subscription system.
 *
 * Note: Real-time updates are currently handled via Server-Sent Events (SSE)
 * at /api/projects/[id]/stream. This router provides helper procedures
 * for managing subscriptions.
 */

import { router, protectedProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

export const subscriptionRouter = router({
  /**
   * Get subscription info for a project
   * Returns metadata about available real-time streams
   */
  getProjectStreamInfo: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify project exists and belongs to tenant
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          tenantId: ctx.user.tenantId,
        },
        select: {
          id: true,
          name: true,
          status: true,
        },
      });

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      return {
        project,
        streamEndpoint: `/api/projects/${input.projectId}/stream`,
        availableEvents: [
          'connected',
          'workflow.progress',
          'agent.pending',
          'agent.running',
          'agent.completed',
          'agent.failed',
          'agent.cancelled',
        ],
        protocol: 'Server-Sent Events (SSE)',
        pollingInterval: 2000, // ms
      };
    }),

  /**
   * Get subscription info for a workflow
   * Returns metadata about workflow execution streams
   */
  getWorkflowStreamInfo: protectedProcedure
    .input(
      z.object({
        workflowExecutionId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify workflow exists and belongs to tenant
      const workflow = await ctx.prisma.workflowExecution.findFirst({
        where: {
          id: input.workflowExecutionId,
          tenantId: ctx.user.tenantId,
        },
        select: {
          id: true,
          workflowType: true,
          status: true,
          projectId: true,
        },
      });

      if (!workflow) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workflow execution not found',
        });
      }

      return {
        workflow,
        streamEndpoint: `/api/projects/${workflow.projectId}/stream`,
        availableEvents: [
          'workflow.progress',
          'agent.pending',
          'agent.running',
          'agent.completed',
          'agent.failed',
        ],
        protocol: 'Server-Sent Events (SSE)',
        pollingInterval: 2000, // ms
      };
    }),

  /**
   * List active subscriptions for the current user
   * This would track EventSource connections in a future implementation
   */
  listActive: protectedProcedure.query(async ({ ctx }) => {
    // For now, just return projects that are in progress
    // In a full implementation, this would track active SSE connections
    const activeProjects = await ctx.prisma.project.findMany({
      where: {
        tenantId: ctx.user.tenantId,
        status: 'IN_PROGRESS',
      },
      select: {
        id: true,
        name: true,
        status: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 10,
    });

    return {
      subscriptions: activeProjects.map((project) => ({
        projectId: project.id,
        projectName: project.name,
        status: project.status,
        streamEndpoint: `/api/projects/${project.id}/stream`,
        lastUpdate: project.updatedAt,
      })),
    };
  }),
});

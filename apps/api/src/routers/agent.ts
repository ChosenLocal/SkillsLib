/**
 * Agent Router
 *
 * tRPC router for agent execution tracking and management.
 * Handles agent execution queries, evaluations, and retry operations.
 */

import { router, protectedProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { AgentRoleSchema, AgentLayerSchema, AgentStatusSchema } from '@business-automation/schema';

export const agentRouter = router({
  /**
   * Get agent executions for a project with filters
   */
  getExecutions: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        filters: z
          .object({
            status: AgentStatusSchema.optional(),
            layer: AgentLayerSchema.optional(),
            agentRole: AgentRoleSchema.optional(),
          })
          .optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify project exists and belongs to tenant
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

      // Build WHERE clause
      const where: any = {
        projectId: input.projectId,
        tenantId: ctx.user.tenantId,
      };

      if (input.filters?.status) {
        where.status = input.filters.status.toUpperCase();
      }

      if (input.filters?.layer) {
        where.layer = input.filters.layer.toUpperCase();
      }

      if (input.filters?.agentRole) {
        where.agentRole = input.filters.agentRole.toUpperCase();
      }

      // Query with pagination
      const agents = await ctx.prisma.agentExecution.findMany({
        where,
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
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

      const hasMore = agents.length > input.limit;
      const items = hasMore ? agents.slice(0, input.limit) : agents;
      const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]!.id : null;

      return {
        items,
        nextCursor,
      };
    }),

  /**
   * Get a single agent execution by ID
   */
  getById: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const agent = await ctx.prisma.agentExecution.findFirst({
        where: {
          id: input.id,
          tenantId: ctx.user.tenantId,
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          workflowExecution: {
            select: {
              id: true,
              workflowType: true,
              status: true,
              progressPercentage: true,
            },
          },
        },
      });

      if (!agent) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Agent execution not found',
        });
      }

      return agent;
    }),

  /**
   * Get latest evaluation for a project
   */
  getLatestEvaluation: protectedProcedure
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
      });

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      // Get quality grading agents with evaluations
      const allEvaluations = await ctx.prisma.agentExecution.findMany({
        where: {
          projectId: input.projectId,
          tenantId: ctx.user.tenantId,
          layer: 'QUALITY',
          status: 'COMPLETED',
        },
        orderBy: {
          completedAt: 'desc',
        },
        take: 5,
        select: {
          id: true,
          agentName: true,
          agentRole: true,
          evaluation: true,
          completedAt: true,
        },
      });

      // Filter out evaluations with null evaluation data
      const evaluations = allEvaluations.filter((e) => e.evaluation !== null);

      if (evaluations.length === 0) {
        return null;
      }

      // Aggregate scores
      const scores: Record<string, number[]> = {};
      evaluations.forEach((evaluation) => {
        if (evaluation.evaluation && typeof evaluation.evaluation === 'object') {
          const evalData = evaluation.evaluation as any;
          if (evalData.scores) {
            Object.entries(evalData.scores).forEach(([key, value]) => {
              if (typeof value === 'number') {
                if (!scores[key]) scores[key] = [];
                scores[key].push(value);
              }
            });
          }
        }
      });

      // Calculate averages
      const aggregated: Record<string, number> = {};
      Object.entries(scores).forEach(([key, values]) => {
        aggregated[key] = values.reduce((sum, val) => sum + val, 0) / values.length;
      });

      return {
        evaluations,
        aggregatedScores: aggregated,
        evaluationCount: evaluations.length,
        latestAt: evaluations[0]!.completedAt,
      };
    }),

  /**
   * Retry a failed agent execution
   */
  retryAgent: protectedProcedure
    .input(
      z.object({
        agentExecutionId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get original agent execution
      const original = await ctx.prisma.agentExecution.findFirst({
        where: {
          id: input.agentExecutionId,
          tenantId: ctx.user.tenantId,
        },
      });

      if (!original) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Agent execution not found',
        });
      }

      if (original.status !== 'FAILED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Can only retry failed agent executions',
        });
      }

      // Mark original as cancelled
      await ctx.prisma.agentExecution.update({
        where: {
          id: input.agentExecutionId,
        },
        data: {
          status: 'CANCELLED',
          metadata: {
            ...(original.metadata as any),
            retriedBy: ctx.user.id,
            retriedAt: new Date().toISOString(),
          },
        },
      });

      // Create new agent execution with incremented iteration
      const newAgent = await ctx.prisma.agentExecution.create({
        data: {
          tenantId: ctx.user.tenantId,
          projectId: original.projectId,
          workflowExecutionId: original.workflowExecutionId,
          agentName: original.agentName,
          agentRole: original.agentRole,
          layer: original.layer,
          config: original.config as any,
          status: 'PENDING',
          iteration: original.iteration + 1,
          input: original.input as any,
          metadata: {
            retryOf: original.id,
            originalIteration: original.iteration,
            retriggeredBy: ctx.user.id,
          },
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
              status: true,
            },
          },
        },
      });

      // TODO: Trigger agent execution in background

      return newAgent;
    }),

  /**
   * List agent executions for a workflow
   */
  listByWorkflow: protectedProcedure
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
      });

      if (!workflow) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workflow execution not found',
        });
      }

      // Get all agent executions grouped by layer
      const agents = await ctx.prisma.agentExecution.findMany({
        where: {
          workflowExecutionId: input.workflowExecutionId,
          tenantId: ctx.user.tenantId,
        },
        orderBy: [
          { layer: 'asc' },
          { createdAt: 'asc' },
        ],
      });

      // Group by layer
      const grouped: Record<string, typeof agents> = {
        ORCHESTRATOR: [],
        DISCOVERY: [],
        DESIGN: [],
        CONTENT: [],
        CODE: [],
        QUALITY: [],
      };

      agents.forEach((agent) => {
        if (agent.layer && grouped[agent.layer]) {
          grouped[agent.layer]!.push(agent);
        }
      });

      return grouped;
    }),
});

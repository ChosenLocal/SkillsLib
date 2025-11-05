/**
 * Workflow Router
 *
 * tRPC router for workflow execution management.
 * Handles workflow lifecycle: execute, pause, resume, cancel, and status tracking.
 */

import { router, protectedProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { WorkflowTypeSchema } from '@business-automation/schema';
// TODO: Setup agents/jobs package for workflow execution
// import { sendWorkflowExecute } from '@business-automation/agents/jobs';

/**
 * Workflow configuration schema
 */
const WorkflowConfigSchema = z.object({
  maxRetries: z.number().default(3),
  timeout: z.number().optional(),
  parallelism: z.number().default(5),
  iterativeRefinement: z.boolean().default(true),
  maxIterations: z.number().default(3),
});

export const workflowRouter = router({
  /**
   * Execute a new workflow for a project
   */
  execute: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        workflowType: WorkflowTypeSchema,
        config: WorkflowConfigSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
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

      // Create workflow execution
      const config = input.config || {
        maxRetries: 3,
        parallelism: 5,
        iterativeRefinement: true,
        maxIterations: 3,
      };

      const workflowExecution = await ctx.prisma.workflowExecution.create({
        data: {
          tenantId: ctx.user.tenantId,
          projectId: input.projectId,
          workflowId: `workflow-${input.workflowType}-${Date.now()}`,
          workflowType: input.workflowType.toUpperCase() as any,
          workflowVersion: '1.0.0',
          status: 'QUEUED',
          totalSteps: 0,
          completedSteps: 0,
          progressPercentage: 0,
          input: {},
          output: {},
          context: config,
          retryCount: 0,
          iteration: 1,
          maxIterations: config.maxIterations,
          shouldContinueIteration: false,
          metadata: {
            startedBy: ctx.user.id,
          },
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

      // TODO: Trigger workflow execution via Inngest
      // await sendWorkflowExecute({
      //   workflowDefinitionId: workflowExecution.id,
      //   projectId: input.projectId,
      //   tenantId: ctx.user.tenantId,
      //   userId: ctx.user.id,
      //   input: {},
      // });

      return workflowExecution;
    }),

  /**
   * Pause a running workflow
   */
  pause: protectedProcedure
    .input(
      z.object({
        workflowExecutionId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify workflow exists and belongs to tenant
      const existing = await ctx.prisma.workflowExecution.findFirst({
        where: {
          id: input.workflowExecutionId,
          tenantId: ctx.user.tenantId,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workflow execution not found',
        });
      }

      if (existing.status !== 'RUNNING') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Can only pause running workflows',
        });
      }

      const workflow = await ctx.prisma.workflowExecution.update({
        where: {
          id: input.workflowExecutionId,
        },
        data: {
          status: 'PAUSED',
          pausedAt: new Date(),
        },
      });

      return workflow;
    }),

  /**
   * Resume a paused workflow
   */
  resume: protectedProcedure
    .input(
      z.object({
        workflowExecutionId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify workflow exists and belongs to tenant
      const existing = await ctx.prisma.workflowExecution.findFirst({
        where: {
          id: input.workflowExecutionId,
          tenantId: ctx.user.tenantId,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workflow execution not found',
        });
      }

      if (existing.status !== 'PAUSED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Can only resume paused workflows',
        });
      }

      const workflow = await ctx.prisma.workflowExecution.update({
        where: {
          id: input.workflowExecutionId,
        },
        data: {
          status: 'RUNNING',
          pausedAt: null,
        },
      });

      // TODO: Resume workflow engine

      return workflow;
    }),

  /**
   * Cancel a workflow
   */
  cancel: protectedProcedure
    .input(
      z.object({
        workflowExecutionId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify workflow exists and belongs to tenant
      const existing = await ctx.prisma.workflowExecution.findFirst({
        where: {
          id: input.workflowExecutionId,
          tenantId: ctx.user.tenantId,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workflow execution not found',
        });
      }

      if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(existing.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot cancel a workflow that is already finished',
        });
      }

      // Cancel workflow
      const workflow = await ctx.prisma.workflowExecution.update({
        where: {
          id: input.workflowExecutionId,
        },
        data: {
          status: 'CANCELLED',
          completedAt: new Date(),
        },
      });

      // Cancel all running agents
      await ctx.prisma.agentExecution.updateMany({
        where: {
          workflowExecutionId: input.workflowExecutionId,
          status: {
            in: ['PENDING', 'RUNNING'],
          },
        },
        data: {
          status: 'CANCELLED',
          completedAt: new Date(),
        },
      });

      return workflow;
    }),

  /**
   * Get workflow status with agent details
   */
  getStatus: protectedProcedure
    .input(
      z.object({
        workflowExecutionId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const workflow = await ctx.prisma.workflowExecution.findFirst({
        where: {
          id: input.workflowExecutionId,
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
          agentExecutions: {
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });

      if (!workflow) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workflow execution not found',
        });
      }

      return workflow;
    }),

  /**
   * List workflow executions for a project
   */
  listByProject: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
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

      const workflows = await ctx.prisma.workflowExecution.findMany({
        where: {
          projectId: input.projectId,
          tenantId: ctx.user.tenantId,
        },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          _count: {
            select: {
              agentExecutions: true,
            },
          },
        },
      });

      const hasMore = workflows.length > input.limit;
      const items = hasMore ? workflows.slice(0, input.limit) : workflows;
      const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]!.id : null;

      return {
        items,
        nextCursor,
      };
    }),
});

import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { WorkflowTypeSchema, WorkflowStatusSchema } from '@business-automation/schema';

export const workflowsRouter = router({
  /**
   * List workflow executions for a project
   */
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid().optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
        status: WorkflowStatusSchema.optional(),
        type: WorkflowTypeSchema.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { projectId, limit, cursor, status, type } = input;

      const executions = await ctx.prisma.workflowExecution.findMany({
        where: {
          tenantId: ctx.user.tenantId,
          ...(projectId && { projectId }),
          ...(status && { status }),
          ...(type && { workflowType: type }),
        },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
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
          workflowDefinition: {
            select: {
              id: true,
              name: true,
              version: true,
            },
          },
          _count: {
            select: {
              agentExecutions: true,
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
   * Get a single workflow execution by ID
   */
  get: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const execution = await ctx.prisma.workflowExecution.findFirst({
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
          workflowDefinition: true,
          agentExecutions: {
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      });

      if (!execution) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workflow execution not found',
        });
      }

      return execution;
    }),

  /**
   * Get workflow progress and status
   */
  progress: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const execution = await ctx.prisma.workflowExecution.findFirst({
        where: {
          id: input.id,
          tenantId: ctx.user.tenantId,
        },
        select: {
          id: true,
          status: true,
          currentStep: true,
          currentStepName: true,
          totalSteps: true,
          completedSteps: true,
          progressPercentage: true,
          iteration: true,
          maxIterations: true,
          startedAt: true,
          completedAt: true,
          error: true,
        },
      });

      if (!execution) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workflow execution not found',
        });
      }

      return execution;
    }),

  /**
   * Start a new workflow execution
   */
  start: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        workflowDefinitionId: z.string().uuid(),
        input: z.record(z.any()).default({}),
      })
    )
    .mutation(async ({ ctx, input }) => {
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

      // Get workflow definition
      const definition = await ctx.prisma.workflowDefinition.findFirst({
        where: {
          id: input.workflowDefinitionId,
          tenantId: ctx.user.tenantId,
          isActive: true,
        },
      });

      if (!definition) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workflow definition not found or inactive',
        });
      }

      // Count total steps
      const steps = definition.steps as any[];
      const totalSteps = steps.length;

      // Create workflow execution
      const execution = await ctx.prisma.workflowExecution.create({
        data: {
          tenantId: ctx.user.tenantId,
          projectId: input.projectId,
          workflowId: definition.id,
          workflowType: definition.type,
          workflowVersion: definition.version,
          status: 'QUEUED',
          totalSteps,
          completedSteps: 0,
          progressPercentage: 0,
          input: input.input,
          context: {},
          iteration: 1,
          maxIterations: (definition.config as any).maxIterations || 3,
        },
      });

      // TODO: Dispatch to workflow engine (Inngest/BullMQ) in Phase 7

      return execution;
    }),

  /**
   * Pause a running workflow
   */
  pause: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const execution = await ctx.prisma.workflowExecution.findFirst({
        where: {
          id: input.id,
          tenantId: ctx.user.tenantId,
        },
      });

      if (!execution) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workflow execution not found',
        });
      }

      if (execution.status !== 'RUNNING') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Can only pause running workflows',
        });
      }

      const updated = await ctx.prisma.workflowExecution.update({
        where: { id: input.id },
        data: {
          status: 'PAUSED',
          pausedAt: new Date(),
        },
      });

      return updated;
    }),

  /**
   * Resume a paused workflow
   */
  resume: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const execution = await ctx.prisma.workflowExecution.findFirst({
        where: {
          id: input.id,
          tenantId: ctx.user.tenantId,
        },
      });

      if (!execution) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workflow execution not found',
        });
      }

      if (execution.status !== 'PAUSED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Can only resume paused workflows',
        });
      }

      const updated = await ctx.prisma.workflowExecution.update({
        where: { id: input.id },
        data: {
          status: 'RUNNING',
          pausedAt: null,
        },
      });

      // TODO: Resume in workflow engine in Phase 7

      return updated;
    }),

  /**
   * Cancel a workflow execution
   */
  cancel: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const execution = await ctx.prisma.workflowExecution.findFirst({
        where: {
          id: input.id,
          tenantId: ctx.user.tenantId,
        },
      });

      if (!execution) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workflow execution not found',
        });
      }

      if (!['QUEUED', 'RUNNING', 'PAUSED'].includes(execution.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Can only cancel queued, running, or paused workflows',
        });
      }

      const updated = await ctx.prisma.workflowExecution.update({
        where: { id: input.id },
        data: {
          status: 'CANCELLED',
        },
      });

      // TODO: Cancel in workflow engine in Phase 7

      return updated;
    }),
});

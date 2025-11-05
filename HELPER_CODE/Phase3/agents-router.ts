// apps/api/src/routers/agents.router.ts
import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import { EventEmitter } from 'events';
import { enqueueAgent } from '../../workers/agent-worker';
import { sendPhaseEvent } from '@business-automation/workflows/orchestrator/master-orchestrator';
import { ClientProfileSchema } from '@business-automation/schema';
import { Redis } from 'ioredis';

// Event emitter for real-time updates
const agentEvents = new EventEmitter();

// Redis for state management
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

// Project status schema
const ProjectStatusSchema = z.object({
  projectId: z.string(),
  status: z.enum(['pending', 'planning', 'building', 'validating', 'deploying', 'completed', 'failed']),
  currentPhase: z.string(),
  progress: z.number(), // 0-100
  startedAt: z.string(),
  completedAt: z.string().optional(),
  error: z.string().optional(),
  metrics: z.object({
    totalAgents: z.number(),
    completedAgents: z.number(),
    failedAgents: z.number(),
    tokensUsed: z.number(),
  }).optional(),
});

export const agentsRouter = router({
  // Start a new website build
  startBuild: protectedProcedure
    .input(z.object({
      clientProfile: ClientProfileSchema,
      options: z.object({
        fastMode: z.boolean().default(false),
        skipValidation: z.boolean().default(false),
        deployTarget: z.enum(['preview', 'production']).default('preview'),
      }).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const projectId = `proj-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
      // Initialize project in Redis
      await redis.set(
        `project:${projectId}`,
        JSON.stringify({
          projectId,
          status: 'planning',
          currentPhase: 'planning',
          progress: 0,
          startedAt: new Date().toISOString(),
          userId: ctx.user.id,
          clientProfile: input.clientProfile,
          options: input.options,
        }),
        'EX',
        86400 // 24 hour expiry
      );

      // Trigger master orchestrator
      await sendPhaseEvent({
        type: 'project.created',
        projectId,
        clientSchema: input.clientProfile,
      });

      return {
        projectId,
        status: 'started',
        message: 'Build process initiated',
      };
    }),

  // Get project status
  getProjectStatus: publicProcedure
    .input(z.object({
      projectId: z.string(),
    }))
    .query(async ({ input }) => {
      const data = await redis.get(`project:${input.projectId}`);
      
      if (!data) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      return ProjectStatusSchema.parse(JSON.parse(data));
    }),

  // Subscribe to project progress
  subscribeToProgress: publicProcedure
    .input(z.object({
      projectId: z.string(),
    }))
    .subscription(({ input }) => {
      return observable<{
        type: string;
        data: any;
        timestamp: string;
      }>((emit) => {
        const onProgress = (data: any) => {
          if (data.projectId === input.projectId) {
            emit.next({
              type: data.type,
              data: data.data,
              timestamp: new Date().toISOString(),
            });
          }
        };

        const onComplete = (data: any) => {
          if (data.projectId === input.projectId) {
            emit.next({
              type: 'complete',
              data: data,
              timestamp: new Date().toISOString(),
            });
            emit.complete();
          }
        };

        const onError = (data: any) => {
          if (data.projectId === input.projectId) {
            emit.error(new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: data.error,
            }));
          }
        };

        agentEvents.on('progress', onProgress);
        agentEvents.on('complete', onComplete);
        agentEvents.on('error', onError);

        return () => {
          agentEvents.off('progress', onProgress);
          agentEvents.off('complete', onComplete);
          agentEvents.off('error', onError);
        };
      });
    }),

  // Get agent execution history
  getAgentHistory: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      agentId: z.string().optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ input }) => {
      const pattern = input.agentId 
        ? `agent-result:${input.projectId}:${input.agentId}:*`
        : `agent-result:${input.projectId}:*`;
      
      const keys = await redis.keys(pattern);
      const results = [];

      for (const key of keys.slice(0, input.limit)) {
        const data = await redis.get(key);
        if (data) {
          results.push(JSON.parse(data));
        }
      }

      return results.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    }),

  // Manually trigger a specific agent
  runAgent: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      agentId: z.string(),
      input: z.any(),
      phase: z.enum(['plan', 'synthesize', 'validate', 'deploy']),
    }))
    .mutation(async ({ input }) => {
      const runId = `manual-${Date.now()}`;
      
      const jobId = await enqueueAgent(input.agentId, {
        projectId: input.projectId,
        runId,
        phase: input.phase,
        input: input.input,
        context: {
          workspace: `/tmp/workspace/${input.projectId}`,
          retryCount: 0,
        },
      });

      return {
        jobId,
        runId,
        message: `Agent ${input.agentId} queued for execution`,
      };
    }),

  // Cancel a running project
  cancelProject: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Update project status
      const projectData = await redis.get(`project:${input.projectId}`);
      if (!projectData) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      const project = JSON.parse(projectData);
      if (project.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Not authorized to cancel this project',
        });
      }

      project.status = 'failed';
      project.error = input.reason || 'Cancelled by user';
      project.completedAt = new Date().toISOString();

      await redis.set(
        `project:${input.projectId}`,
        JSON.stringify(project),
        'EX',
        86400
      );

      // Emit cancellation event
      agentEvents.emit('error', {
        projectId: input.projectId,
        error: 'Project cancelled',
        reason: input.reason,
      });

      return {
        status: 'cancelled',
        message: 'Project cancelled successfully',
      };
    }),

  // Get available agents
  listAgents: publicProcedure
    .query(async () => {
      return {
        strategy: [
          { id: 'planner', name: 'Planner', status: 'active' },
          { id: 'brand-interpreter', name: 'Brand Interpreter', status: 'active' },
          { id: 'ia-architect', name: 'IA Architect', status: 'active' },
          { id: 'backlog-manager', name: 'Backlog Manager', status: 'active' },
        ],
        build: [
          { id: 'scaffolder', name: 'Scaffolder', status: 'active' },
          { id: 'design-system-synthesizer', name: 'Design System Synthesizer', status: 'active' },
          { id: 'page-planner', name: 'Page Planner', status: 'active' },
          { id: 'component-worker', name: 'Component Worker', status: 'active', scalable: true },
          { id: 'page-assembler', name: 'Page Assembler', status: 'active', scalable: true },
          { id: 'copywriter', name: 'Copywriter', status: 'active' },
          { id: 'media-generator', name: 'Media Generator', status: 'active' },
          { id: 'integration-fitter', name: 'Integration Fitter', status: 'active' },
        ],
        quality: [
          { id: 'static-analyzer', name: 'Static Analyzer', status: 'active' },
          { id: 'a11y-grader', name: 'A11y Grader', status: 'active' },
          { id: 'seo-grader', name: 'SEO Grader', status: 'active' },
          { id: 'perf-grader', name: 'Performance Grader', status: 'active' },
          { id: 'fixer', name: 'Fixer', status: 'active' },
          { id: 'regenerator', name: 'Regenerator', status: 'active' },
          { id: 'deployer', name: 'Deployer', status: 'active' },
        ],
      };
    }),

  // Get worker health
  getWorkerHealth: publicProcedure
    .query(async () => {
      // This would import from the worker file
      const { getWorkerHealth } = await import('../../workers/agent-worker');
      return await getWorkerHealth();
    }),
});

// Listen to Redis pub/sub for agent events
const subscriber = redis.duplicate();
subscriber.subscribe('agent-events');
subscriber.on('message', (channel, message) => {
  try {
    const event = JSON.parse(message);
    agentEvents.emit(event.type, event);
  } catch (error) {
    console.error('Failed to parse agent event:', error);
  }
});

// Export type for client
export type AgentsRouter = typeof agentsRouter;

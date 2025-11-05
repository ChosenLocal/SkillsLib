// apps/workers/agent-worker.ts
import { Worker, Queue, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { Inngest } from 'inngest';
import { BaseAgent } from '@business-automation/agents/shared/base-agent';
import { createPlannerAgent } from '@business-automation/agents/strategy/planner-agent';
import { z } from 'zod';
import pino from 'pino';

// Job payload schema
const AgentJobSchema = z.object({
  agentId: z.string(),
  projectId: z.string(),
  runId: z.string(),
  phase: z.enum(['plan', 'synthesize', 'validate', 'deploy']),
  input: z.any(),
  context: z.object({
    workspace: z.string(),
    previousResults: z.any().optional(),
    retryCount: z.number().default(0),
  }),
});

type AgentJob = z.infer<typeof AgentJobSchema>;

// Agent registry - maps agent IDs to factory functions
const AGENT_REGISTRY: Record<string, () => BaseAgent> = {
  'planner': createPlannerAgent,
  // Add more agents as they're implemented:
  // 'brand-interpreter': createBrandInterpreterAgent,
  // 'ia-architect': createIAArchitectAgent,
  // 'scaffolder': createScaffolderAgent,
  // etc.
};

// Initialize services
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
  },
});

const inngest = new Inngest({ 
  id: 'business-automation-worker',
  eventKey: process.env.INNGEST_EVENT_KEY,
});

// Queue configuration by tier
const QUEUE_CONFIG = {
  strategy: {
    concurrency: 4, // 4 always-on strategy agents
    limiter: {
      max: 10,
      duration: 60000, // per minute
    },
  },
  build: {
    concurrency: 10, // 6 core + N ephemeral
    limiter: {
      max: 50,
      duration: 60000,
    },
  },
  quality: {
    concurrency: 5, // 5 core quality agents
    limiter: {
      max: 20,
      duration: 60000,
    },
  },
};

// Create queues for each tier
const queues = {
  strategy: new Queue('strategy-agents', { connection: redis }),
  build: new Queue('build-agents', { connection: redis }),
  quality: new Queue('quality-agents', { connection: redis }),
};

// Get queue for agent
function getQueueForAgent(agentId: string): Queue {
  // Map agents to their tiers
  const tierMap: Record<string, keyof typeof queues> = {
    'planner': 'strategy',
    'brand-interpreter': 'strategy',
    'ia-architect': 'strategy',
    'backlog-manager': 'strategy',
    'scaffolder': 'build',
    'design-system-synthesizer': 'build',
    'page-planner': 'build',
    'component-worker': 'build',
    'page-assembler': 'build',
    'copywriter': 'build',
    'media-generator': 'build',
    'integration-fitter': 'build',
    'static-analyzer': 'quality',
    'a11y-grader': 'quality',
    'seo-grader': 'quality',
    'perf-grader': 'quality',
    'fixer': 'quality',
    'regenerator': 'quality',
    'deployer': 'quality',
  };

  return queues[tierMap[agentId] || 'build'];
}

// Worker processor function
async function processAgentJob(job: Job<AgentJob>): Promise<any> {
  const { agentId, projectId, runId, phase, input, context } = job.data;
  
  logger.info({ 
    agentId, 
    projectId, 
    runId, 
    phase,
    jobId: job.id 
  }, 'Processing agent job');

  // Get agent factory
  const agentFactory = AGENT_REGISTRY[agentId];
  if (!agentFactory) {
    throw new Error(`Unknown agent: ${agentId}`);
  }

  // Create agent instance
  const agent = agentFactory();
  
  try {
    // Initialize MCP servers if needed
    await agent.initializeMCP();

    // Create execution context
    const agentContext = {
      projectId,
      runId,
      phase,
      workspace: context.workspace || `/tmp/workspace/${projectId}`,
      redis,
      logger: logger.child({ agentId }),
    };

    // Execute agent
    const result = await agent.execute(input, agentContext);

    // Update job progress
    await job.updateProgress(100);

    // Send completion event to Inngest
    if (result.success) {
      await inngest.send({
        name: `agent.${agentId}.completed`,
        data: {
          projectId,
          runId,
          agentId,
          result: result.data,
          metadata: result.metadata,
        },
      });
    } else {
      await inngest.send({
        name: `agent.${agentId}.failed`,
        data: {
          projectId,
          runId,
          agentId,
          error: result.error,
          metadata: result.metadata,
        },
      });
    }

    return result;
  } finally {
    // Cleanup
    await agent.dispose();
  }
}

// Create workers for each tier
const workers = {
  strategy: new Worker('strategy-agents', processAgentJob, {
    connection: redis,
    concurrency: QUEUE_CONFIG.strategy.concurrency,
    limiter: QUEUE_CONFIG.strategy.limiter,
  }),
  
  build: new Worker('build-agents', processAgentJob, {
    connection: redis,
    concurrency: QUEUE_CONFIG.build.concurrency,
    limiter: QUEUE_CONFIG.build.limiter,
  }),
  
  quality: new Worker('quality-agents', processAgentJob, {
    connection: redis,
    concurrency: QUEUE_CONFIG.quality.concurrency,
    limiter: QUEUE_CONFIG.quality.limiter,
  }),
};

// Worker event handlers
Object.entries(workers).forEach(([tier, worker]) => {
  worker.on('completed', (job) => {
    logger.info({ 
      tier, 
      jobId: job.id, 
      agentId: job.data.agentId 
    }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ 
      tier, 
      jobId: job?.id, 
      agentId: job?.data.agentId,
      error: err.message 
    }, 'Job failed');
  });

  worker.on('stalled', (jobId) => {
    logger.warn({ tier, jobId }, 'Job stalled');
  });
});

// Enqueue helper function (exported for use in Inngest workflows)
export async function enqueueAgent(
  agentId: string,
  job: Omit<AgentJob, 'agentId'>
): Promise<string> {
  const queue = getQueueForAgent(agentId);
  
  const bullJob = await queue.add(
    agentId,
    {
      agentId,
      ...job,
    },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 3600, // Keep completed jobs for 1 hour
        count: 100,
      },
      removeOnFail: {
        age: 86400, // Keep failed jobs for 24 hours
      },
    }
  );

  logger.info({ 
    agentId, 
    jobId: bullJob.id,
    projectId: job.projectId 
  }, 'Agent job enqueued');

  return bullJob.id!;
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down workers...');
  
  await Promise.all([
    ...Object.values(workers).map(w => w.close()),
    ...Object.values(queues).map(q => q.close()),
    redis.quit(),
  ]);
  
  process.exit(0);
});

// Health check endpoint (if needed)
export async function getWorkerHealth() {
  const health = {
    redis: redis.status === 'ready',
    queues: {},
    workers: {},
  };

  for (const [name, queue] of Object.entries(queues)) {
    const counts = await queue.getJobCounts();
    health.queues[name] = {
      waiting: counts.waiting,
      active: counts.active,
      completed: counts.completed,
      failed: counts.failed,
    };
  }

  for (const [name, worker] of Object.entries(workers)) {
    health.workers[name] = {
      running: worker.isRunning(),
      concurrency: worker.concurrency,
    };
  }

  return health;
}

logger.info('Agent workers started');

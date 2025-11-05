// packages/workflows/orchestrator/master-orchestrator.ts
import { Inngest } from 'inngest';
import { z } from 'zod';

// Event schemas for phase transitions
export const PhaseEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('project.created'),
    projectId: z.string(),
    clientSchema: z.any(),
  }),
  z.object({
    type: z.literal('spec.created'),
    projectId: z.string(),
    runId: z.string(),
    spec: z.any(),
  }),
  z.object({
    type: z.literal('spec.failed'),
    projectId: z.string(),
    runId: z.string(),
    error: z.any(),
    retryCount: z.number(),
  }),
  z.object({
    type: z.literal('synthesis.completed'),
    projectId: z.string(),
    runId: z.string(),
    artifacts: z.array(z.string()),
  }),
  z.object({
    type: z.literal('synthesis.failed'),
    projectId: z.string(),
    runId: z.string(),
    error: z.any(),
  }),
  z.object({
    type: z.literal('validation.passed'),
    projectId: z.string(),
    runId: z.string(),
    report: z.any(),
  }),
  z.object({
    type: z.literal('validation.failed'),
    projectId: z.string(),
    runId: z.string(),
    findings: z.array(z.any()),
  }),
  z.object({
    type: z.literal('deploy.succeeded'),
    projectId: z.string(),
    runId: z.string(),
    urls: z.object({
      preview: z.string().optional(),
      production: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal('deploy.failed'),
    projectId: z.string(),
    runId: z.string(),
    error: z.any(),
  }),
  z.object({
    type: z.literal('fix.requested'),
    projectId: z.string(),
    runId: z.string(),
    findings: z.array(z.any()),
    budget: z.number(),
  }),
]);

export type PhaseEvent = z.infer<typeof PhaseEventSchema>;

// Project state machine
export const ProjectStateSchema = z.object({
  projectId: z.string(),
  currentPhase: z.enum(['initializing', 'planning', 'synthesizing', 'validating', 'fixing', 'deploying', 'completed', 'failed']),
  runId: z.string(),
  iterations: z.number().default(0),
  maxIterations: z.number().default(5),
  spec: z.any().optional(),
  artifacts: z.array(z.string()).optional(),
  deployments: z.array(z.object({
    environment: z.enum(['preview', 'production']),
    url: z.string(),
    timestamp: z.string(),
  })).optional(),
  errors: z.array(z.any()).optional(),
});

export type ProjectState = z.infer<typeof ProjectStateSchema>;

// Initialize Inngest client
const inngest = new Inngest({ 
  id: 'business-automation',
  eventKey: process.env.INNGEST_EVENT_KEY,
});

// Master orchestrator workflow
export const masterOrchestrator = inngest.createFunction(
  {
    id: 'master-orchestrator',
    name: 'Master Build Orchestrator',
    concurrency: {
      limit: 10,
      key: 'event.data.projectId',
    },
    retries: 3,
  },
  { event: 'project.created' },
  async ({ event, step }) => {
    const { projectId, clientSchema } = event.data;
    
    // Initialize project state
    const state = await step.run('initialize-state', async () => {
      const initialState: ProjectState = {
        projectId,
        currentPhase: 'planning',
        runId: generateRunId(),
        iterations: 0,
        maxIterations: 5,
      };
      
      await saveProjectState(projectId, initialState);
      return initialState;
    });

    // Phase 1: Planning (Strategy Tier)
    const spec = await step.run('planning-phase', async () => {
      await step.sendEvent({
        name: 'phase.planning.start',
        data: {
          projectId,
          runId: state.runId,
          clientSchema,
        },
      });

      // Wait for spec creation
      const specResult = await step.waitForEvent('planning-phase-complete', {
        event: 'spec.created',
        match: 'data.projectId',
        timeout: '30m',
      });

      if (!specResult) {
        throw new Error('Planning phase timeout');
      }

      return specResult.data.spec;
    });

    // Phase 2: Synthesis (Build Tier)
    const artifacts = await step.run('synthesis-phase', async () => {
      await step.sendEvent({
        name: 'phase.synthesis.start',
        data: {
          projectId,
          runId: state.runId,
          spec,
        },
      });

      const synthesisResult = await step.waitForEvent('synthesis-phase-complete', {
        event: 'synthesis.completed',
        match: 'data.projectId',
        timeout: '2h',
      });

      if (!synthesisResult) {
        throw new Error('Synthesis phase timeout');
      }

      return synthesisResult.data.artifacts;
    });

    // Phase 3: Validation (Quality Tier)
    const validationLoop = await step.run('validation-loop', async () => {
      let currentIteration = 0;
      let validationPassed = false;
      let lastFindings: any[] = [];

      while (currentIteration < state.maxIterations && !validationPassed) {
        await step.sendEvent({
          name: 'phase.validation.start',
          data: {
            projectId,
            runId: state.runId,
            artifacts,
            iteration: currentIteration,
          },
        });

        const validationResult = await step.waitForEvent(`validation-${currentIteration}`, {
          event: ['validation.passed', 'validation.failed'],
          match: 'data.projectId',
          timeout: '30m',
        });

        if (!validationResult) {
          throw new Error('Validation timeout');
        }

        if (validationResult.name === 'validation.passed') {
          validationPassed = true;
          return { passed: true, report: validationResult.data.report };
        }

        // Handle validation failures with fix cycle
        lastFindings = validationResult.data.findings;
        
        if (currentIteration < state.maxIterations - 1) {
          await step.sendEvent({
            name: 'fix.requested',
            data: {
              projectId,
              runId: state.runId,
              findings: lastFindings,
              budget: calculateFixBudget(currentIteration),
            },
          });

          // Wait for fixes to complete
          await step.waitForEvent(`fix-complete-${currentIteration}`, {
            event: 'synthesis.completed',
            match: 'data.projectId',
            timeout: '1h',
          });
        }

        currentIteration++;
      }

      return { passed: false, findings: lastFindings };
    });

    // Phase 4: Deployment
    if (validationLoop.passed) {
      const deployment = await step.run('deployment-phase', async () => {
        await step.sendEvent({
          name: 'phase.deploy.start',
          data: {
            projectId,
            runId: state.runId,
            artifacts,
            environment: 'preview', // Start with preview
          },
        });

        const deployResult = await step.waitForEvent('deploy-complete', {
          event: 'deploy.succeeded',
          match: 'data.projectId',
          timeout: '30m',
        });

        if (!deployResult) {
          throw new Error('Deployment timeout');
        }

        return deployResult.data.urls;
      });

      // Update final state
      await step.run('finalize-state', async () => {
        await updateProjectState(projectId, {
          currentPhase: 'completed',
          deployments: [
            {
              environment: 'preview',
              url: deployment.preview!,
              timestamp: new Date().toISOString(),
            },
          ],
        });
      });

      return {
        success: true,
        projectId,
        runId: state.runId,
        deployment,
      };
    } else {
      // Max iterations reached without passing validation
      await step.run('mark-as-failed', async () => {
        await updateProjectState(projectId, {
          currentPhase: 'failed',
          errors: validationLoop.findings,
        });
      });

      return {
        success: false,
        projectId,
        runId: state.runId,
        findings: validationLoop.findings,
      };
    }
  }
);

// Helper functions
function generateRunId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

function calculateFixBudget(iteration: number): number {
  // Increase budget with each iteration
  const baseBudget = 10; // 10 changes
  return baseBudget * Math.pow(2, iteration);
}

async function saveProjectState(projectId: string, state: ProjectState): Promise<void> {
  // Implementation would save to Redis/PostgreSQL
  console.log('Saving project state:', { projectId, state });
}

async function updateProjectState(projectId: string, updates: Partial<ProjectState>): Promise<void> {
  // Implementation would update in Redis/PostgreSQL
  console.log('Updating project state:', { projectId, updates });
}

// Export event sender helper
export const sendPhaseEvent = async (event: PhaseEvent) => {
  await inngest.send(event);
};

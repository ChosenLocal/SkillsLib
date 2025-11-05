/**
 * Inngest jobs for agent orchestration
 * @module @business-automation/agents/jobs
 */

// Re-export Inngest client
export * from './inngest-client';

// Re-export workflow functions
export * from './workflow-processor';

// Re-export agent functions
export * from './agent-executor';

// Export all functions for Inngest serve()
import { workflowFunctions } from './workflow-processor';
import { agentFunctions } from './agent-executor';

export const allFunctions = [
  ...workflowFunctions,
  ...agentFunctions,
];

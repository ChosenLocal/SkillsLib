import pino from 'pino';
import { env } from './env';

/**
 * Structured logging with Pino
 */

const isDevelopment = env.NODE_ENV === 'development';

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  serializers: {
    error: pino.stdSerializers.err,
  },
});

/**
 * Create a child logger with context
 */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Log agent execution
 */
export function logAgentExecution(data: {
  agentRole: string;
  projectId: string;
  tenantId: string;
  status: string;
  executionTimeMs?: number;
}) {
  logger.info(
    {
      type: 'agent_execution',
      ...data,
    },
    `Agent ${data.agentRole} ${data.status}`
  );
}

/**
 * Log workflow execution
 */
export function logWorkflowExecution(data: {
  workflowType: string;
  projectId: string;
  tenantId: string;
  status: string;
  progressPercentage?: number;
}) {
  logger.info(
    {
      type: 'workflow_execution',
      ...data,
    },
    `Workflow ${data.workflowType} ${data.status}`
  );
}

/**
 * Log error with context
 */
export function logError(error: Error, context?: Record<string, unknown>) {
  logger.error(
    {
      error,
      ...context,
    },
    error.message
  );
}

export default logger;

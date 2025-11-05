/**
 * Server-Sent Events type definitions
 */

export type SSEEventType =
  | 'connected'
  | 'workflow.progress'
  | 'agent.pending'
  | 'agent.running'
  | 'agent.completed'
  | 'agent.failed'
  | 'agent.cancelled';

export interface SSEBaseEvent {
  timestamp: string;
}

export interface ConnectedEvent extends SSEBaseEvent {
  projectId: string;
}

export interface WorkflowProgressEvent extends SSEBaseEvent {
  workflowExecutionId: string;
  status: string;
  currentStep: number;
  currentStepName: string;
  totalSteps: number;
  completedSteps: number;
  progressPercentage: number;
  iteration: number;
}

export interface AgentEvent extends SSEBaseEvent {
  agentExecutionId: string;
  agentRole: string;
  agentName: string;
  layer: string;
  status: string;
  iteration: number;
  executionTimeMs?: number;
}

export type SSEEvent =
  | { type: 'connected'; data: ConnectedEvent }
  | { type: 'workflow.progress'; data: WorkflowProgressEvent }
  | { type: 'agent.pending'; data: AgentEvent }
  | { type: 'agent.running'; data: AgentEvent }
  | { type: 'agent.completed'; data: AgentEvent }
  | { type: 'agent.failed'; data: AgentEvent }
  | { type: 'agent.cancelled'; data: AgentEvent };

export type SSEEventHandler = (event: SSEEvent) => void;

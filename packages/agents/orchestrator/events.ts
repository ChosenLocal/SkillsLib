import EventEmitter from 'events';
import type { AgentRole } from '@business-automation/database';
import { publishToStream, subscribeToStream } from '../shared/redis-client';

/**
 * Workflow event types
 */
export enum WorkflowEventType {
  WORKFLOW_STARTED = 'workflow.started',
  WORKFLOW_COMPLETED = 'workflow.completed',
  WORKFLOW_FAILED = 'workflow.failed',
  WORKFLOW_PAUSED = 'workflow.paused',
  WORKFLOW_RESUMED = 'workflow.resumed',
  WORKFLOW_CANCELLED = 'workflow.cancelled',

  AGENT_QUEUED = 'agent.queued',
  AGENT_STARTED = 'agent.started',
  AGENT_PROGRESS = 'agent.progress',
  AGENT_COMPLETED = 'agent.completed',
  AGENT_FAILED = 'agent.failed',
  AGENT_RETRYING = 'agent.retrying',

  REFINEMENT_STARTED = 'refinement.started',
  REFINEMENT_DECISION = 'refinement.decision',
  REFINEMENT_COMPLETED = 'refinement.completed',

  STAGE_STARTED = 'stage.started',
  STAGE_COMPLETED = 'stage.completed',
}

/**
 * Base workflow event
 */
export interface WorkflowEvent {
  type: WorkflowEventType;
  workflowExecutionId: string;
  timestamp: Date;
  data: any;
}

/**
 * Agent-specific event
 */
export interface AgentEvent extends WorkflowEvent {
  agentRole: AgentRole;
  agentExecutionId: string;
}

/**
 * Event bus for workflow orchestration
 */
export class WorkflowEventBus extends EventEmitter {
  private tenantId: string;
  private workflowExecutionId: string;
  private unsubscribe?: () => void;

  constructor(tenantId: string, workflowExecutionId: string) {
    super();
    this.tenantId = tenantId;
    this.workflowExecutionId = workflowExecutionId;
  }

  /**
   * Emit workflow event
   */
  async emitWorkflowEvent(type: WorkflowEventType, data: any): Promise<void> {
    const event: WorkflowEvent = {
      type,
      workflowExecutionId: this.workflowExecutionId,
      timestamp: new Date(),
      data,
    };

    // Emit locally
    this.emit(type, event);

    // Publish to Redis stream for persistence and SSE
    await this.publishToRedis(type, data);
  }

  /**
   * Emit agent event
   */
  async emitAgentEvent(
    type: WorkflowEventType,
    agentRole: AgentRole,
    agentExecutionId: string,
    data: any
  ): Promise<void> {
    const event: AgentEvent = {
      type,
      workflowExecutionId: this.workflowExecutionId,
      agentRole,
      agentExecutionId,
      timestamp: new Date(),
      data,
    };

    // Emit locally
    this.emit(type, event);
    this.emit(`agent.${agentRole}`, event);

    // Publish to Redis stream
    await this.publishToRedis(type, {
      ...data,
      agentRole,
      agentExecutionId,
    });
  }

  /**
   * Publish event to Redis stream
   */
  private async publishToRedis(eventType: WorkflowEventType, data: any): Promise<void> {
    try {
      await publishToStream(this.tenantId, `workflow:${this.workflowExecutionId}`, {
        eventType,
        workflowExecutionId: this.workflowExecutionId,
        timestamp: new Date().toISOString(),
        data: JSON.stringify(data),
      });
    } catch (error) {
      console.error('[EventBus] Failed to publish to Redis:', error);
      // Don't throw - local events still work
    }
  }

  /**
   * Subscribe to Redis stream (for distributed systems)
   */
  async subscribeToRedis(
    onEvent: (eventType: string, data: any) => void,
    lastId: string = '$'
  ): Promise<void> {
    this.unsubscribe = await subscribeToStream(
      this.tenantId,
      `workflow:${this.workflowExecutionId}`,
      async (message) => {
        try {
          const eventType = message.data.eventType;
          const data = JSON.parse(message.data.data);
          onEvent(eventType, data);
        } catch (error) {
          console.error('[EventBus] Failed to parse Redis message:', error);
        }
      },
      { lastId }
    );
  }

  /**
   * Unsubscribe from Redis stream
   */
  unsubscribeFromRedis(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
  }

  /**
   * Clean up
   */
  async cleanup(): Promise<void> {
    this.unsubscribeFromRedis();
    this.removeAllListeners();
  }
}

/**
 * Event bus factory
 */
class EventBusFactory {
  private buses: Map<string, WorkflowEventBus> = new Map();

  /**
   * Get or create event bus for workflow
   */
  getOrCreate(tenantId: string, workflowExecutionId: string): WorkflowEventBus {
    const key = `${tenantId}:${workflowExecutionId}`;

    let bus = this.buses.get(key);
    if (!bus) {
      bus = new WorkflowEventBus(tenantId, workflowExecutionId);
      this.buses.set(key, bus);
    }

    return bus;
  }

  /**
   * Remove event bus
   */
  async remove(tenantId: string, workflowExecutionId: string): Promise<void> {
    const key = `${tenantId}:${workflowExecutionId}`;
    const bus = this.buses.get(key);

    if (bus) {
      await bus.cleanup();
      this.buses.delete(key);
    }
  }

  /**
   * Get active bus count
   */
  getActiveCount(): number {
    return this.buses.size;
  }

  /**
   * Clean up all buses
   */
  async cleanupAll(): Promise<void> {
    const cleanupPromises = Array.from(this.buses.values()).map((bus) => bus.cleanup());
    await Promise.all(cleanupPromises);
    this.buses.clear();
  }
}

// Singleton factory
const eventBusFactory = new EventBusFactory();

/**
 * Get event bus for workflow
 */
export function getEventBus(tenantId: string, workflowExecutionId: string): WorkflowEventBus {
  return eventBusFactory.getOrCreate(tenantId, workflowExecutionId);
}

/**
 * Remove event bus (cleanup)
 */
export async function removeEventBus(tenantId: string, workflowExecutionId: string): Promise<void> {
  await eventBusFactory.remove(tenantId, workflowExecutionId);
}

/**
 * Workflow event listener helper
 */
export class WorkflowEventListener {
  private bus: WorkflowEventBus;
  private handlers: Map<string, Function> = new Map();

  constructor(tenantId: string, workflowExecutionId: string) {
    this.bus = getEventBus(tenantId, workflowExecutionId);
  }

  /**
   * Listen to specific event type
   */
  on(eventType: WorkflowEventType, handler: (event: WorkflowEvent) => void): void {
    this.handlers.set(eventType, handler);
    this.bus.on(eventType, handler);
  }

  /**
   * Listen to agent-specific events
   */
  onAgent(agentRole: AgentRole, handler: (event: AgentEvent) => void): void {
    const key = `agent.${agentRole}`;
    this.handlers.set(key, handler);
    this.bus.on(key, handler);
  }

  /**
   * Listen once to specific event
   */
  once(eventType: WorkflowEventType, handler: (event: WorkflowEvent) => void): void {
    this.bus.once(eventType, handler);
  }

  /**
   * Remove specific listener
   */
  off(eventType: WorkflowEventType): void {
    const handler = this.handlers.get(eventType);
    if (handler) {
      this.bus.off(eventType, handler);
      this.handlers.delete(eventType);
    }
  }

  /**
   * Remove all listeners
   */
  removeAll(): void {
    for (const [eventType, handler] of this.handlers.entries()) {
      this.bus.off(eventType, handler);
    }
    this.handlers.clear();
  }

  /**
   * Get event bus
   */
  getBus(): WorkflowEventBus {
    return this.bus;
  }
}

/**
 * Create event listener
 */
export function createEventListener(
  tenantId: string,
  workflowExecutionId: string
): WorkflowEventListener {
  return new WorkflowEventListener(tenantId, workflowExecutionId);
}

/**
 * Event logger for debugging
 */
export class EventLogger {
  private listener: WorkflowEventListener;
  private logs: WorkflowEvent[] = [];
  private maxLogs: number;

  constructor(tenantId: string, workflowExecutionId: string, maxLogs: number = 100) {
    this.listener = createEventListener(tenantId, workflowExecutionId);
    this.maxLogs = maxLogs;
    this.setupLogging();
  }

  /**
   * Setup logging for all events
   */
  private setupLogging(): void {
    // Listen to all workflow event types
    for (const eventType of Object.values(WorkflowEventType)) {
      this.listener.on(eventType as WorkflowEventType, (event) => {
        this.logEvent(event);
      });
    }
  }

  /**
   * Log an event
   */
  private logEvent(event: WorkflowEvent): void {
    this.logs.push(event);

    // Keep only last N logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console log
    console.log(`[Event] ${event.type}:`, event.data);
  }

  /**
   * Get all logged events
   */
  getLogs(): WorkflowEvent[] {
    return [...this.logs];
  }

  /**
   * Get logs by type
   */
  getLogsByType(eventType: WorkflowEventType): WorkflowEvent[] {
    return this.logs.filter((log) => log.type === eventType);
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Stop logging
   */
  stop(): void {
    this.listener.removeAll();
  }
}

/**
 * Create event logger
 */
export function createEventLogger(
  tenantId: string,
  workflowExecutionId: string,
  maxLogs?: number
): EventLogger {
  return new EventLogger(tenantId, workflowExecutionId, maxLogs);
}

/**
 * Wait for specific event
 */
export async function waitForEvent(
  tenantId: string,
  workflowExecutionId: string,
  eventType: WorkflowEventType,
  timeout?: number
): Promise<WorkflowEvent> {
  const bus = getEventBus(tenantId, workflowExecutionId);

  return new Promise((resolve, reject) => {
    let timeoutId: NodeJS.Timeout | undefined;

    const handler = (event: WorkflowEvent) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      resolve(event);
    };

    bus.once(eventType, handler);

    if (timeout) {
      timeoutId = setTimeout(() => {
        bus.off(eventType, handler);
        reject(new Error(`Timeout waiting for event: ${eventType}`));
      }, timeout);
    }
  });
}

/**
 * Batch event emitter for performance
 */
export class BatchEventEmitter {
  private bus: WorkflowEventBus;
  private batch: Array<{ type: WorkflowEventType; data: any }> = [];
  private batchSize: number;
  private flushInterval: number;
  private timer?: NodeJS.Timeout;

  constructor(
    tenantId: string,
    workflowExecutionId: string,
    batchSize: number = 10,
    flushInterval: number = 1000
  ) {
    this.bus = getEventBus(tenantId, workflowExecutionId);
    this.batchSize = batchSize;
    this.flushInterval = flushInterval;
    this.startTimer();
  }

  /**
   * Start flush timer
   */
  private startTimer(): void {
    this.timer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  /**
   * Add event to batch
   */
  async emit(type: WorkflowEventType, data: any): Promise<void> {
    this.batch.push({ type, data });

    if (this.batch.length >= this.batchSize) {
      await this.flush();
    }
  }

  /**
   * Flush pending events
   */
  async flush(): Promise<void> {
    if (this.batch.length === 0) {
      return;
    }

    const events = [...this.batch];
    this.batch = [];

    for (const event of events) {
      await this.bus.emitWorkflowEvent(event.type, event.data);
    }
  }

  /**
   * Stop batch emitter
   */
  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    await this.flush();
  }
}

/**
 * Create batch event emitter
 */
export function createBatchEventEmitter(
  tenantId: string,
  workflowExecutionId: string,
  batchSize?: number,
  flushInterval?: number
): BatchEventEmitter {
  return new BatchEventEmitter(tenantId, workflowExecutionId, batchSize, flushInterval);
}

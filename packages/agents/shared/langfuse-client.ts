import { Langfuse } from 'langfuse';
import type { TokenUsage } from './claude-client';

/**
 * Langfuse client singleton for distributed tracing
 */
class LangfuseClientManager {
  private static instance: LangfuseClientManager;
  private client: Langfuse | null = null;
  private enabled: boolean = false;

  private constructor() {}

  public static getInstance(): LangfuseClientManager {
    if (!LangfuseClientManager.instance) {
      LangfuseClientManager.instance = new LangfuseClientManager();
    }
    return LangfuseClientManager.instance;
  }

  /**
   * Initialize Langfuse client
   */
  public initialize(): void {
    if (this.client) {
      return; // Already initialized
    }

    const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
    const secretKey = process.env.LANGFUSE_SECRET_KEY;
    const baseUrl = process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com';

    // Check if Langfuse is configured
    if (!publicKey || !secretKey) {
      console.warn('[Langfuse] API keys not configured. Tracing will be disabled.');
      this.enabled = false;
      return;
    }

    this.client = new Langfuse({
      publicKey,
      secretKey,
      baseUrl,
    });

    this.enabled = true;
    console.log('[Langfuse] Client initialized successfully');
  }

  /**
   * Get Langfuse client instance
   */
  public getClient(): Langfuse | null {
    if (!this.client && !this.enabled) {
      this.initialize();
    }
    return this.client;
  }

  /**
   * Check if Langfuse is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Flush pending traces to Langfuse
   */
  public async flush(): Promise<void> {
    if (this.client) {
      await this.client.flushAsync();
    }
  }

  /**
   * Shutdown Langfuse client
   */
  public async shutdown(): Promise<void> {
    if (this.client) {
      await this.client.shutdownAsync();
      this.client = null;
    }
  }
}

// Singleton instance
const langfuseManager = LangfuseClientManager.getInstance();

/**
 * Get Langfuse client (may be null if not configured)
 */
export function getLangfuseClient(): Langfuse | null {
  return langfuseManager.getClient();
}

/**
 * Check if Langfuse tracing is enabled
 */
export function isLangfuseEnabled(): boolean {
  return langfuseManager.isEnabled();
}

/**
 * Flush pending traces
 */
export async function flushLangfuse(): Promise<void> {
  await langfuseManager.flush();
}

/**
 * Shutdown Langfuse
 */
export async function shutdownLangfuse(): Promise<void> {
  await langfuseManager.shutdown();
}

/**
 * Trace metadata
 */
export interface TraceMetadata {
  tenantId: string;
  workflowExecutionId: string;
  projectId?: string;
  userId?: string;
  sessionId?: string;
  [key: string]: any;
}

/**
 * Create a new trace for a workflow execution
 */
export function createTrace(
  name: string,
  traceId: string,
  metadata: TraceMetadata
) {
  const client = getLangfuseClient();
  if (!client) {
    return null;
  }

  const trace = client.trace({
    id: traceId,
    name,
    userId: metadata.userId,
    sessionId: metadata.sessionId,
    metadata: {
      tenantId: metadata.tenantId,
      workflowExecutionId: metadata.workflowExecutionId,
      projectId: metadata.projectId,
      ...metadata,
    },
  });

  return trace;
}

/**
 * Span metadata
 */
export interface SpanMetadata {
  agentExecutionId: string;
  agentRole: string;
  agentLayer: string;
  tenantId: string;
  [key: string]: any;
}

/**
 * Create a span for an agent execution
 */
export function createSpan(
  traceId: string,
  spanId: string,
  name: string,
  metadata: SpanMetadata,
  parentSpanId?: string
) {
  const client = getLangfuseClient();
  if (!client) {
    return null;
  }

  const trace = client.trace({ id: traceId });
  const span = trace.span({
    id: spanId,
    name,
    parentObservationId: parentSpanId,
    metadata: {
      agentExecutionId: metadata.agentExecutionId,
      agentRole: metadata.agentRole,
      agentLayer: metadata.agentLayer,
      tenantId: metadata.tenantId,
      ...metadata,
    },
  });

  return span;
}

/**
 * Generation input/output
 */
export interface GenerationData {
  model: string;
  input: {
    messages: Array<{ role: string; content: string }>;
    system?: string;
    temperature?: number;
    maxTokens?: number;
  };
  output?: string;
  usage?: TokenUsage;
  metadata?: Record<string, any>;
}

/**
 * Create a generation (LLM call) within a span
 */
export function createGeneration(
  traceId: string,
  spanId: string,
  generationId: string,
  name: string,
  data: GenerationData
) {
  const client = getLangfuseClient();
  if (!client) {
    return null;
  }

  const trace = client.trace({ id: traceId });
  const generation = trace.generation({
    id: generationId,
    name,
    parentObservationId: spanId,
    model: data.model,
    modelParameters: {
      temperature: data.input.temperature,
      maxTokens: data.input.maxTokens,
    },
    input: data.input,
    output: data.output,
    usage: data.usage
      ? {
          input: data.usage.inputTokens,
          output: data.usage.outputTokens,
          total: data.usage.inputTokens + data.usage.outputTokens,
          inputCost: data.usage.cacheCreationTokens,
          outputCost: data.usage.cacheReadTokens,
        }
      : undefined,
    metadata: data.metadata,
  });

  return generation;
}

/**
 * Update generation with output and usage
 */
export function updateGeneration(
  traceId: string,
  generationId: string,
  output: string,
  usage: TokenUsage
) {
  const client = getLangfuseClient();
  if (!client) {
    return;
  }

  const trace = client.trace({ id: traceId });
  trace.generation({
    id: generationId,
    output,
    usage: {
      input: usage.inputTokens,
      output: usage.outputTokens,
      total: usage.inputTokens + usage.outputTokens,
    },
  });
}

/**
 * Score data
 */
export interface ScoreData {
  name: string;
  value: number;
  comment?: string;
  dataType?: 'NUMERIC' | 'CATEGORICAL' | 'BOOLEAN';
}

/**
 * Add a score to a trace (for quality evaluation)
 */
export function addTraceScore(
  traceId: string,
  score: ScoreData
) {
  const client = getLangfuseClient();
  if (!client) {
    return;
  }

  client.score({
    traceId,
    name: score.name,
    value: score.value,
    comment: score.comment,
    dataType: score.dataType || 'NUMERIC',
  });
}

/**
 * Add a score to a span/observation
 */
export function addObservationScore(
  traceId: string,
  observationId: string,
  score: ScoreData
) {
  const client = getLangfuseClient();
  if (!client) {
    return;
  }

  client.score({
    traceId,
    observationId,
    name: score.name,
    value: score.value,
    comment: score.comment,
    dataType: score.dataType || 'NUMERIC',
  });
}

/**
 * Update trace status
 */
export function updateTraceStatus(
  traceId: string,
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
) {
  const client = getLangfuseClient();
  if (!client) {
    return;
  }

  const trace = client.trace({ id: traceId });
  trace.update({
    metadata: { status },
  });
}

/**
 * Update span with completion status
 */
export function completeSpan(
  traceId: string,
  spanId: string,
  status: 'success' | 'error',
  output?: any,
  error?: Error
) {
  const client = getLangfuseClient();
  if (!client) {
    return;
  }

  const trace = client.trace({ id: traceId });
  trace.span({
    id: spanId,
    output: output || undefined,
    level: status === 'error' ? 'ERROR' : 'DEFAULT',
    statusMessage: error?.message,
  });
}

/**
 * Event data for tracking agent events
 */
export interface EventData {
  name: string;
  metadata?: Record<string, any>;
  input?: any;
  output?: any;
}

/**
 * Create an event within a trace
 */
export function createEvent(
  traceId: string,
  eventId: string,
  data: EventData,
  parentSpanId?: string
) {
  const client = getLangfuseClient();
  if (!client) {
    return null;
  }

  const trace = client.trace({ id: traceId });
  const event = trace.event({
    id: eventId,
    name: data.name,
    parentObservationId: parentSpanId,
    input: data.input,
    output: data.output,
    metadata: data.metadata,
  });

  return event;
}

/**
 * Helper to create hierarchical trace structure
 */
export class TraceHelper {
  constructor(
    private traceId: string,
    private metadata: TraceMetadata
  ) {}

  /**
   * Start the trace
   */
  start(name: string) {
    return createTrace(name, this.traceId, this.metadata);
  }

  /**
   * Create a span for an agent
   */
  createAgentSpan(
    spanId: string,
    agentRole: string,
    agentLayer: string,
    agentExecutionId: string,
    parentSpanId?: string
  ) {
    return createSpan(
      this.traceId,
      spanId,
      `Agent: ${agentRole}`,
      {
        agentExecutionId,
        agentRole,
        agentLayer,
        tenantId: this.metadata.tenantId,
      },
      parentSpanId
    );
  }

  /**
   * Track an LLM generation
   */
  trackGeneration(
    generationId: string,
    spanId: string,
    model: string,
    input: GenerationData['input'],
    output?: string,
    usage?: TokenUsage
  ) {
    return createGeneration(this.traceId, spanId, generationId, `LLM Call: ${model}`, {
      model,
      input,
      output,
      usage,
    });
  }

  /**
   * Add a quality score
   */
  addScore(score: ScoreData) {
    return addTraceScore(this.traceId, score);
  }

  /**
   * Add score to specific span
   */
  addSpanScore(spanId: string, score: ScoreData) {
    return addObservationScore(this.traceId, spanId, score);
  }

  /**
   * Update trace status
   */
  updateStatus(status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED') {
    return updateTraceStatus(this.traceId, status);
  }

  /**
   * Mark span as complete
   */
  completeSpan(spanId: string, output?: any) {
    return completeSpan(this.traceId, spanId, 'success', output);
  }

  /**
   * Mark span as failed
   */
  failSpan(spanId: string, error: Error) {
    return completeSpan(this.traceId, spanId, 'error', undefined, error);
  }

  /**
   * Create an event
   */
  createEvent(eventId: string, data: EventData, parentSpanId?: string) {
    return createEvent(this.traceId, eventId, data, parentSpanId);
  }
}

/**
 * Create a trace helper for easier tracing
 */
export function createTraceHelper(traceId: string, metadata: TraceMetadata): TraceHelper {
  return new TraceHelper(traceId, metadata);
}

/**
 * Wrapper to automatically trace an async function
 */
export async function withTracing<T>(
  name: string,
  traceId: string,
  metadata: TraceMetadata,
  fn: (helper: TraceHelper) => Promise<T>
): Promise<T> {
  const helper = createTraceHelper(traceId, metadata);
  helper.start(name);
  helper.updateStatus('IN_PROGRESS');

  try {
    const result = await fn(helper);
    helper.updateStatus('COMPLETED');
    return result;
  } catch (error) {
    helper.updateStatus('FAILED');
    throw error;
  } finally {
    await flushLangfuse();
  }
}

import Anthropic from '@anthropic-ai/sdk';
import PQueue from 'p-queue';
import type { MessageCreateParams, Message, ContentBlock } from '@anthropic-ai/sdk/resources/messages';

/**
 * Claude API client with rate limiting and token tracking
 */
class ClaudeClientManager {
  private static instance: ClaudeClientManager;
  private client: Anthropic | null = null;
  private queue: PQueue;

  private constructor() {
    // Rate limiting: 5 concurrent requests max
    this.queue = new PQueue({ concurrency: 5 });
  }

  public static getInstance(): ClaudeClientManager {
    if (!ClaudeClientManager.instance) {
      ClaudeClientManager.instance = new ClaudeClientManager();
    }
    return ClaudeClientManager.instance;
  }

  /**
   * Initialize Claude client
   */
  public initialize(): void {
    if (this.client) {
      return; // Already initialized
    }

    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY or CLAUDE_API_KEY environment variable is required');
    }

    this.client = new Anthropic({
      apiKey,
    });

    console.log('[Claude] Client initialized successfully');
  }

  /**
   * Get Claude client instance
   */
  public getClient(): Anthropic {
    if (!this.client) {
      this.initialize();
    }
    return this.client!;
  }

  /**
   * Get rate limiter queue
   */
  public getQueue(): PQueue {
    return this.queue;
  }
}

// Singleton instance
const claudeManager = ClaudeClientManager.getInstance();

/**
 * Get Claude client
 */
export function getClaudeClient(): Anthropic {
  return claudeManager.getClient();
}

/**
 * Token usage tracking
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
}

/**
 * Claude message options
 */
export interface ClaudeMessageOptions extends Omit<MessageCreateParams, 'messages'> {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string | Array<ContentBlock>;
  }>;
  /** Optional tracing metadata */
  metadata?: {
    traceId?: string;
    spanId?: string;
    userId?: string;
    [key: string]: any;
  };
}

/**
 * Claude message response
 */
export interface ClaudeMessageResponse {
  message: Message;
  usage: TokenUsage;
  text: string;
}

/**
 * Send message to Claude with rate limiting
 */
export async function sendClaudeMessage(
  options: ClaudeMessageOptions
): Promise<ClaudeMessageResponse> {
  const client = getClaudeClient();
  const queue = claudeManager.getQueue();

  // Add metadata if provided
  const params: MessageCreateParams = {
    ...options,
    messages: options.messages as any,
    metadata: options.metadata,
  };

  // Execute with rate limiting
  const message = await queue.add(() => client.messages.create(params), {
    throwOnTimeout: true,
  });

  if (!message) {
    throw new Error('Failed to get response from Claude');
  }

  // Extract text from content blocks
  const textBlocks = message.content.filter(
    (block): block is Anthropic.TextBlock => block.type === 'text'
  );
  const text = textBlocks.map((block) => block.text).join('\n');

  // Track token usage
  const usage: TokenUsage = {
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    cacheCreationTokens: (message.usage as any).cache_creation_input_tokens,
    cacheReadTokens: (message.usage as any).cache_read_input_tokens,
  };

  return { message, usage, text };
}

/**
 * Stream message from Claude with rate limiting
 */
export async function streamClaudeMessage(
  options: ClaudeMessageOptions,
  onChunk: (text: string) => void
): Promise<ClaudeMessageResponse> {
  const client = getClaudeClient();
  const queue = claudeManager.getQueue();

  const params: MessageCreateParams = {
    ...options,
    messages: options.messages as any,
    metadata: options.metadata,
    stream: true,
  };

  // Execute with rate limiting
  const stream = await queue.add(() => client.messages.create(params), {
    throwOnTimeout: true,
  });

  if (!stream) {
    throw new Error('Failed to get stream from Claude');
  }

  let fullText = '';
  let finalMessage: Message | null = null;
  let usage: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
  };

  // Process stream
  for await (const event of stream as any) {
    if (event.type === 'content_block_delta') {
      if (event.delta.type === 'text_delta') {
        const text = event.delta.text;
        fullText += text;
        onChunk(text);
      }
    } else if (event.type === 'message_start') {
      usage.inputTokens = event.message.usage.input_tokens;
    } else if (event.type === 'message_delta') {
      usage.outputTokens = event.usage.output_tokens;
    } else if (event.type === 'message_stop') {
      // Stream complete
    }
  }

  // Construct final message object
  finalMessage = {
    id: `msg_${Date.now()}`,
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: fullText }],
    model: options.model,
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
    },
  } as Message;

  return { message: finalMessage, usage, text: fullText };
}

/**
 * Default Claude 3.5 Sonnet model
 */
export const CLAUDE_3_5_SONNET = 'claude-3-5-sonnet-20241022';

/**
 * Default Claude 3.5 Haiku model
 */
export const CLAUDE_3_5_HAIKU = 'claude-3-5-haiku-20241022';

/**
 * Create a simple user message
 */
export function createUserMessage(content: string): ClaudeMessageOptions['messages'][0] {
  return { role: 'user', content };
}

/**
 * Create a simple assistant message
 */
export function createAssistantMessage(content: string): ClaudeMessageOptions['messages'][0] {
  return { role: 'assistant', content };
}

/**
 * Create a multi-turn conversation
 */
export function createConversation(
  turns: Array<{ role: 'user' | 'assistant'; content: string }>
): ClaudeMessageOptions['messages'] {
  return turns.map((turn) => ({
    role: turn.role,
    content: turn.content,
  }));
}

/**
 * Retry configuration for Claude requests
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
};

/**
 * Execute Claude request with exponential backoff retry
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | null = null;
  let delay = retryConfig.initialDelay;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if error is retryable
      const isRetryable =
        error?.status === 429 || // Rate limit
        error?.status === 500 || // Server error
        error?.status === 503 || // Service unavailable
        error?.status === 504 || // Gateway timeout
        error?.code === 'ECONNRESET' ||
        error?.code === 'ETIMEDOUT';

      if (!isRetryable || attempt === retryConfig.maxRetries) {
        throw error;
      }

      // Log retry attempt
      console.warn(
        `[Claude] Request failed (attempt ${attempt + 1}/${retryConfig.maxRetries + 1}): ${
          error.message
        }. Retrying in ${delay}ms...`
      );

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Exponential backoff
      delay = Math.min(delay * retryConfig.backoffMultiplier, retryConfig.maxDelay);
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Send Claude message with automatic retry
 */
export async function sendClaudeMessageWithRetry(
  options: ClaudeMessageOptions,
  retryConfig?: Partial<RetryConfig>
): Promise<ClaudeMessageResponse> {
  return withRetry(() => sendClaudeMessage(options), retryConfig);
}

/**
 * Validate Claude message options
 */
export function validateClaudeOptions(options: ClaudeMessageOptions): void {
  if (!options.model) {
    throw new Error('Model is required');
  }

  if (!options.messages || options.messages.length === 0) {
    throw new Error('At least one message is required');
  }

  if (options.max_tokens && (options.max_tokens < 1 || options.max_tokens > 200000)) {
    throw new Error('max_tokens must be between 1 and 200000');
  }

  if (options.temperature !== undefined && (options.temperature < 0 || options.temperature > 1)) {
    throw new Error('temperature must be between 0 and 1');
  }

  // Validate message structure
  for (const message of options.messages) {
    if (!message.role || (message.role !== 'user' && message.role !== 'assistant')) {
      throw new Error('Message role must be "user" or "assistant"');
    }

    if (!message.content) {
      throw new Error('Message content is required');
    }
  }
}

/**
 * Parse tool calls from Claude response
 */
export function parseToolCalls(message: Message): Array<{ name: string; input: any }> {
  const toolCalls: Array<{ name: string; input: any }> = [];

  for (const block of message.content) {
    if (block.type === 'tool_use') {
      toolCalls.push({
        name: block.name,
        input: block.input,
      });
    }
  }

  return toolCalls;
}

/**
 * Check if message contains tool calls
 */
export function hasToolCalls(message: Message): boolean {
  return message.content.some((block) => block.type === 'tool_use');
}

/**
 * Get thinking blocks from Claude response
 */
export function getThinkingBlocks(message: Message): string[] {
  const thinkingBlocks: string[] = [];

  for (const block of message.content) {
    if (block.type === 'thinking' || (block as any).thinking) {
      const thinkingText =
        block.type === 'thinking' ? (block as any).thinking : (block as any).thinking;
      thinkingBlocks.push(thinkingText);
    }
  }

  return thinkingBlocks;
}

/**
 * Calculate cost for token usage (in USD)
 */
export function calculateCost(usage: TokenUsage, model: string): number {
  // Pricing as of 2025 (prices may change)
  const pricing: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
    'claude-3-5-sonnet-20241022': {
      input: 3.0 / 1_000_000, // $3 per million input tokens
      output: 15.0 / 1_000_000, // $15 per million output tokens
      cacheWrite: 3.75 / 1_000_000, // $3.75 per million cache write tokens
      cacheRead: 0.3 / 1_000_000, // $0.30 per million cache read tokens
    },
    'claude-3-5-haiku-20241022': {
      input: 1.0 / 1_000_000, // $1 per million input tokens
      output: 5.0 / 1_000_000, // $5 per million output tokens
      cacheWrite: 1.25 / 1_000_000, // $1.25 per million cache write tokens
      cacheRead: 0.1 / 1_000_000, // $0.10 per million cache read tokens
    },
  };

  const modelPricing = pricing[model] || pricing['claude-3-5-sonnet-20241022'];

  const inputCost = usage.inputTokens * modelPricing.input;
  const outputCost = usage.outputTokens * modelPricing.output;
  const cacheWriteCost = (usage.cacheCreationTokens || 0) * modelPricing.cacheWrite;
  const cacheReadCost = (usage.cacheReadTokens || 0) * modelPricing.cacheRead;

  return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}

import Redis, { type Redis as RedisClient, type RedisOptions } from 'ioredis';

/**
 * Redis client singleton with tenant isolation and distributed locking
 */
class RedisClientManager {
  private static instance: RedisClientManager;
  private client: RedisClient | null = null;
  private subscriber: RedisClient | null = null;

  private constructor() {}

  public static getInstance(): RedisClientManager {
    if (!RedisClientManager.instance) {
      RedisClientManager.instance = new RedisClientManager();
    }
    return RedisClientManager.instance;
  }

  /**
   * Initialize Redis connection
   */
  public async connect(): Promise<void> {
    if (this.client) {
      return; // Already connected
    }

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is required');
    }

    const options: RedisOptions = {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError: (err: Error) => {
        const targetErrors = ['READONLY', 'ETIMEDOUT', 'ECONNRESET'];
        return targetErrors.some((targetError) => err.message.includes(targetError));
      },
    };

    this.client = new Redis(redisUrl, options);
    this.subscriber = new Redis(redisUrl, options);

    // Handle connection events
    this.client.on('error', (err) => {
      console.error('[Redis] Connection error:', err);
    });

    this.client.on('connect', () => {
      console.log('[Redis] Connected successfully');
    });

    this.client.on('ready', () => {
      console.log('[Redis] Client ready');
    });

    this.subscriber.on('error', (err) => {
      console.error('[Redis] Subscriber error:', err);
    });

    await this.client.ping();
  }

  /**
   * Get Redis client instance
   */
  public getClient(): RedisClient {
    if (!this.client) {
      throw new Error('Redis client not initialized. Call connect() first.');
    }
    return this.client;
  }

  /**
   * Get Redis subscriber instance
   */
  public getSubscriber(): RedisClient {
    if (!this.subscriber) {
      throw new Error('Redis subscriber not initialized. Call connect() first.');
    }
    return this.subscriber;
  }

  /**
   * Close all Redis connections
   */
  public async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }
  }
}

// Singleton instance
const redisManager = RedisClientManager.getInstance();

/**
 * Get tenant-scoped key for Redis
 */
export function getTenantKey(tenantId: string, key: string): string {
  return `tenant:${tenantId}:${key}`;
}

/**
 * Get workflow-scoped key for Redis
 */
export function getWorkflowKey(tenantId: string, workflowExecutionId: string, key: string): string {
  return `tenant:${tenantId}:workflow:${workflowExecutionId}:${key}`;
}

/**
 * Get agent-scoped key for Redis
 */
export function getAgentKey(tenantId: string, agentExecutionId: string, key: string): string {
  return `tenant:${tenantId}:agent:${agentExecutionId}:${key}`;
}

/**
 * Initialize Redis connection
 */
export async function connectRedis(): Promise<void> {
  await redisManager.connect();
}

/**
 * Get Redis client
 */
export function getRedisClient(): RedisClient {
  return redisManager.getClient();
}

/**
 * Get Redis subscriber
 */
export function getRedisSubscriber(): RedisClient {
  return redisManager.getSubscriber();
}

/**
 * Close Redis connection
 */
export async function disconnectRedis(): Promise<void> {
  await redisManager.disconnect();
}

/**
 * Distributed lock options
 */
export interface LockOptions {
  /** Lock duration in milliseconds (default: 30000) */
  ttl?: number;
  /** Number of retry attempts (default: 3) */
  retries?: number;
  /** Delay between retries in milliseconds (default: 100) */
  retryDelay?: number;
}

/**
 * Acquire a distributed lock
 * Returns lock token if successful, null if lock is already held
 */
export async function acquireLock(
  tenantId: string,
  resourceId: string,
  options: LockOptions = {}
): Promise<string | null> {
  const client = getRedisClient();
  const lockKey = getTenantKey(tenantId, `lock:${resourceId}`);
  const lockToken = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const ttl = options.ttl ?? 30000; // 30 seconds default
  const retries = options.retries ?? 3;
  const retryDelay = options.retryDelay ?? 100;

  for (let attempt = 0; attempt <= retries; attempt++) {
    // Try to acquire lock using SET NX (set if not exists)
    const result = await client.set(lockKey, lockToken, 'PX', ttl, 'NX');

    if (result === 'OK') {
      return lockToken;
    }

    // If not last attempt, wait before retrying
    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  return null; // Failed to acquire lock
}

/**
 * Release a distributed lock
 * Returns true if lock was released, false if lock was not held or already expired
 */
export async function releaseLock(
  tenantId: string,
  resourceId: string,
  lockToken: string
): Promise<boolean> {
  const client = getRedisClient();
  const lockKey = getTenantKey(tenantId, `lock:${resourceId}`);

  // Lua script to atomically check token and delete lock
  const luaScript = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  const result = await client.eval(luaScript, 1, lockKey, lockToken);
  return result === 1;
}

/**
 * Execute a function with a distributed lock
 */
export async function withLock<T>(
  tenantId: string,
  resourceId: string,
  fn: () => Promise<T>,
  options: LockOptions = {}
): Promise<T> {
  const lockToken = await acquireLock(tenantId, resourceId, options);

  if (!lockToken) {
    throw new Error(`Failed to acquire lock for resource: ${resourceId}`);
  }

  try {
    return await fn();
  } finally {
    await releaseLock(tenantId, resourceId, lockToken);
  }
}

/**
 * Redis stream message
 */
export interface StreamMessage {
  id: string;
  data: Record<string, string>;
}

/**
 * Publish event to Redis stream
 */
export async function publishToStream(
  tenantId: string,
  streamName: string,
  data: Record<string, any>
): Promise<string> {
  const client = getRedisClient();
  const streamKey = getTenantKey(tenantId, `stream:${streamName}`);

  // Convert all values to strings for Redis stream
  const stringData: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    stringData[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }

  // Add to stream with auto-generated ID
  const messageId = await client.xadd(streamKey, '*', ...Object.entries(stringData).flat());
  return messageId;
}

/**
 * Read messages from Redis stream
 */
export async function readFromStream(
  tenantId: string,
  streamName: string,
  lastId: string = '0',
  count: number = 10,
  block?: number
): Promise<StreamMessage[]> {
  const client = getRedisClient();
  const streamKey = getTenantKey(tenantId, `stream:${streamName}`);

  const args: (string | number)[] = block !== undefined ? ['BLOCK', block] : [];
  args.push('STREAMS', streamKey, lastId);

  const result = await client.xread('COUNT', count, ...args);

  if (!result || result.length === 0) {
    return [];
  }

  const messages: StreamMessage[] = [];
  for (const [, streamMessages] of result) {
    for (const [id, fields] of streamMessages) {
      const data: Record<string, string> = {};
      for (let i = 0; i < fields.length; i += 2) {
        data[fields[i]] = fields[i + 1];
      }
      messages.push({ id, data });
    }
  }

  return messages;
}

/**
 * Subscribe to Redis stream and process messages
 */
export async function subscribeToStream(
  tenantId: string,
  streamName: string,
  handler: (message: StreamMessage) => Promise<void>,
  options: { lastId?: string; pollInterval?: number } = {}
): Promise<() => void> {
  const lastId = options.lastId ?? '$'; // $ means only new messages
  const pollInterval = options.pollInterval ?? 1000;

  let currentId = lastId;
  let isRunning = true;

  const poll = async () => {
    while (isRunning) {
      try {
        const messages = await readFromStream(tenantId, streamName, currentId, 10, pollInterval);

        for (const message of messages) {
          await handler(message);
          currentId = message.id;
        }
      } catch (error) {
        console.error('[Redis] Stream subscription error:', error);
        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  };

  // Start polling in background
  poll();

  // Return unsubscribe function
  return () => {
    isRunning = false;
  };
}

/**
 * Get cached value with tenant isolation
 */
export async function getCached<T>(
  tenantId: string,
  key: string
): Promise<T | null> {
  const client = getRedisClient();
  const cacheKey = getTenantKey(tenantId, `cache:${key}`);
  const value = await client.get(cacheKey);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return value as unknown as T;
  }
}

/**
 * Set cached value with tenant isolation
 */
export async function setCached<T>(
  tenantId: string,
  key: string,
  value: T,
  ttlSeconds?: number
): Promise<void> {
  const client = getRedisClient();
  const cacheKey = getTenantKey(tenantId, `cache:${key}`);
  const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

  if (ttlSeconds) {
    await client.setex(cacheKey, ttlSeconds, stringValue);
  } else {
    await client.set(cacheKey, stringValue);
  }
}

/**
 * Delete cached value
 */
export async function deleteCached(tenantId: string, key: string): Promise<void> {
  const client = getRedisClient();
  const cacheKey = getTenantKey(tenantId, `cache:${key}`);
  await client.del(cacheKey);
}

/**
 * Increment counter with tenant isolation
 */
export async function incrementCounter(
  tenantId: string,
  key: string,
  amount: number = 1
): Promise<number> {
  const client = getRedisClient();
  const counterKey = getTenantKey(tenantId, `counter:${key}`);
  return await client.incrby(counterKey, amount);
}

/**
 * Get counter value
 */
export async function getCounter(tenantId: string, key: string): Promise<number> {
  const client = getRedisClient();
  const counterKey = getTenantKey(tenantId, `counter:${key}`);
  const value = await client.get(counterKey);
  return value ? parseInt(value, 10) : 0;
}

/**
 * Reset counter
 */
export async function resetCounter(tenantId: string, key: string): Promise<void> {
  const client = getRedisClient();
  const counterKey = getTenantKey(tenantId, `counter:${key}`);
  await client.del(counterKey);
}

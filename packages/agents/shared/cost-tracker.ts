import { getRedisClient, getTenantKey, incrementCounter, getCounter } from './redis-client';
import type { TokenUsage } from './claude-client';

/**
 * Cost breakdown by token type
 */
export interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  cacheWriteCost: number;
  cacheReadCost: number;
  totalCost: number;
}

/**
 * Token usage with cost information
 */
export interface TokenUsageWithCost extends TokenUsage {
  cost: CostBreakdown;
}

/**
 * Model pricing information (per million tokens)
 */
export interface ModelPricing {
  input: number; // Price per million input tokens
  output: number; // Price per million output tokens
  cacheWrite: number; // Price per million cache write tokens
  cacheRead: number; // Price per million cache read tokens
}

/**
 * Model pricing table (as of 2025-01)
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  'claude-3-5-sonnet-20241022': {
    input: 3.0,
    output: 15.0,
    cacheWrite: 3.75,
    cacheRead: 0.3,
  },
  'claude-3-5-haiku-20241022': {
    input: 1.0,
    output: 5.0,
    cacheWrite: 1.25,
    cacheRead: 0.1,
  },
  'claude-3-opus-20240229': {
    input: 15.0,
    output: 75.0,
    cacheWrite: 18.75,
    cacheRead: 1.5,
  },
  'claude-3-sonnet-20240229': {
    input: 3.0,
    output: 15.0,
    cacheWrite: 3.75,
    cacheRead: 0.3,
  },
  'claude-3-haiku-20240307': {
    input: 0.25,
    output: 1.25,
    cacheWrite: 0.3,
    cacheRead: 0.03,
  },
};

/**
 * Calculate cost for token usage
 */
export function calculateTokenCost(
  usage: TokenUsage,
  model: string
): CostBreakdown {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['claude-3-5-sonnet-20241022'];

  const inputCost = (usage.inputTokens / 1_000_000) * pricing.input;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;
  const cacheWriteCost = ((usage.cacheCreationTokens || 0) / 1_000_000) * pricing.cacheWrite;
  const cacheReadCost = ((usage.cacheReadTokens || 0) / 1_000_000) * pricing.cacheRead;

  return {
    inputCost,
    outputCost,
    cacheWriteCost,
    cacheReadCost,
    totalCost: inputCost + outputCost + cacheWriteCost + cacheReadCost,
  };
}

/**
 * Add token usage and cost to tracking
 */
export function addCostToUsage(usage: TokenUsage, model: string): TokenUsageWithCost {
  const cost = calculateTokenCost(usage, model);
  return { ...usage, cost };
}

/**
 * Cost aggregation scope
 */
export type CostScope = 'tenant' | 'project' | 'workflow' | 'agent';

/**
 * Cost tracking record
 */
export interface CostRecord {
  scope: CostScope;
  scopeId: string;
  tenantId: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalCost: number;
  requestCount: number;
  lastUpdated: Date;
}

/**
 * Track cost for an agent execution
 */
export async function trackAgentCost(
  tenantId: string,
  projectId: string,
  workflowExecutionId: string,
  agentExecutionId: string,
  model: string,
  usage: TokenUsage
): Promise<void> {
  const client = getRedisClient();
  const cost = calculateTokenCost(usage, model);

  // Track at multiple levels for aggregation
  const scopes = [
    { scope: 'tenant', id: tenantId },
    { scope: 'project', id: projectId },
    { scope: 'workflow', id: workflowExecutionId },
    { scope: 'agent', id: agentExecutionId },
  ];

  for (const { scope, id } of scopes) {
    const key = getTenantKey(tenantId, `cost:${scope}:${id}`);

    // Increment token counters
    await client.hincrby(key, 'inputTokens', usage.inputTokens);
    await client.hincrby(key, 'outputTokens', usage.outputTokens);
    await client.hincrby(key, 'cacheCreationTokens', usage.cacheCreationTokens || 0);
    await client.hincrby(key, 'cacheReadTokens', usage.cacheReadTokens || 0);

    // Increment cost (stored as cents to avoid floating point issues)
    await client.hincrbyfloat(key, 'totalCost', cost.totalCost);

    // Increment request count
    await client.hincrby(key, 'requestCount', 1);

    // Update timestamp
    await client.hset(key, 'lastUpdated', new Date().toISOString());
    await client.hset(key, 'scope', scope);
    await client.hset(key, 'scopeId', id);
    await client.hset(key, 'tenantId', tenantId);

    // Set expiration (30 days)
    await client.expire(key, 30 * 24 * 60 * 60);
  }

  // Track daily totals for reporting
  const today = new Date().toISOString().split('T')[0];
  const dailyKey = getTenantKey(tenantId, `cost:daily:${today}`);
  await client.hincrbyfloat(dailyKey, 'totalCost', cost.totalCost);
  await client.hincrby(dailyKey, 'requestCount', 1);
  await client.expire(dailyKey, 90 * 24 * 60 * 60); // Keep for 90 days
}

/**
 * Get cost record for a scope
 */
export async function getCostRecord(
  tenantId: string,
  scope: CostScope,
  scopeId: string
): Promise<CostRecord | null> {
  const client = getRedisClient();
  const key = getTenantKey(tenantId, `cost:${scope}:${scopeId}`);

  const data = await client.hgetall(key);
  if (!data || Object.keys(data).length === 0) {
    return null;
  }

  return {
    scope: data.scope as CostScope,
    scopeId: data.scopeId,
    tenantId: data.tenantId,
    inputTokens: parseInt(data.inputTokens || '0', 10),
    outputTokens: parseInt(data.outputTokens || '0', 10),
    cacheCreationTokens: parseInt(data.cacheCreationTokens || '0', 10),
    cacheReadTokens: parseInt(data.cacheReadTokens || '0', 10),
    totalCost: parseFloat(data.totalCost || '0'),
    requestCount: parseInt(data.requestCount || '0', 10),
    lastUpdated: new Date(data.lastUpdated),
  };
}

/**
 * Get total tenant cost
 */
export async function getTenantCost(tenantId: string): Promise<CostRecord | null> {
  return getCostRecord(tenantId, 'tenant', tenantId);
}

/**
 * Get project cost
 */
export async function getProjectCost(tenantId: string, projectId: string): Promise<CostRecord | null> {
  return getCostRecord(tenantId, 'project', projectId);
}

/**
 * Get workflow cost
 */
export async function getWorkflowCost(
  tenantId: string,
  workflowExecutionId: string
): Promise<CostRecord | null> {
  return getCostRecord(tenantId, 'workflow', workflowExecutionId);
}

/**
 * Get agent execution cost
 */
export async function getAgentCost(
  tenantId: string,
  agentExecutionId: string
): Promise<CostRecord | null> {
  return getCostRecord(tenantId, 'agent', agentExecutionId);
}

/**
 * Get daily cost summary
 */
export async function getDailyCost(tenantId: string, date: Date): Promise<{
  date: string;
  totalCost: number;
  requestCount: number;
} | null> {
  const client = getRedisClient();
  const dateStr = date.toISOString().split('T')[0];
  const key = getTenantKey(tenantId, `cost:daily:${dateStr}`);

  const data = await client.hgetall(key);
  if (!data || Object.keys(data).length === 0) {
    return null;
  }

  return {
    date: dateStr,
    totalCost: parseFloat(data.totalCost || '0'),
    requestCount: parseInt(data.requestCount || '0', 10),
  };
}

/**
 * Get cost summary for date range
 */
export async function getCostSummary(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  totalCost: number;
  totalRequests: number;
  dailyBreakdown: Array<{ date: string; cost: number; requests: number }>;
}> {
  const dailyBreakdown: Array<{ date: string; cost: number; requests: number }> = [];
  let totalCost = 0;
  let totalRequests = 0;

  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dailyCost = await getDailyCost(tenantId, currentDate);
    if (dailyCost) {
      dailyBreakdown.push({
        date: dailyCost.date,
        cost: dailyCost.totalCost,
        requests: dailyCost.requestCount,
      });
      totalCost += dailyCost.totalCost;
      totalRequests += dailyCost.requestCount;
    } else {
      dailyBreakdown.push({
        date: currentDate.toISOString().split('T')[0],
        cost: 0,
        requests: 0,
      });
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return {
    totalCost,
    totalRequests,
    dailyBreakdown,
  };
}

/**
 * Cost alert configuration
 */
export interface CostAlert {
  tenantId: string;
  scope: CostScope;
  scopeId: string;
  threshold: number; // USD
  enabled: boolean;
}

/**
 * Check if cost threshold is exceeded
 */
export async function checkCostThreshold(
  tenantId: string,
  scope: CostScope,
  scopeId: string,
  threshold: number
): Promise<boolean> {
  const record = await getCostRecord(tenantId, scope, scopeId);
  return record ? record.totalCost >= threshold : false;
}

/**
 * Set cost alert
 */
export async function setCostAlert(alert: CostAlert): Promise<void> {
  const client = getRedisClient();
  const key = getTenantKey(alert.tenantId, `cost:alert:${alert.scope}:${alert.scopeId}`);

  await client.hset(key, {
    tenantId: alert.tenantId,
    scope: alert.scope,
    scopeId: alert.scopeId,
    threshold: alert.threshold.toString(),
    enabled: alert.enabled ? '1' : '0',
  });
}

/**
 * Get cost alert
 */
export async function getCostAlert(
  tenantId: string,
  scope: CostScope,
  scopeId: string
): Promise<CostAlert | null> {
  const client = getRedisClient();
  const key = getTenantKey(tenantId, `cost:alert:${scope}:${scopeId}`);

  const data = await client.hgetall(key);
  if (!data || Object.keys(data).length === 0) {
    return null;
  }

  return {
    tenantId: data.tenantId,
    scope: data.scope as CostScope,
    scopeId: data.scopeId,
    threshold: parseFloat(data.threshold),
    enabled: data.enabled === '1',
  };
}

/**
 * Check all active cost alerts
 */
export async function checkCostAlerts(tenantId: string): Promise<
  Array<{
    alert: CostAlert;
    currentCost: number;
    exceeded: boolean;
  }>
> {
  // This would typically query all alerts for a tenant
  // For now, return empty array as placeholder
  return [];
}

/**
 * Reset cost tracking for a scope
 */
export async function resetCost(
  tenantId: string,
  scope: CostScope,
  scopeId: string
): Promise<void> {
  const client = getRedisClient();
  const key = getTenantKey(tenantId, `cost:${scope}:${scopeId}`);
  await client.del(key);
}

/**
 * Get estimated cost for a request before execution
 */
export function estimateCost(
  model: string,
  estimatedInputTokens: number,
  estimatedOutputTokens: number
): number {
  const usage: TokenUsage = {
    inputTokens: estimatedInputTokens,
    outputTokens: estimatedOutputTokens,
  };

  const cost = calculateTokenCost(usage, model);
  return cost.totalCost;
}

/**
 * Format cost as USD string
 */
export function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

/**
 * Format tokens with thousands separator
 */
export function formatTokens(tokens: number): string {
  return tokens.toLocaleString();
}

/**
 * Get cost per token for a model
 */
export function getCostPerToken(model: string, tokenType: 'input' | 'output'): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['claude-3-5-sonnet-20241022'];
  return tokenType === 'input' ? pricing.input / 1_000_000 : pricing.output / 1_000_000;
}

/**
 * Compare costs across models
 */
export function compareCosts(
  inputTokens: number,
  outputTokens: number
): Array<{ model: string; cost: number }> {
  const usage: TokenUsage = { inputTokens, outputTokens };

  return Object.keys(MODEL_PRICING).map((model) => ({
    model,
    cost: calculateTokenCost(usage, model).totalCost,
  }));
}

/**
 * Cost tracking middleware for agent execution
 */
export async function withCostTracking<T>(
  tenantId: string,
  projectId: string,
  workflowExecutionId: string,
  agentExecutionId: string,
  model: string,
  fn: () => Promise<{ result: T; usage: TokenUsage }>
): Promise<T> {
  const { result, usage } = await fn();

  // Track cost asynchronously (don't block execution)
  trackAgentCost(tenantId, projectId, workflowExecutionId, agentExecutionId, model, usage).catch(
    (error) => {
      console.error('[CostTracker] Failed to track cost:', error);
    }
  );

  return result;
}

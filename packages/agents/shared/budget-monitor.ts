// packages/agents/shared/budget-monitor.ts
import { PrismaClient } from '@business-automation/database';
import { connectRedis } from './redis-client';
import type Redis from 'ioredis';

/**
 * Budget Monitor - Track and Enforce Cost Limits
 *
 * Provides real-time tracking of token usage and costs across:
 * - Individual agent executions
 * - Workflow executions
 * - Per-tenant monthly budgets
 * - System-wide limits
 *
 * Features:
 * - Real-time cost tracking
 * - Automatic workflow pause when budget exceeded
 * - Alert system for approaching limits
 * - Monthly spend aggregation
 * - Per-agent cost breakdown
 */

export interface BudgetLimits {
  // Per-execution limits
  perExecution?: {
    maxCostUsd?: number;
    maxTokens?: number;
  };
  // Per-workflow limits
  perWorkflow?: {
    maxCostUsd?: number;
    maxTokens?: number;
  };
  // Per-tenant monthly limits
  monthly?: {
    maxCostUsd?: number;
    maxTokens?: number;
  };
  // System-wide limits
  system?: {
    maxCostUsd?: number;
    maxTokens?: number;
  };
}

export interface CostUsage {
  costUsd: number;
  tokensUsed: number;
  timestamp: Date;
}

export interface BudgetStatus {
  remaining: {
    costUsd: number;
    tokens: number;
  };
  used: {
    costUsd: number;
    tokens: number;
  };
  limit: {
    costUsd: number;
    tokens: number;
  };
  percentUsed: number;
  exceeded: boolean;
  nearingLimit: boolean; // >80%
}

/**
 * Budget Monitor Class
 */
export class BudgetMonitor {
  private redis: Redis | null = null;
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Initialize Redis connection
   */
  async initialize(): Promise<void> {
    this.redis = await connectRedis();
  }

  /**
   * Track agent execution cost
   */
  async trackAgentCost(params: {
    agentExecutionId: string;
    projectId: string;
    tenantId: string;
    costUsd: number;
    tokensUsed: number;
  }): Promise<void> {
    const { agentExecutionId, projectId, tenantId, costUsd, tokensUsed } = params;

    // ALWAYS update database (source of truth)
    await this.prisma.agentExecution.update({
      where: { id: agentExecutionId },
      data: {
        cost: costUsd,
        tokensUsed,
      },
    });

    // Update Redis cache if available (optional performance optimization)
    if (this.redis) {
      try {
        const timestamp = new Date().toISOString();

        // Store in Redis for fast access
        const key = `budget:agent:${agentExecutionId}`;
        await this.redis.hset(key, {
          costUsd: costUsd.toString(),
          tokensUsed: tokensUsed.toString(),
          timestamp,
        });
        await this.redis.expire(key, 86400); // 24 hours

        // Increment tenant monthly usage
        const monthKey = this.getMonthKey(tenantId);
        await this.redis.hincrby(monthKey, 'tokens', tokensUsed);
        await this.redis.hincrbyfloat(monthKey, 'cost', costUsd);
        await this.redis.expire(monthKey, 2592000); // 30 days
      } catch (error) {
        console.warn('[BudgetMonitor] Redis cache update failed, continuing with DB update', error);
      }
    } else {
      console.warn('[BudgetMonitor] Redis not initialized, skipping cache update (DB updated successfully)');
    }
  }

  /**
   * Track workflow cost
   */
  async trackWorkflowCost(params: {
    workflowExecutionId: string;
    projectId: string;
    tenantId: string;
    costUsd: number;
    tokensUsed: number;
  }): Promise<void> {
    const { workflowExecutionId, projectId, tenantId, costUsd, tokensUsed } = params;

    // ALWAYS update database (source of truth)
    await this.prisma.workflowExecution.update({
      where: { id: workflowExecutionId },
      data: {
        totalCost: costUsd, // WorkflowExecution uses totalCost, not cost
      },
    });

    // Update Redis cache if available (optional performance optimization)
    if (this.redis) {
      try {
        const timestamp = new Date().toISOString();

        // Store in Redis
        const key = `budget:workflow:${workflowExecutionId}`;
        await this.redis.hset(key, {
          costUsd: costUsd.toString(),
          tokensUsed: tokensUsed.toString(), // Kept for Redis cache compatibility
          timestamp,
        });
        await this.redis.expire(key, 86400); // 24 hours
      } catch (error) {
        console.warn('[BudgetMonitor] Redis cache update failed, continuing with DB update', error);
      }
    } else {
      console.warn('[BudgetMonitor] Redis not initialized, skipping cache update (DB updated successfully)');
    }
  }

  /**
   * Check if budget allows execution
   */
  async checkBudget(params: {
    tenantId: string;
    projectId: string;
    estimatedCost: number;
    estimatedTokens: number;
    limits: BudgetLimits;
  }): Promise<{ allowed: boolean; reason?: string; status: BudgetStatus }> {
    const { tenantId, estimatedCost, estimatedTokens, limits } = params;

    // Get current usage
    const currentUsage = await this.getTenantMonthlyUsage(tenantId);

    // Check monthly limit
    if (limits.monthly) {
      const monthlyLimit = limits.monthly.maxCostUsd || Infinity;
      const projectedCost = currentUsage.costUsd + estimatedCost;

      if (projectedCost > monthlyLimit) {
        const status = this.calculateBudgetStatus(
          currentUsage.costUsd,
          currentUsage.tokensUsed,
          monthlyLimit,
          limits.monthly.maxTokens || Infinity
        );

        return {
          allowed: false,
          reason: `Monthly budget exceeded. Current: $${currentUsage.costUsd.toFixed(2)}, Projected: $${projectedCost.toFixed(2)}, Limit: $${monthlyLimit}`,
          status,
        };
      }

      // Check if nearing limit (>80%)
      const percentUsed = (projectedCost / monthlyLimit) * 100;
      if (percentUsed > 80) {
        console.warn(
          `[BudgetMonitor] Tenant ${tenantId} nearing monthly budget limit: ${percentUsed.toFixed(1)}%`
        );
      }
    }

    // Check system-wide limits
    if (limits.system) {
      const systemUsage = await this.getSystemMonthlyUsage();
      const systemLimit = limits.system.maxCostUsd || Infinity;
      const projectedSystemCost = systemUsage.costUsd + estimatedCost;

      if (projectedSystemCost > systemLimit) {
        const status = this.calculateBudgetStatus(
          systemUsage.costUsd,
          systemUsage.tokensUsed,
          systemLimit,
          limits.system.maxTokens || Infinity
        );

        return {
          allowed: false,
          reason: `System-wide budget exceeded. Current: $${systemUsage.costUsd.toFixed(2)}, Limit: $${systemLimit}`,
          status,
        };
      }
    }

    // Calculate status
    const monthlyLimit = limits.monthly?.maxCostUsd || Infinity;
    const tokenLimit = limits.monthly?.maxTokens || Infinity;
    const status = this.calculateBudgetStatus(
      currentUsage.costUsd,
      currentUsage.tokensUsed,
      monthlyLimit,
      tokenLimit
    );

    return {
      allowed: true,
      status,
    };
  }

  /**
   * Get tenant monthly usage
   */
  async getTenantMonthlyUsage(tenantId: string): Promise<CostUsage> {
    if (!this.redis) {
      // Fallback to database query
      return this.getTenantMonthlyUsageFromDB(tenantId);
    }

    const monthKey = this.getMonthKey(tenantId);
    const data = await this.redis.hgetall(monthKey);

    if (!data || !data.cost) {
      return {
        costUsd: 0,
        tokensUsed: 0,
        timestamp: new Date(),
      };
    }

    return {
      costUsd: parseFloat(data.cost || '0'),
      tokensUsed: parseInt(data.tokens || '0', 10),
      timestamp: new Date(),
    };
  }

  /**
   * Get tenant monthly usage from database
   */
  private async getTenantMonthlyUsageFromDB(tenantId: string): Promise<CostUsage> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Get workflow costs
    const workflows = await this.prisma.workflowExecution.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: startOfMonth,
        },
      },
      select: {
        totalCost: true,
      },
    });

    // Get agent execution costs (for individual agent runs)
    const agents = await this.prisma.agentExecution.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: startOfMonth,
        },
      },
      select: {
        cost: true,
        tokensUsed: true,
      },
    });

    const workflowCost = workflows.reduce((sum, w) => sum + (w.totalCost || 0), 0);
    const agentCost = agents.reduce((sum, a) => sum + (a.cost || 0), 0);
    const totalTokens = agents.reduce((sum, a) => sum + (a.tokensUsed || 0), 0);

    return {
      costUsd: workflowCost + agentCost,
      tokensUsed: totalTokens,
      timestamp: new Date(),
    };
  }

  /**
   * Get system-wide monthly usage
   */
  async getSystemMonthlyUsage(): Promise<CostUsage> {
    if (!this.redis) {
      return this.getSystemMonthlyUsageFromDB();
    }

    const systemKey = 'budget:system:monthly';
    const data = await this.redis.hgetall(systemKey);

    if (!data || !data.cost) {
      return {
        costUsd: 0,
        tokensUsed: 0,
        timestamp: new Date(),
      };
    }

    return {
      costUsd: parseFloat(data.cost || '0'),
      tokensUsed: parseInt(data.tokens || '0', 10),
      timestamp: new Date(),
    };
  }

  /**
   * Get system-wide usage from database
   */
  private async getSystemMonthlyUsageFromDB(): Promise<CostUsage> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Get workflow costs
    const workflows = await this.prisma.workflowExecution.findMany({
      where: {
        createdAt: {
          gte: startOfMonth,
        },
      },
      select: {
        totalCost: true,
      },
    });

    // Get agent execution costs
    const agents = await this.prisma.agentExecution.findMany({
      where: {
        createdAt: {
          gte: startOfMonth,
        },
      },
      select: {
        cost: true,
        tokensUsed: true,
      },
    });

    const workflowCost = workflows.reduce((sum, w) => sum + (w.totalCost || 0), 0);
    const agentCost = agents.reduce((sum, a) => sum + (a.cost || 0), 0);
    const totalTokens = agents.reduce((sum, a) => sum + (a.tokensUsed || 0), 0);

    return {
      costUsd: workflowCost + agentCost,
      tokensUsed: totalTokens,
      timestamp: new Date(),
    };
  }

  /**
   * Calculate budget status
   */
  private calculateBudgetStatus(
    usedCost: number,
    usedTokens: number,
    limitCost: number,
    limitTokens: number
  ): BudgetStatus {
    const percentUsed = limitCost !== Infinity ? (usedCost / limitCost) * 100 : 0;

    return {
      remaining: {
        costUsd: limitCost !== Infinity ? Math.max(0, limitCost - usedCost) : Infinity,
        tokens: limitTokens !== Infinity ? Math.max(0, limitTokens - usedTokens) : Infinity,
      },
      used: {
        costUsd: usedCost,
        tokens: usedTokens,
      },
      limit: {
        costUsd: limitCost,
        tokens: limitTokens,
      },
      percentUsed,
      exceeded: usedCost > limitCost,
      nearingLimit: percentUsed > 80,
    };
  }

  /**
   * Get month key for Redis
   */
  private getMonthKey(tenantId: string): string {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return `budget:tenant:${tenantId}:${yearMonth}`;
  }

  /**
   * Get budget breakdown by agent
   */
  async getAgentCostBreakdown(params: {
    tenantId: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Array<{ agentName: string; totalCost: number; totalTokens: number; executions: number }>> {
    const { tenantId, startDate, endDate } = params;

    const where: any = {
      tenantId,
    };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const agents = await this.prisma.agentExecution.groupBy({
      by: ['agentName'],
      where,
      _sum: {
        cost: true,
        tokensUsed: true,
      },
      _count: {
        id: true,
      },
    });

    return agents.map((agent) => ({
      agentName: agent.agentName,
      totalCost: agent._sum.cost || 0,
      totalTokens: agent._sum.tokensUsed || 0,
      executions: agent._count.id,
    }));
  }

  /**
   * Send budget alert
   */
  async sendBudgetAlert(params: {
    tenantId: string;
    type: 'approaching' | 'exceeded';
    status: BudgetStatus;
  }): Promise<void> {
    const { tenantId, type, status } = params;

    // TODO: Integrate with notification service (email, Slack, etc.)
    console.warn(`[BudgetMonitor] ALERT for tenant ${tenantId}:`, {
      type,
      percentUsed: status.percentUsed.toFixed(1) + '%',
      used: `$${status.used.costUsd.toFixed(2)}`,
      limit: `$${status.limit.costUsd.toFixed(2)}`,
      remaining: `$${status.remaining.costUsd.toFixed(2)}`,
    });

    // Store alert in database
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        action: 'BUDGET_ALERT',
        resourceType: 'SYSTEM',
        resourceId: 'budget-monitor',
        metadata: {
          type,
          status,
        },
      },
    });
  }

  /**
   * Reset monthly budgets (called by cron job at start of month)
   */
  async resetMonthlyBudgets(): Promise<void> {
    if (!this.redis) {
      console.warn('[BudgetMonitor] Redis not initialized, skipping reset');
      return;
    }

    console.log('[BudgetMonitor] Resetting monthly budgets...');

    // Archive current month's data to database before reset
    // This would typically be done by a background job

    // Clear Redis monthly keys (they'll auto-expire, but we can clear proactively)
    const pattern = 'budget:tenant:*';
    const keys = await this.redis.keys(pattern);

    if (keys.length > 0) {
      await this.redis.del(...keys);
    }

    console.log(`[BudgetMonitor] Reset ${keys.length} tenant budget keys`);
  }
}

/**
 * Create budget monitor instance
 */
export function createBudgetMonitor(prisma: PrismaClient): BudgetMonitor {
  return new BudgetMonitor(prisma);
}

/**
 * Default budget limits
 */
export const DEFAULT_BUDGET_LIMITS: BudgetLimits = {
  perExecution: {
    maxCostUsd: 10, // $10 per agent execution
    maxTokens: 100000, // 100k tokens per execution
  },
  perWorkflow: {
    maxCostUsd: 50, // $50 per workflow
    maxTokens: 500000, // 500k tokens per workflow
  },
  monthly: {
    maxCostUsd: 1000, // $1000 per tenant per month
    maxTokens: 10000000, // 10M tokens per tenant per month
  },
  system: {
    maxCostUsd: 10000, // $10k system-wide per month
    maxTokens: 100000000, // 100M tokens system-wide per month
  },
};

import { PrismaClient, type AgentRole } from '@business-automation/database';
import type { WorkflowExecutionResult } from './executor';

/**
 * Quality evaluation score
 */
export interface QualityScore {
  agentRole: AgentRole;
  agentExecutionId: string;
  dimension: string;
  score: number;
  maxScore: number;
  feedback?: string;
}

/**
 * Aggregated quality metrics
 */
export interface QualityMetrics {
  overallScore: number;
  dimensionScores: Map<string, number>;
  failedDimensions: Array<{ dimension: string; score: number; threshold: number }>;
  passedDimensions: Array<{ dimension: string; score: number }>;
  totalEvaluations: number;
}

/**
 * Refinement decision
 */
export interface RefinementDecision {
  shouldRefine: boolean;
  reason: string;
  targetAgents: AgentRole[];
  iteration: number;
  metrics: QualityMetrics;
}

/**
 * Refinement configuration
 */
export interface RefinementConfig {
  enabled: boolean;
  maxIterations: number;
  qualityThreshold: number; // 0-1
  dimensionThresholds?: Map<string, number>;
  evaluatorRoles: AgentRole[];
}

/**
 * Default refinement configuration
 */
export const DEFAULT_REFINEMENT_CONFIG: RefinementConfig = {
  enabled: true,
  maxIterations: 3,
  qualityThreshold: 0.8,
  evaluatorRoles: ['QUALITY_EVALUATOR'],
};

/**
 * Refinement engine for iterative quality improvement
 */
export class RefinementEngine {
  private prisma: PrismaClient;
  private config: RefinementConfig;
  private iteration: number = 0;

  constructor(prisma: PrismaClient, config: Partial<RefinementConfig> = {}) {
    this.prisma = prisma;
    this.config = { ...DEFAULT_REFINEMENT_CONFIG, ...config };
  }

  /**
   * Get quality evaluations from database
   */
  async getQualityEvaluations(workflowExecutionId: string): Promise<QualityScore[]> {
    const evaluations = await this.prisma.agentExecution.findMany({
      where: {
        workflowExecutionId,
        role: { in: this.config.evaluatorRoles },
        evaluation: { not: null },
      },
      select: {
        id: true,
        role: true,
        evaluation: true,
      },
    });

    const scores: QualityScore[] = [];

    for (const eval of evaluations) {
      if (!eval.evaluation || typeof eval.evaluation !== 'object') {
        continue;
      }

      const evaluation = eval.evaluation as any;

      // Parse evaluation format
      // Expected format: { dimensions: { dimension: { score, maxScore, feedback } } }
      if (evaluation.dimensions) {
        for (const [dimension, dimEval] of Object.entries(evaluation.dimensions)) {
          const dimEvalObj = dimEval as any;
          scores.push({
            agentRole: eval.role as AgentRole,
            agentExecutionId: eval.id,
            dimension,
            score: dimEvalObj.score || 0,
            maxScore: dimEvalObj.maxScore || 100,
            feedback: dimEvalObj.feedback,
          });
        }
      }
    }

    return scores;
  }

  /**
   * Calculate quality metrics from evaluations
   */
  calculateMetrics(evaluations: QualityScore[]): QualityMetrics {
    if (evaluations.length === 0) {
      return {
        overallScore: 0,
        dimensionScores: new Map(),
        failedDimensions: [],
        passedDimensions: [],
        totalEvaluations: 0,
      };
    }

    // Group by dimension
    const dimensionGroups = new Map<string, QualityScore[]>();

    for (const eval of evaluations) {
      const group = dimensionGroups.get(eval.dimension) || [];
      group.push(eval);
      dimensionGroups.set(eval.dimension, group);
    }

    // Calculate average score for each dimension
    const dimensionScores = new Map<string, number>();
    let totalScore = 0;
    let dimensionCount = 0;

    for (const [dimension, scores] of dimensionGroups.entries()) {
      const avgScore = scores.reduce((sum, s) => {
        const normalized = s.score / s.maxScore;
        return sum + normalized;
      }, 0) / scores.length;

      dimensionScores.set(dimension, avgScore);
      totalScore += avgScore;
      dimensionCount++;
    }

    const overallScore = dimensionCount > 0 ? totalScore / dimensionCount : 0;

    // Identify failed and passed dimensions
    const failedDimensions: Array<{ dimension: string; score: number; threshold: number }> = [];
    const passedDimensions: Array<{ dimension: string; score: number }> = [];

    for (const [dimension, score] of dimensionScores.entries()) {
      const threshold = this.config.dimensionThresholds?.get(dimension) || this.config.qualityThreshold;

      if (score < threshold) {
        failedDimensions.push({ dimension, score, threshold });
      } else {
        passedDimensions.push({ dimension, score });
      }
    }

    return {
      overallScore,
      dimensionScores,
      failedDimensions,
      passedDimensions,
      totalEvaluations: evaluations.length,
    };
  }

  /**
   * Determine which agents need refinement based on evaluations
   */
  async identifyAgentsForRefinement(
    workflowExecutionId: string,
    metrics: QualityMetrics
  ): Promise<AgentRole[]> {
    // Get agents that produced outputs evaluated as low quality
    const evaluations = await this.prisma.agentExecution.findMany({
      where: {
        workflowExecutionId,
        role: { not: { in: this.config.evaluatorRoles } },
        status: 'COMPLETED',
      },
      select: {
        role: true,
        output: true,
      },
    });

    const agentsToRefine = new Set<AgentRole>();

    // Map failed dimensions to agents
    // This is simplified - you'd need to track which agent produced which output
    // For now, we'll refine agents in layers that had failures
    const failedDimensions = metrics.failedDimensions.map((d) => d.dimension);

    // Map dimensions to typical agent layers
    const dimensionToLayer: Record<string, string[]> = {
      design: ['COLOR_PALETTE', 'TYPOGRAPHY', 'LAYOUT_STRUCTURE'],
      content: ['HERO_COPY', 'FEATURE_COPY', 'CTA_COPY'],
      code: ['CODE_GENERATOR', 'COMPONENT_GENERATOR'],
      seo: ['SEO_METADATA'],
    };

    for (const failedDim of failedDimensions) {
      const agents = dimensionToLayer[failedDim.toLowerCase()] || [];
      for (const agent of agents) {
        agentsToRefine.add(agent as AgentRole);
      }
    }

    return Array.from(agentsToRefine);
  }

  /**
   * Decide if refinement is needed
   */
  async decideRefinement(
    workflowExecutionId: string,
    result: WorkflowExecutionResult
  ): Promise<RefinementDecision> {
    // Check if refinement is enabled
    if (!this.config.enabled) {
      return {
        shouldRefine: false,
        reason: 'Refinement is disabled',
        targetAgents: [],
        iteration: this.iteration,
        metrics: {
          overallScore: 1,
          dimensionScores: new Map(),
          failedDimensions: [],
          passedDimensions: [],
          totalEvaluations: 0,
        },
      };
    }

    // Check if max iterations reached
    if (this.iteration >= this.config.maxIterations) {
      return {
        shouldRefine: false,
        reason: `Max iterations (${this.config.maxIterations}) reached`,
        targetAgents: [],
        iteration: this.iteration,
        metrics: {
          overallScore: 0,
          dimensionScores: new Map(),
          failedDimensions: [],
          passedDimensions: [],
          totalEvaluations: 0,
        },
      };
    }

    // Get quality evaluations
    const evaluations = await this.getQualityEvaluations(workflowExecutionId);

    if (evaluations.length === 0) {
      return {
        shouldRefine: false,
        reason: 'No quality evaluations found',
        targetAgents: [],
        iteration: this.iteration,
        metrics: {
          overallScore: 1,
          dimensionScores: new Map(),
          failedDimensions: [],
          passedDimensions: [],
          totalEvaluations: 0,
        },
      };
    }

    // Calculate metrics
    const metrics = this.calculateMetrics(evaluations);

    // Check if quality threshold is met
    if (metrics.overallScore >= this.config.qualityThreshold) {
      return {
        shouldRefine: false,
        reason: `Quality threshold met (${metrics.overallScore.toFixed(2)} >= ${this.config.qualityThreshold})`,
        targetAgents: [],
        iteration: this.iteration,
        metrics,
      };
    }

    // Identify agents for refinement
    const targetAgents = await this.identifyAgentsForRefinement(workflowExecutionId, metrics);

    if (targetAgents.length === 0) {
      return {
        shouldRefine: false,
        reason: 'No agents identified for refinement',
        targetAgents: [],
        iteration: this.iteration,
        metrics,
      };
    }

    return {
      shouldRefine: true,
      reason: `Quality below threshold (${metrics.overallScore.toFixed(2)} < ${this.config.qualityThreshold})`,
      targetAgents,
      iteration: this.iteration,
      metrics,
    };
  }

  /**
   * Increment iteration counter
   */
  incrementIteration(): void {
    this.iteration++;
  }

  /**
   * Reset iteration counter
   */
  resetIteration(): void {
    this.iteration = 0;
  }

  /**
   * Get current iteration
   */
  getCurrentIteration(): number {
    return this.iteration;
  }

  /**
   * Get refinement configuration
   */
  getConfig(): RefinementConfig {
    return { ...this.config };
  }

  /**
   * Update refinement configuration
   */
  updateConfig(updates: Partial<RefinementConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

/**
 * Create refinement engine
 */
export function createRefinementEngine(
  prisma: PrismaClient,
  config?: Partial<RefinementConfig>
): RefinementEngine {
  return new RefinementEngine(prisma, config);
}

/**
 * Parse quality feedback for agent input
 */
export function parseQualityFeedback(
  metrics: QualityMetrics,
  targetAgent: AgentRole
): string {
  const feedback: string[] = [];

  feedback.push(`Quality Score: ${(metrics.overallScore * 100).toFixed(1)}%`);
  feedback.push('');
  feedback.push('Areas for Improvement:');

  for (const failed of metrics.failedDimensions) {
    feedback.push(
      `- ${failed.dimension}: ${(failed.score * 100).toFixed(1)}% (target: ${(failed.threshold * 100).toFixed(1)}%)`
    );
  }

  if (metrics.failedDimensions.length === 0) {
    feedback.push('- None identified');
  }

  return feedback.join('\n');
}

/**
 * Format quality metrics for display
 */
export function formatQualityMetrics(metrics: QualityMetrics): string {
  const lines: string[] = [];

  lines.push(`Overall Quality: ${(metrics.overallScore * 100).toFixed(1)}%`);
  lines.push(`Total Evaluations: ${metrics.totalEvaluations}`);
  lines.push('');

  lines.push('Dimension Scores:');
  for (const [dimension, score] of metrics.dimensionScores.entries()) {
    lines.push(`  ${dimension}: ${(score * 100).toFixed(1)}%`);
  }

  if (metrics.failedDimensions.length > 0) {
    lines.push('');
    lines.push('Failed Dimensions:');
    for (const failed of metrics.failedDimensions) {
      lines.push(
        `  ${failed.dimension}: ${(failed.score * 100).toFixed(1)}% < ${(failed.threshold * 100).toFixed(1)}%`
      );
    }
  }

  return lines.join('\n');
}

/**
 * Check if specific agent needs refinement
 */
export function shouldRefineAgent(
  agentRole: AgentRole,
  targetAgents: AgentRole[]
): boolean {
  return targetAgents.includes(agentRole);
}

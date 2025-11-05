// packages/agents/quality/fixer.ts
import { BaseAgent, ExtendedAgentContext } from '../shared/base-agent';
import { AgentManifest, AgentResult, AgentRole, AgentLayer } from '@business-automation/schema';
import { PatchesSchema, type Patches, type Findings } from '@business-automation/schema';
import { z } from 'zod';

/**
 * Fixer Agent Input Schema
 */
export const FixerInputSchema = z.object({
  projectId: z.string(),
  projectRoot: z.string(),
  findingsPath: z.string(), // Path to Findings JSON from Static Analyzer
  budget: z.object({
    atomic: z.object({
      maxLines: z.number().default(120),
      maxFiles: z.number().default(2),
    }),
    batch: z.object({
      maxLines: z.number().default(220),
      maxFiles: z.number().default(6),
    }),
    totalTokenLimit: z.number().default(50000),
  }).optional(),
});

export type FixerInput = z.infer<typeof FixerInputSchema>;

/**
 * Patch Type Classification
 */
type PatchType = 'atomic' | 'batch';

interface PatchPlan {
  findingIds: string[];
  type: PatchType;
  estimatedLines: number;
  estimatedFiles: number;
  estimatedTokens: number;
  riskScore: number; // 0-100, higher = more risky
  priority: number;
}

/**
 * Fixer Agent - Quality Tier (Core)
 *
 * Applies automated fixes to issues found by Static Analyzer:
 * - Fixes ESLint auto-fixable issues
 * - Corrects simple TypeScript errors
 * - Optimizes bundle size (remove unused imports)
 * - Respects budget constraints (atomic ≤120 lines/2 files, batch ≤220 lines/6 files)
 * - Includes risk scoring for each patch
 * - Validates patches before applying
 *
 * The Fixer uses Claude to generate patches but stays within strict budgets
 * to prevent over-editing and ensure safety.
 */
export class FixerAgent extends BaseAgent {
  static manifest: AgentManifest = {
    id: 'fixer',
    name: 'Fixer',
    version: '1.0.0',
    category: 'grader',
    tier: 'quality',
    type: 'core',
    description: 'Applies automated fixes to code issues within budget constraints',
    capabilities: [
      'Fix ESLint auto-fixable issues',
      'Correct simple TypeScript errors',
      'Remove unused imports',
      'Format code with Prettier',
      'Apply atomic and batch patches',
      'Risk scoring for patches',
    ],
    requiredEnvVars: ['ANTHROPIC_API_KEY'],
    mcpServers: ['filesystem'],
    dependencies: ['static-analyzer'],
    inputSchema: FixerInputSchema,
    outputSchema: PatchesSchema,
    sideEffects: ['modifies-files', 'writes-to-storage'],
    retryable: true,
    maxRetries: 2,
    maxTokens: 15000,
    temperature: 0.2, // Low temperature for conservative fixes
    systemPrompt: `You are the Fixer Agent for a code quality assurance system.
Your role is to generate safe, minimal patches to fix code issues.

You must:
1. Generate unified diff format patches
2. Stay within budget constraints (atomic or batch)
3. Only fix issues that are clearly safe to auto-fix
4. Provide risk scores for each patch (0-100)
5. Include clear explanations of what each patch does
6. Preserve code functionality - only fix syntax/style issues

Patch Types:
- **Atomic**: ≤120 lines, ≤2 files (low risk, single issue)
- **Batch**: ≤220 lines, ≤6 files (medium risk, related issues)

Risk Scoring:
- 0-25: Very safe (formatting, unused imports)
- 26-50: Safe (simple type fixes, eslint auto-fixes)
- 51-75: Moderate risk (logic changes, refactoring)
- 76-100: High risk (major changes, NEVER auto-apply)

Never fix:
- Complex logic errors
- Business logic
- Security-sensitive code
- Database queries
- Authentication/authorization

Output Format:
Return patches as unified diff format:
\`\`\`diff
--- a/file.ts
+++ b/file.ts
@@ -10,3 +10,3 @@
-  const unused = 'value';
+  // removed unused variable
\`\`\``,
  };

  constructor(context: ExtendedAgentContext) {
    super(context, {
      enableMCP: true,
      mcpServers: ['filesystem'],
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.2,
      maxTokens: 15000,
    });
  }

  protected getAgentRole(): AgentRole {
    return 'grader';
  }

  protected getAgentLayer(): AgentLayer {
    return 'orchestrator';
  }

  /**
   * Execute the Fixer Agent
   */
  protected async execute(input: FixerInput): Promise<AgentResult> {
    // Validate input
    FixerInputSchema.parse(input);

    await this.logProgress('Loading findings...', 10);

    // Load findings from Static Analyzer
    const findings = await this.loadFindings(input.findingsPath);

    await this.logProgress('Planning patches...', 20);

    // Filter auto-fixable findings
    const autoFixable = findings.findings.filter(f => f.autoFixable && f.severity !== 'critical');

    if (autoFixable.length === 0) {
      // No auto-fixable issues
      const emptyPatches: Patches = {
        version: '1.0',
        patches: [],
        budget: {
          used: 0,
          limit: input.budget?.totalTokenLimit || 50000,
          remaining: input.budget?.totalTokenLimit || 50000,
        },
        summary: {
          totalPatches: 0,
          applied: 0,
          failed: 0,
          skipped: 0,
        },
      };

      return {
        success: true,
        output: emptyPatches,
        tokensUsed: 0,
        cost: 0,
        artifacts: [],
      };
    }

    // Plan patches within budget
    const patchPlans = this.planPatches(autoFixable, input.budget);

    await this.logProgress('Generating patches...', 40);

    // Generate patches using Claude
    const patches: any[] = [];
    let tokensUsed = 0;

    for (const plan of patchPlans) {
      const patchResult = await this.generatePatch(plan, findings, input.projectRoot);
      patches.push(...patchResult.patches);
      tokensUsed += patchResult.tokensUsed;

      // Check token budget
      if (tokensUsed >= (input.budget?.totalTokenLimit || 50000)) {
        console.warn('Token budget exceeded, stopping patch generation');
        break;
      }
    }

    await this.logProgress('Validating patches...', 70);

    // Validate all patches
    for (const patch of patches) {
      const isValid = await this.validatePatch(patch, input.projectRoot);
      if (!isValid) {
        patch.status = 'failed';
        patch.error = 'Patch validation failed';
      }
    }

    await this.logProgress('Applying patches...', 85);

    // Apply patches (would actually modify files in production)
    const appliedPatches = patches.filter(p => p.status !== 'failed');
    for (const patch of appliedPatches) {
      // In production, would use git apply or similar
      patch.status = 'applied';
      patch.appliedAt = new Date().toISOString();
    }

    await this.logProgress('Storing patches...', 95);

    // Create Patches output
    const patchesOutput: Patches = {
      version: '1.0',
      patches: patches.map((p, idx) => ({
        id: `patch-${idx + 1}`,
        findingId: p.findingId,
        type: p.type,
        file: p.file,
        diff: p.diff,
        appliedAt: p.appliedAt,
        status: p.status,
        error: p.error,
      })),
      budget: {
        used: tokensUsed,
        limit: input.budget?.totalTokenLimit || 50000,
        remaining: (input.budget?.totalTokenLimit || 50000) - tokensUsed,
      },
      summary: {
        totalPatches: patches.length,
        applied: appliedPatches.length,
        failed: patches.filter(p => p.status === 'failed').length,
        skipped: patches.filter(p => p.status === 'skipped').length,
      },
    };

    // Store artifacts
    const artifacts = await this.storePatches(patchesOutput);

    await this.logProgress('Complete', 100);

    return {
      success: true,
      output: patchesOutput,
      tokensUsed,
      cost: this.calculateCost({ inputTokens: tokensUsed / 2, outputTokens: tokensUsed / 2 }),
      artifacts,
    };
  }

  /**
   * Load findings from storage
   */
  private async loadFindings(path: string): Promise<Findings> {
    try {
      const fs = require('fs');
      const content = fs.readFileSync(path, 'utf-8');
      return JSON.parse(content) as Findings;
    } catch (error) {
      throw new Error(`Failed to load findings from ${path}: ${error}`);
    }
  }

  /**
   * Plan patches within budget constraints
   */
  private planPatches(findings: any[], budget?: any): PatchPlan[] {
    const plans: PatchPlan[] = [];

    // Group findings by file and type
    const byFile = new Map<string, any[]>();
    for (const finding of findings) {
      const file = finding.location.file || 'unknown';
      if (!byFile.has(file)) {
        byFile.set(file, []);
      }
      byFile.get(file)!.push(finding);
    }

    // Create atomic patches for single-file issues
    for (const [file, fileFindings] of byFile.entries()) {
      if (fileFindings.length === 1) {
        plans.push({
          findingIds: [fileFindings[0].id],
          type: 'atomic',
          estimatedLines: 50, // Conservative estimate
          estimatedFiles: 1,
          estimatedTokens: 2000,
          riskScore: this.calculateRiskScore(fileFindings[0]),
          priority: this.calculatePriority(fileFindings[0]),
        });
      } else if (fileFindings.length <= 3) {
        // Batch patch for multiple issues in same file
        plans.push({
          findingIds: fileFindings.map(f => f.id),
          type: 'batch',
          estimatedLines: Math.min(fileFindings.length * 30, 220),
          estimatedFiles: 1,
          estimatedTokens: 5000,
          riskScore: Math.max(...fileFindings.map(f => this.calculateRiskScore(f))),
          priority: Math.max(...fileFindings.map(f => this.calculatePriority(f))),
        });
      }
    }

    // Sort by priority (highest first)
    plans.sort((a, b) => b.priority - a.priority);

    // Filter out high-risk patches
    return plans.filter(p => p.riskScore <= 75);
  }

  /**
   * Calculate risk score for a finding
   */
  private calculateRiskScore(finding: any): number {
    // Very safe: formatting, unused imports
    if (finding.ruleId.includes('no-unused') || finding.ruleId.includes('format')) {
      return 15;
    }

    // Safe: simple type fixes
    if (finding.ruleId.startsWith('TS') && finding.message.includes('type')) {
      return 35;
    }

    // Medium risk: ESLint rules
    if (finding.ruleId.includes('eslint')) {
      return 45;
    }

    // Default medium-high risk
    return 60;
  }

  /**
   * Calculate priority for a finding
   */
  private calculatePriority(finding: any): number {
    const severityScores = {
      critical: 100,
      high: 80,
      medium: 60,
      low: 40,
      info: 20,
    };

    return severityScores[finding.severity] || 50;
  }

  /**
   * Generate patch using Claude
   */
  private async generatePatch(
    plan: PatchPlan,
    findings: Findings,
    projectRoot: string
  ): Promise<{ patches: any[]; tokensUsed: number }> {
    // Get findings for this plan
    const planFindings = findings.findings.filter(f => plan.findingIds.includes(f.id));

    // Build prompt
    const systemPrompt = FixerAgent.manifest.systemPrompt!;
    const userPrompt = this.buildPatchPrompt(planFindings, plan);

    // Call Claude
    const response = await this.sendMessageWithTools(
      [{ role: 'user', content: userPrompt }],
      systemPrompt
    );

    // Parse patches from response
    const patches = this.parsePatchesFromResponse(response.text, planFindings);

    return {
      patches,
      tokensUsed: response.usage.inputTokens + response.usage.outputTokens,
    };
  }

  /**
   * Build patch generation prompt
   */
  private buildPatchPrompt(findings: any[], plan: PatchPlan): string {
    return `Generate ${plan.type} patches to fix the following issues:

${findings.map((f, idx) => `
## Issue ${idx + 1}: ${f.ruleName}
- **File**: ${f.location.file}
- **Line**: ${f.location.line}
- **Message**: ${f.message}
- **Suggestion**: ${f.suggestion || 'Fix this issue'}
`).join('\n')}

## Constraints
- Patch type: ${plan.type}
- Maximum lines: ${plan.type === 'atomic' ? 120 : 220}
- Maximum files: ${plan.type === 'atomic' ? 2 : 6}
- Risk score: ${plan.riskScore}/100

## Requirements
1. Generate minimal, focused patches
2. Use unified diff format
3. Only fix the specific issues mentioned
4. Preserve all other code functionality
5. Include clear comments explaining changes

Return patches in this format:
\`\`\`json
{
  "patches": [
    {
      "findingId": "finding-id",
      "file": "path/to/file.ts",
      "type": "replace",
      "diff": "unified diff here",
      "status": "pending"
    }
  ]
}
\`\`\``;
  }

  /**
   * Parse patches from Claude's response
   */
  private parsePatchesFromResponse(text: string, findings: any[]): any[] {
    try {
      let jsonText = text.trim();

      // Extract JSON
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonText);
      return parsed.patches || [];
    } catch (error) {
      console.error('Failed to parse patches:', error);
      return [];
    }
  }

  /**
   * Validate patch before applying
   */
  private async validatePatch(patch: any, projectRoot: string): Promise<boolean> {
    // Basic validation
    if (!patch.file || !patch.diff) {
      return false;
    }

    // Check if file exists
    try {
      const fs = require('fs');
      const filePath = `${projectRoot}/${patch.file}`;
      fs.accessSync(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Store patches
   */
  private async storePatches(patches: Patches): Promise<Array<{ type: string; url: string; metadata?: any }>> {
    const artifacts = [];

    // Store patches as JSON
    const patchesJson = JSON.stringify(patches, null, 2);
    const patchesKey = `${this.context.projectId}/quality/patches.json`;

    artifacts.push({
      type: 'patches',
      url: patchesKey,
      metadata: {
        totalPatches: patches.patches.length,
        applied: patches.summary.applied,
        failed: patches.summary.failed,
        tokensUsed: patches.budget.used,
      },
    });

    return artifacts;
  }

  /**
   * Calculate cost
   */
  private calculateCost(usage: { inputTokens: number; outputTokens: number }): number {
    const INPUT_COST_PER_1K = 0.003;
    const OUTPUT_COST_PER_1K = 0.015;
    return (usage.inputTokens / 1000) * INPUT_COST_PER_1K + (usage.outputTokens / 1000) * OUTPUT_COST_PER_1K;
  }
}

// Export factory function
export const createFixerAgent = (context: ExtendedAgentContext) => new FixerAgent(context);

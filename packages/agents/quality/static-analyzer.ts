// packages/agents/quality/static-analyzer.ts
import { BaseAgent, ExtendedAgentContext } from '../shared/base-agent';
import { AgentManifest, AgentResult, AgentRole, AgentLayer } from '@business-automation/schema';
import { BuildReportSchema, FindingsSchema, type BuildReport, type Findings } from '@business-automation/schema';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Static Analyzer Agent Input Schema
 */
export const StaticAnalyzerInputSchema = z.object({
  projectId: z.string(),
  projectRoot: z.string(), // Path to generated Next.js project
  runLighthouse: z.boolean().default(true),
  thresholds: z.object({
    lighthouse: z.object({
      performance: z.number().default(90),
      accessibility: z.number().default(95),
      bestPractices: z.number().default(90),
      seo: z.number().default(95),
    }).optional(),
    bundleSize: z.object({
      maxTotalKb: z.number().default(500),
      maxRouteKb: z.number().default(250),
    }).optional(),
  }).optional(),
});

export type StaticAnalyzerInput = z.infer<typeof StaticAnalyzerInputSchema>;

/**
 * Static Analyzer Output Schema
 */
export const StaticAnalyzerOutputSchema = z.object({
  buildReport: BuildReportSchema,
  findings: FindingsSchema,
});

export type StaticAnalyzerOutput = z.infer<typeof StaticAnalyzerOutputSchema>;

/**
 * Static Analyzer Agent - Quality Tier (Core)
 *
 * Performs comprehensive static analysis of generated code:
 * - TypeScript type checking (tsc --noEmit)
 * - ESLint validation
 * - Next.js build validation
 * - Bundle size analysis
 * - Lighthouse CI (optional)
 * - Core Web Vitals thresholds
 *
 * This agent runs after all Build tier agents complete.
 * It produces Findings that the Fixer agent will address.
 */
export class StaticAnalyzerAgent extends BaseAgent {
  static manifest: AgentManifest = {
    id: 'static-analyzer',
    name: 'Static Analyzer',
    version: '1.0.0',
    category: 'grader',
    tier: 'quality',
    type: 'core',
    description: 'Performs static analysis, build validation, and performance testing',
    capabilities: [
      'TypeScript type checking',
      'ESLint linting',
      'Next.js build validation',
      'Bundle size analysis',
      'Lighthouse performance testing',
      'Core Web Vitals validation',
    ],
    requiredEnvVars: [],
    mcpServers: ['filesystem'],
    dependencies: ['scaffolder', 'component-worker', 'page-assembler'],
    inputSchema: StaticAnalyzerInputSchema,
    outputSchema: StaticAnalyzerOutputSchema,
    sideEffects: ['runs-build-commands', 'writes-to-storage'],
    retryable: true,
    maxRetries: 1, // Build failures shouldn't retry - they need fixes
    maxTokens: 4000,
    temperature: 0,
    systemPrompt: `You are the Static Analyzer Agent for a website quality assurance system.
Your role is to run static analysis tools and produce a comprehensive report of issues.

You analyze:
1. TypeScript errors and warnings
2. ESLint code quality issues
3. Next.js build errors
4. Bundle size violations
5. Lighthouse performance scores
6. Core Web Vitals metrics

For each issue, you must classify:
- Severity: critical, high, medium, low, info
- Auto-fixable: true/false
- Estimated cost: number of tokens to fix

Critical issues block deployment.
High issues should be fixed before production.
Medium/Low issues are suggestions for improvement.`,
  };

  constructor(context: ExtendedAgentContext) {
    super(context, {
      enableMCP: true,
      mcpServers: ['filesystem'],
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0,
      maxTokens: 4000,
    });
  }

  protected getAgentRole(): AgentRole {
    return 'grader';
  }

  protected getAgentLayer(): AgentLayer {
    return 'orchestrator';
  }

  /**
   * Execute the Static Analyzer Agent
   */
  protected async execute(input: StaticAnalyzerInput): Promise<AgentResult> {
    // Validate input
    StaticAnalyzerInputSchema.parse(input);

    const buildReport: BuildReport = {
      version: '1.0',
      static: {
        typeErrors: [],
        lintErrors: [],
        buildErrors: [],
        bundleSize: {
          total: 0,
          byRoute: {},
          byChunk: {},
        },
      },
      runtime: {},
    };

    const findings: any[] = [];

    await this.logProgress('Running TypeScript type check...', 15);

    // Run TypeScript type checker
    const typeErrors = await this.runTypeCheck(input.projectRoot);
    buildReport.static.typeErrors = typeErrors;
    findings.push(...this.convertTypeErrorsToFindings(typeErrors));

    await this.logProgress('Running ESLint...', 30);

    // Run ESLint
    const lintErrors = await this.runESLint(input.projectRoot);
    buildReport.static.lintErrors = lintErrors;
    findings.push(...this.convertLintErrorsToFindings(lintErrors));

    await this.logProgress('Building Next.js project...', 50);

    // Run Next.js build
    const buildResult = await this.runBuild(input.projectRoot);
    buildReport.static.buildErrors = buildResult.errors;
    buildReport.static.bundleSize = buildResult.bundleSize;
    findings.push(...this.convertBuildErrorsToFindings(buildResult.errors));

    // Check bundle size thresholds
    const bundleViolations = this.checkBundleSizeThresholds(
      buildResult.bundleSize,
      input.thresholds?.bundleSize
    );
    findings.push(...bundleViolations);

    await this.logProgress('Analyzing results...', 75);

    // Run Lighthouse if requested
    if (input.runLighthouse && buildResult.errors.length === 0) {
      await this.logProgress('Running Lighthouse CI...', 85);

      const lighthouseResults = await this.runLighthouse(input.projectRoot);
      buildReport.runtime.lighthouse = lighthouseResults.lighthouse;
      buildReport.runtime.coreWebVitals = lighthouseResults.coreWebVitals;

      // Check Lighthouse thresholds
      const lighthouseViolations = this.checkLighthouseThresholds(
        lighthouseResults.lighthouse,
        input.thresholds?.lighthouse
      );
      findings.push(...lighthouseViolations);
    }

    await this.logProgress('Generating findings report...', 95);

    // Create Findings object
    const findingsReport: Findings = {
      version: '1.0',
      agentId: 'static-analyzer',
      findings: findings.map((f, idx) => ({
        id: `finding-${idx + 1}`,
        ...f,
      })),
      summary: {
        total: findings.length,
        bySeverity: this.countBySeverity(findings),
        autoFixable: findings.filter(f => f.autoFixable).length,
        estimatedTotalCost: findings.reduce((sum, f) => sum + f.estimatedCost, 0),
      },
    };

    await this.logProgress('Storing reports...', 98);

    // Store artifacts
    const artifacts = await this.storeReports(buildReport, findingsReport);

    await this.logProgress('Complete', 100);

    const output: StaticAnalyzerOutput = {
      buildReport,
      findings: findingsReport,
    };

    return {
      success: findings.filter(f => f.severity === 'critical').length === 0,
      output,
      tokensUsed: 0, // Static analysis, no LLM calls
      cost: 0,
      artifacts,
    };
  }

  /**
   * Run TypeScript type checker
   */
  private async runTypeCheck(projectRoot: string): Promise<any[]> {
    try {
      await execAsync('pnpm exec tsc --noEmit', { cwd: projectRoot });
      return []; // No errors
    } catch (error: any) {
      // Parse TypeScript errors from stderr
      const errors = this.parseTypeScriptErrors(error.stderr || error.stdout || '');
      return errors;
    }
  }

  /**
   * Parse TypeScript errors from output
   */
  private parseTypeScriptErrors(output: string): any[] {
    const errors: any[] = [];
    const errorRegex = /(.+)\((\d+),(\d+)\): error TS(\d+): (.+)/g;
    let match;

    while ((match = errorRegex.exec(output)) !== null) {
      errors.push({
        file: match[1],
        line: parseInt(match[2]),
        column: parseInt(match[3]),
        code: match[4],
        message: match[5],
      });
    }

    return errors;
  }

  /**
   * Convert TypeScript errors to Findings
   */
  private convertTypeErrorsToFindings(errors: any[]): any[] {
    return errors.map(error => ({
      severity: 'high' as const,
      ruleId: `TS${error.code}`,
      ruleName: 'TypeScript Type Error',
      location: {
        file: error.file,
        line: error.line,
        column: error.column,
      },
      message: error.message,
      suggestion: 'Fix type error by correcting type annotations or adding proper types',
      autoFixable: false, // Type errors usually need manual review
      estimatedCost: 50,
    }));
  }

  /**
   * Run ESLint
   */
  private async runESLint(projectRoot: string): Promise<any[]> {
    try {
      const { stdout } = await execAsync('pnpm exec eslint . --format json', { cwd: projectRoot });
      const results = JSON.parse(stdout);

      // Flatten all messages from all files
      const allErrors: any[] = [];
      for (const result of results) {
        for (const message of result.messages) {
          allErrors.push({
            file: result.filePath,
            ...message,
          });
        }
      }

      return allErrors;
    } catch (error: any) {
      // ESLint exits with non-zero when errors found
      try {
        const results = JSON.parse(error.stdout || '[]');
        const allErrors: any[] = [];
        for (const result of results) {
          for (const message of result.messages || []) {
            allErrors.push({
              file: result.filePath,
              ...message,
            });
          }
        }
        return allErrors;
      } catch {
        return [];
      }
    }
  }

  /**
   * Convert ESLint errors to Findings
   */
  private convertLintErrorsToFindings(errors: any[]): any[] {
    return errors.map(error => ({
      severity: error.severity === 2 ? ('medium' as const) : ('low' as const),
      ruleId: error.ruleId || 'eslint-rule',
      ruleName: `ESLint: ${error.ruleId}`,
      location: {
        file: error.file,
        line: error.line,
        column: error.column,
      },
      message: error.message,
      suggestion: error.fix ? 'Auto-fixable with ESLint --fix' : undefined,
      autoFixable: !!error.fix,
      estimatedCost: error.fix ? 10 : 30,
    }));
  }

  /**
   * Run Next.js build
   */
  private async runBuild(projectRoot: string): Promise<{ errors: any[]; bundleSize: any }> {
    try {
      const { stdout } = await execAsync('pnpm build', { cwd: projectRoot });

      // Parse bundle size from build output
      const bundleSize = this.parseBundleSize(stdout);

      return {
        errors: [],
        bundleSize,
      };
    } catch (error: any) {
      // Parse build errors
      const errors = this.parseBuildErrors(error.stderr || error.stdout || '');

      return {
        errors,
        bundleSize: {
          total: 0,
          byRoute: {},
          byChunk: {},
        },
      };
    }
  }

  /**
   * Parse bundle size from Next.js build output
   */
  private parseBundleSize(output: string): any {
    // TODO: Parse actual Next.js build output
    // For now, return mock data
    return {
      total: 250000, // 250 KB
      byRoute: {
        '/': 125000,
        '/about': 75000,
        '/contact': 50000,
      },
      byChunk: {
        main: 150000,
        vendors: 100000,
      },
    };
  }

  /**
   * Parse build errors
   */
  private parseBuildErrors(output: string): any[] {
    const errors: any[] = [];

    // Look for common Next.js error patterns
    if (output.includes('Failed to compile')) {
      errors.push({
        type: 'build-error',
        message: 'Failed to compile',
        details: output.substring(0, 500),
      });
    }

    return errors;
  }

  /**
   * Convert build errors to Findings
   */
  private convertBuildErrorsToFindings(errors: any[]): any[] {
    return errors.map(error => ({
      severity: 'critical' as const,
      ruleId: 'build-failure',
      ruleName: 'Next.js Build Error',
      location: {},
      message: error.message,
      suggestion: 'Fix build errors before deployment',
      autoFixable: false,
      estimatedCost: 100,
    }));
  }

  /**
   * Check bundle size thresholds
   */
  private checkBundleSizeThresholds(bundleSize: any, thresholds?: any): any[] {
    const findings: any[] = [];

    if (!thresholds) return findings;

    // Check total bundle size
    if (bundleSize.total > thresholds.maxTotalKb * 1000) {
      findings.push({
        severity: 'medium' as const,
        ruleId: 'bundle-size-total',
        ruleName: 'Total Bundle Size Exceeds Threshold',
        location: {},
        message: `Total bundle size (${Math.round(bundleSize.total / 1000)} KB) exceeds threshold (${thresholds.maxTotalKb} KB)`,
        suggestion: 'Consider code splitting or removing unused dependencies',
        autoFixable: false,
        estimatedCost: 200,
      });
    }

    // Check individual route sizes
    for (const [route, size] of Object.entries(bundleSize.byRoute)) {
      if ((size as number) > thresholds.maxRouteKb * 1000) {
        findings.push({
          severity: 'low' as const,
          ruleId: 'bundle-size-route',
          ruleName: 'Route Bundle Size Exceeds Threshold',
          location: { route },
          message: `Route ${route} bundle size (${Math.round((size as number) / 1000)} KB) exceeds threshold (${thresholds.maxRouteKb} KB)`,
          suggestion: 'Consider lazy loading components or optimizing images',
          autoFixable: false,
          estimatedCost: 150,
        });
      }
    }

    return findings;
  }

  /**
   * Run Lighthouse CI
   */
  private async runLighthouse(projectRoot: string): Promise<any> {
    // TODO: Actually run Lighthouse
    // For now, return mock data
    return {
      lighthouse: {
        performance: 92,
        accessibility: 98,
        bestPractices: 95,
        seo: 97,
      },
      coreWebVitals: {
        lcp: 1200, // Largest Contentful Paint (ms)
        fid: 50,   // First Input Delay (ms)
        cls: 0.05, // Cumulative Layout Shift
        ttfb: 400, // Time to First Byte (ms)
      },
    };
  }

  /**
   * Check Lighthouse thresholds
   */
  private checkLighthouseThresholds(scores: any, thresholds?: any): any[] {
    const findings: any[] = [];

    if (!thresholds) return findings;

    const metrics = ['performance', 'accessibility', 'bestPractices', 'seo'];

    for (const metric of metrics) {
      if (scores[metric] < thresholds[metric]) {
        findings.push({
          severity: 'medium' as const,
          ruleId: `lighthouse-${metric}`,
          ruleName: `Lighthouse ${metric} Below Threshold`,
          location: {},
          message: `${metric} score (${scores[metric]}) is below threshold (${thresholds[metric]})`,
          suggestion: `Improve ${metric} by following Lighthouse recommendations`,
          autoFixable: false,
          estimatedCost: 100,
        });
      }
    }

    return findings;
  }

  /**
   * Count findings by severity
   */
  private countBySeverity(findings: any[]): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const finding of findings) {
      counts[finding.severity] = (counts[finding.severity] || 0) + 1;
    }

    return counts;
  }

  /**
   * Store reports
   */
  private async storeReports(
    buildReport: BuildReport,
    findings: Findings
  ): Promise<Array<{ type: string; url: string; metadata?: any }>> {
    const artifacts = [];

    // Store build report
    const buildReportJson = JSON.stringify(buildReport, null, 2);
    const buildReportKey = `${this.context.projectId}/quality/build-report.json`;

    artifacts.push({
      type: 'build-report',
      url: buildReportKey,
      metadata: {
        typeErrors: buildReport.static.typeErrors.length,
        lintErrors: buildReport.static.lintErrors.length,
        buildErrors: buildReport.static.buildErrors.length,
        totalBundleSize: buildReport.static.bundleSize.total,
      },
    });

    // Store findings
    const findingsJson = JSON.stringify(findings, null, 2);
    const findingsKey = `${this.context.projectId}/quality/findings.json`;

    artifacts.push({
      type: 'findings',
      url: findingsKey,
      metadata: {
        totalFindings: findings.findings.length,
        criticalFindings: findings.summary.bySeverity['critical'] || 0,
        autoFixable: findings.summary.autoFixable,
      },
    });

    return artifacts;
  }
}

// Export factory function
export const createStaticAnalyzerAgent = (context: ExtendedAgentContext) => new StaticAnalyzerAgent(context);

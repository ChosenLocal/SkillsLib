// packages/agents/jobs/website-generator-workflow.ts
import { PrismaClient } from '@business-automation/database';
import { inngest } from './inngest-client';
import { connectRedis } from '../shared/redis-client';
import { initializeStorage } from '../shared/storage-client';
import { initializeMCP, getDefaultMCPConfigs } from '../shared/mcp-manager';
import {
  PlannerAgent,
  IAArchitectAgent,
  BrandInterpreterAgent,
  BacklogManagerAgent,
  ScaffolderAgent,
  ComponentWorkerAgent,
  PageAssemblerAgent,
  StaticAnalyzerAgent,
  FixerAgent,
} from '../index';
import type { ExtendedAgentContext } from '../shared/base-agent';

/**
 * Website Generator Workflow - 3-Tier Architecture
 *
 * This Inngest function orchestrates the complete pipeline:
 * 1. Strategy Tier - Generate specs from CompanyProfile
 * 2. Build Tier - Generate Next.js code
 * 3. Quality Tier - Validate and fix
 *
 * The workflow uses Inngest's step.run() for atomic operations
 * and step.waitForEvent() for parallel execution coordination.
 */
export const websiteGeneratorWorkflow = inngest.createFunction(
  {
    id: 'website-generator',
    name: 'Website Generator Workflow',
    retries: 1, // Limited retries - failures should be investigated
    concurrency: {
      limit: 10, // Max 10 concurrent website generations
      key: 'event.data.tenantId', // Per-tenant concurrency
    },
  },
  { event: 'website/generate' },
  async ({ event, step }) => {
    const { projectId, companyProfileId, tenantId, userId } = event.data;

    console.log(`[WebsiteGenerator] Starting for project: ${projectId}`);

    // ================================================================
    // INITIALIZATION
    // ================================================================

    const services = await step.run('initialize-services', async () => {
      const prisma = new PrismaClient();
      await connectRedis();
      initializeStorage();

      const mcpConfigs = getDefaultMCPConfigs();
      if (mcpConfigs.length > 0) {
        await initializeMCP(mcpConfigs);
      }

      return { prisma };
    });

    // ================================================================
    // TIER 1: STRATEGY AGENTS
    // ================================================================

    // Run Planner Agent
    const siteSpec = await step.run('strategy-planner', async () => {
      console.log('[Strategy] Running Planner Agent...');

      const context: ExtendedAgentContext = {
        projectId,
        tenantId,
        userId,
        prisma: services.prisma,
      };

      const planner = new PlannerAgent(context);
      const result = await planner.run({
        companyProfileId,
        constraints: event.data.constraints,
      });

      if (!result.success) {
        throw new Error(`Planner failed: ${result.error}`);
      }

      // Store SiteSpec
      const fs = require('fs');
      const siteSpecPath = `/tmp/${projectId}/specs/site-spec.json`;
      fs.mkdirSync(`/tmp/${projectId}/specs`, { recursive: true });
      fs.writeFileSync(siteSpecPath, JSON.stringify(result.output, null, 2));

      return {
        siteSpec: result.output,
        siteSpecPath,
        cost: result.cost,
        tokensUsed: result.tokensUsed,
      };
    });

    // Run IA Architect and Brand Interpreter in parallel
    const [iaPlan, designSpec] = await Promise.all([
      step.run('strategy-ia-architect', async () => {
        console.log('[Strategy] Running IA Architect Agent...');

        const context: ExtendedAgentContext = {
          projectId,
          tenantId,
          userId,
          prisma: services.prisma,
        };

        const iaArchitect = new IAArchitectAgent(context);
        const result = await iaArchitect.run({
          projectId,
          siteSpecPath: siteSpec.siteSpecPath,
        });

        if (!result.success) {
          throw new Error(`IA Architect failed: ${result.error}`);
        }

        // Store IAPlan
        const fs = require('fs');
        const iaPlanPath = `/tmp/${projectId}/specs/ia-plan.json`;
        fs.writeFileSync(iaPlanPath, JSON.stringify(result.output, null, 2));

        return {
          iaPlan: result.output,
          iaPlanPath,
          cost: result.cost,
          tokensUsed: result.tokensUsed,
        };
      }),

      step.run('strategy-brand-interpreter', async () => {
        console.log('[Strategy] Running Brand Interpreter Agent...');

        const context: ExtendedAgentContext = {
          projectId,
          tenantId,
          userId,
          prisma: services.prisma,
        };

        const brandInterpreter = new BrandInterpreterAgent(context);
        const result = await brandInterpreter.run({
          projectId,
          companyProfileId,
          siteSpecPath: siteSpec.siteSpecPath,
        });

        if (!result.success) {
          throw new Error(`Brand Interpreter failed: ${result.error}`);
        }

        // Store DesignSpec
        const fs = require('fs');
        const designSpecPath = `/tmp/${projectId}/specs/design-spec.json`;
        fs.writeFileSync(designSpecPath, JSON.stringify(result.output, null, 2));

        return {
          designSpec: result.output,
          designSpecPath,
          cost: result.cost,
          tokensUsed: result.tokensUsed,
        };
      }),
    ]);

    // Run Backlog Manager
    const workQueue = await step.run('strategy-backlog-manager', async () => {
      console.log('[Strategy] Running Backlog Manager Agent...');

      const context: ExtendedAgentContext = {
        projectId,
        tenantId,
        userId,
        prisma: services.prisma,
      };

      const backlogManager = new BacklogManagerAgent(context);
      const result = await backlogManager.run({
        projectId,
        siteSpecPath: siteSpec.siteSpecPath,
        designSpecPath: designSpec.designSpecPath,
        iaPlanPath: iaPlan.iaPlanPath,
      });

      if (!result.success) {
        throw new Error(`Backlog Manager failed: ${result.error}`);
      }

      return {
        workQueue: result.output,
        cost: result.cost,
        tokensUsed: result.tokensUsed,
      };
    });

    // ================================================================
    // TIER 2: BUILD AGENTS
    // ================================================================

    // Run Scaffolder (must run first)
    const scaffold = await step.run('build-scaffolder', async () => {
      console.log('[Build] Running Scaffolder Agent...');

      const context: ExtendedAgentContext = {
        projectId,
        tenantId,
        userId,
        prisma: services.prisma,
      };

      const scaffolder = new ScaffolderAgent(context);
      const result = await scaffolder.run({
        projectId,
        siteSpecPath: siteSpec.siteSpecPath,
        designSpecPath: designSpec.designSpecPath,
      });

      if (!result.success) {
        throw new Error(`Scaffolder failed: ${result.error}`);
      }

      return {
        output: result.output,
        projectRoot: `/tmp/${projectId}/build`,
      };
    });

    // Run Component Workers in parallel (ephemeral agents)
    const componentTasks = workQueue.workQueue.tasks.filter(t => t.type === 'component');

    const components = await step.run('build-components-parallel', async () => {
      console.log(`[Build] Running ${componentTasks.length} Component Workers in parallel...`);

      const componentResults = await Promise.all(
        componentTasks.map(async (task) => {
          const context: ExtendedAgentContext = {
            projectId,
            tenantId,
            userId,
            prisma: services.prisma,
          };

          const componentWorker = new ComponentWorkerAgent(context);
          const result = await componentWorker.run(task.input);

          if (!result.success) {
            console.warn(`Component Worker failed for ${task.id}: ${result.error}`);
            return null;
          }

          return {
            componentId: result.output.componentId,
            files: result.output.files,
            cost: result.cost,
            tokensUsed: result.tokensUsed,
          };
        })
      );

      return componentResults.filter(r => r !== null);
    });

    // Run Page Assemblers
    const pageTasks = workQueue.workQueue.tasks.filter(t => t.type === 'page');

    const pages = await step.run('build-pages', async () => {
      console.log(`[Build] Running ${pageTasks.length} Page Assemblers...`);

      const pageResults = await Promise.all(
        pageTasks.map(async (task) => {
          const context: ExtendedAgentContext = {
            projectId,
            tenantId,
            userId,
            prisma: services.prisma,
          };

          const pageAssembler = new PageAssemblerAgent(context);
          const result = await pageAssembler.run({
            ...task.input,
            availableComponents: components.map(c => c!.componentId),
          });

          if (!result.success) {
            console.warn(`Page Assembler failed for ${task.id}: ${result.error}`);
            return null;
          }

          return {
            route: result.output.route,
            files: result.output.files,
            cost: result.cost,
            tokensUsed: result.tokensUsed,
          };
        })
      );

      return pageResults.filter(r => r !== null);
    });

    // ================================================================
    // TIER 3: QUALITY AGENTS
    // ================================================================

    // Run Static Analyzer
    const findings = await step.run('quality-static-analyzer', async () => {
      console.log('[Quality] Running Static Analyzer Agent...');

      const context: ExtendedAgentContext = {
        projectId,
        tenantId,
        userId,
        prisma: services.prisma,
      };

      const staticAnalyzer = new StaticAnalyzerAgent(context);
      const result = await staticAnalyzer.run({
        projectId,
        projectRoot: scaffold.projectRoot,
        runLighthouse: true,
        thresholds: {
          lighthouse: {
            performance: 90,
            accessibility: 95,
            bestPractices: 90,
            seo: 95,
          },
          bundleSize: {
            maxTotalKb: 500,
            maxRouteKb: 250,
          },
        },
      });

      // Store findings
      const fs = require('fs');
      const findingsPath = `/tmp/${projectId}/quality/findings.json`;
      fs.mkdirSync(`/tmp/${projectId}/quality`, { recursive: true });
      fs.writeFileSync(findingsPath, JSON.stringify(result.output.findings, null, 2));

      return {
        buildReport: result.output.buildReport,
        findings: result.output.findings,
        findingsPath,
        hasErrors: result.output.findings.summary.bySeverity['critical'] > 0,
      };
    });

    // Run Fixer if there are auto-fixable issues
    const patches = await step.run('quality-fixer', async () => {
      if (findings.findings.summary.autoFixable === 0) {
        console.log('[Quality] No auto-fixable issues, skipping Fixer');
        return { patches: [], skipped: true };
      }

      console.log(`[Quality] Running Fixer Agent (${findings.findings.summary.autoFixable} auto-fixable issues)...`);

      const context: ExtendedAgentContext = {
        projectId,
        tenantId,
        userId,
        prisma: services.prisma,
      };

      const fixer = new FixerAgent(context);
      const result = await fixer.run({
        projectId,
        projectRoot: scaffold.projectRoot,
        findingsPath: findings.findingsPath,
        budget: {
          atomic: {
            maxLines: 120,
            maxFiles: 2,
          },
          batch: {
            maxLines: 220,
            maxFiles: 6,
          },
          totalTokenLimit: 50000,
        },
      });

      if (!result.success) {
        console.warn(`Fixer failed: ${result.error}`);
        return { patches: [], skipped: false, error: result.error };
      }

      return {
        patches: result.output.patches,
        summary: result.output.summary,
        cost: result.cost,
        tokensUsed: result.tokensUsed,
      };
    });

    // ================================================================
    // FINALIZATION
    // ================================================================

    const summary = await step.run('finalize-and-summarize', async () => {
      // Calculate total costs
      const totalCost =
        siteSpec.cost +
        iaPlan.cost +
        designSpec.cost +
        workQueue.cost +
        components.reduce((sum, c) => sum + (c?.cost || 0), 0) +
        pages.reduce((sum, p) => sum + (p?.cost || 0), 0) +
        (patches.cost || 0);

      const totalTokens =
        siteSpec.tokensUsed +
        iaPlan.tokensUsed +
        designSpec.tokensUsed +
        workQueue.tokensUsed +
        components.reduce((sum, c) => sum + (c?.tokensUsed || 0), 0) +
        pages.reduce((sum, p) => sum + (p?.tokensUsed || 0), 0) +
        (patches.tokensUsed || 0);

      // Update project status
      await services.prisma.project.update({
        where: { id: projectId },
        data: {
          status: findings.hasErrors ? 'FAILED' : 'COMPLETE',
        },
      });

      return {
        projectId,
        status: findings.hasErrors ? 'FAILED' : 'COMPLETE',
        costs: {
          total: totalCost,
          tokens: totalTokens,
          breakdown: {
            strategy: siteSpec.cost + iaPlan.cost + designSpec.cost + workQueue.cost,
            build: components.reduce((sum, c) => sum + (c?.cost || 0), 0) +
                   pages.reduce((sum, p) => sum + (p?.cost || 0), 0),
            quality: patches.cost || 0,
          },
        },
        artifacts: {
          components: components.length,
          pages: pages.length,
          findings: findings.findings.findings.length,
          patches: patches.patches?.length || 0,
        },
        buildReport: findings.buildReport,
      };
    });

    console.log(`[WebsiteGenerator] Completed for project: ${projectId}`);
    console.log(`Total cost: $${summary.costs.total.toFixed(4)}, Tokens: ${summary.costs.tokens}`);

    return summary;
  }
);

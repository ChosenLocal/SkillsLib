#!/usr/bin/env node
/**
 * Agent CLI - Local Testing Tool
 *
 * Allows developers to test agents locally without deploying to production.
 *
 * Usage:
 *   pnpm agent test planner --project-id=<uuid>
 *   pnpm agent test-workflow website-generator --project-id=<uuid> --profile-id=<uuid>
 *   pnpm agent list
 *   pnpm agent info planner
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import { PrismaClient } from '@business-automation/database';
import { getRegistryStats, getAgentClass } from '../orchestrator/registry';
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

const program = new Command();

/**
 * Initialize services for testing
 */
async function initializeServices() {
  const prisma = new PrismaClient();

  // Verify database connection
  try {
    await prisma.$connect();
  } catch (error) {
    console.error(chalk.red('Failed to connect to database. Ensure DATABASE_URL is set.'));
    process.exit(1);
  }

  return { prisma };
}

/**
 * List all available agents
 */
program
  .command('list')
  .description('List all registered agents')
  .action(async () => {
    const stats = getRegistryStats();

    console.log(chalk.bold('\n📋 Registered Agents\n'));
    console.log(`Total: ${chalk.cyan(stats.total)} agents\n`);

    for (const [layer, agents] of Object.entries(stats.byLayer)) {
      console.log(chalk.bold(`${layer.toUpperCase()} Tier:`));
      agents.forEach((agentId: string) => {
        const AgentClass = getAgentClass(agentId);
        if (AgentClass) {
          const manifest = (AgentClass as any).manifest;
          console.log(`  • ${chalk.cyan(agentId)} - ${manifest.name} (${manifest.type})`);
          console.log(`    ${chalk.gray(manifest.description)}`);
        }
      });
      console.log();
    }
  });

/**
 * Show agent information
 */
program
  .command('info <agent-id>')
  .description('Show detailed information about an agent')
  .action(async (agentId: string) => {
    const AgentClass = getAgentClass(agentId);

    if (!AgentClass) {
      console.error(chalk.red(`Agent '${agentId}' not found`));
      process.exit(1);
    }

    const manifest = (AgentClass as any).manifest;

    console.log(chalk.bold(`\n🤖 ${manifest.name}\n`));
    console.log(`ID: ${chalk.cyan(manifest.id)}`);
    console.log(`Version: ${chalk.cyan(manifest.version)}`);
    console.log(`Category: ${chalk.cyan(manifest.category)}`);
    console.log(`Tier: ${chalk.cyan(manifest.tier)}`);
    console.log(`Type: ${chalk.cyan(manifest.type)}`);
    console.log(`\nDescription: ${manifest.description}`);

    console.log(`\nCapabilities:`);
    manifest.capabilities.forEach((cap: string) => {
      console.log(`  • ${cap}`);
    });

    if (manifest.dependencies && manifest.dependencies.length > 0) {
      console.log(`\nDependencies:`);
      manifest.dependencies.forEach((dep: string) => {
        console.log(`  • ${chalk.yellow(dep)}`);
      });
    }

    if (manifest.requiredEnvVars && manifest.requiredEnvVars.length > 0) {
      console.log(`\nRequired Environment Variables:`);
      manifest.requiredEnvVars.forEach((envVar: string) => {
        const isSet = process.env[envVar];
        const status = isSet ? chalk.green('✓') : chalk.red('✗');
        console.log(`  ${status} ${envVar}`);
      });
    }

    console.log(`\nRetryable: ${manifest.retryable ? chalk.green('Yes') : chalk.red('No')}`);
    if (manifest.retryable) {
      console.log(`Max Retries: ${chalk.cyan(manifest.maxRetries)}`);
    }

    console.log(`\nModel Settings:`);
    console.log(`  Temperature: ${chalk.cyan(manifest.temperature)}`);
    console.log(`  Max Tokens: ${chalk.cyan(manifest.maxTokens)}`);
    console.log();
  });

/**
 * Test a single agent
 */
program
  .command('test <agent-id>')
  .description('Test a single agent locally')
  .option('-p, --project-id <id>', 'Project ID (UUID)')
  .option('-t, --tenant-id <id>', 'Tenant ID (UUID)')
  .option('-u, --user-id <id>', 'User ID (UUID)')
  .option('--mock', 'Use mock data instead of database')
  .action(async (agentId: string, options: any) => {
    const spinner = ora(`Initializing ${agentId} agent...`).start();

    try {
      // Get agent class
      const AgentClass = getAgentClass(agentId);
      if (!AgentClass) {
        spinner.fail(`Agent '${agentId}' not found`);
        process.exit(1);
      }

      const manifest = (AgentClass as any).manifest;
      spinner.succeed(`Loaded ${manifest.name}`);

      // Initialize services
      const { prisma } = await initializeServices();

      // Get project ID
      let projectId = options.projectId;
      if (!projectId) {
        const answer = await inquirer.prompt([
          {
            type: 'input',
            name: 'projectId',
            message: 'Enter Project ID (UUID):',
            validate: (input: string) => {
              const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
              return uuidRegex.test(input) || 'Please enter a valid UUID';
            },
          },
        ]);
        projectId = answer.projectId;
      }

      // Get tenant ID
      let tenantId = options.tenantId;
      if (!tenantId && !options.mock) {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { tenantId: true },
        });

        if (!project) {
          spinner.fail(`Project ${projectId} not found`);
          process.exit(1);
        }

        tenantId = project.tenantId;
      } else if (!tenantId) {
        tenantId = 'test-tenant-id';
      }

      // Create agent context
      const context: ExtendedAgentContext = {
        projectId,
        tenantId,
        userId: options.userId || 'test-user-id',
        prisma,
      };

      // Prompt for agent-specific input
      spinner.info('Agent requires input parameters. Starting interactive prompt...\n');

      const input = await getAgentInput(agentId, context, prisma);

      // Run agent
      spinner.start(`Running ${manifest.name}...`);

      const startTime = Date.now();
      const agent = new AgentClass(context);
      const result = await agent.run(input);
      const duration = Date.now() - startTime;

      if (result.success) {
        spinner.succeed(`${manifest.name} completed successfully in ${duration}ms`);

        console.log(chalk.bold('\n📊 Results:\n'));
        console.log(`Tokens Used: ${chalk.cyan(result.tokensUsed)}`);
        console.log(`Cost: ${chalk.green(`$${result.cost.toFixed(4)}`)}`);

        if (result.artifacts && result.artifacts.length > 0) {
          console.log(`\nArtifacts:`);
          result.artifacts.forEach((artifact: any) => {
            console.log(`  • ${artifact.type}: ${chalk.cyan(artifact.url)}`);
          });
        }

        console.log(chalk.bold('\n📝 Output:\n'));
        console.log(JSON.stringify(result.output, null, 2));
      } else {
        spinner.fail(`${manifest.name} failed`);
        console.error(chalk.red('\nError:'), result.error);
      }

      await prisma.$disconnect();
    } catch (error) {
      spinner.fail('Agent execution failed');
      console.error(chalk.red('\nError:'), error);
      process.exit(1);
    }
  });

/**
 * Test complete website generation workflow
 */
program
  .command('test-workflow <workflow-name>')
  .description('Test a complete workflow locally')
  .option('-p, --project-id <id>', 'Project ID (UUID)')
  .option('--profile-id <id>', 'Company Profile ID (UUID)')
  .option('-t, --tenant-id <id>', 'Tenant ID (UUID)')
  .option('-u, --user-id <id>', 'User ID (UUID)')
  .option('--max-pages <number>', 'Maximum pages to generate', '10')
  .option('--max-cost <number>', 'Maximum cost in USD', '50')
  .action(async (workflowName: string, options: any) => {
    if (workflowName !== 'website-generator') {
      console.error(chalk.red(`Workflow '${workflowName}' not supported yet`));
      process.exit(1);
    }

    const spinner = ora('Initializing website generator workflow...').start();

    try {
      // Initialize services
      const { prisma } = await initializeServices();

      // Get project and profile IDs
      let projectId = options.projectId;
      let companyProfileId = options.profileId;

      if (!projectId || !companyProfileId) {
        spinner.stop();
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'projectId',
            message: 'Enter Project ID (UUID):',
            when: !projectId,
            validate: (input: string) => {
              const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
              return uuidRegex.test(input) || 'Please enter a valid UUID';
            },
          },
          {
            type: 'input',
            name: 'companyProfileId',
            message: 'Enter Company Profile ID (UUID):',
            when: !companyProfileId,
            validate: (input: string) => {
              const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
              return uuidRegex.test(input) || 'Please enter a valid UUID';
            },
          },
        ]);

        projectId = projectId || answers.projectId;
        companyProfileId = companyProfileId || answers.companyProfileId;
        spinner.start('Loading project data...');
      }

      // Get tenant ID
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { tenantId: true, name: true, type: true },
      });

      if (!project) {
        spinner.fail(`Project ${projectId} not found`);
        process.exit(1);
      }

      const tenantId = options.tenantId || project.tenantId;
      const userId = options.userId || 'test-user-id';

      spinner.succeed(`Loaded project: ${chalk.cyan(project.name)}`);

      // Create context
      const context: ExtendedAgentContext = {
        projectId,
        tenantId,
        userId,
        prisma,
      };

      console.log(chalk.bold('\n🏗️  Website Generation Workflow\n'));
      console.log(`Project: ${chalk.cyan(project.name)}`);
      console.log(`Type: ${chalk.cyan(project.type)}`);
      console.log(`Max Pages: ${chalk.cyan(options.maxPages)}`);
      console.log(`Budget: ${chalk.green(`$${options.maxCost}`)}\n`);

      let totalCost = 0;
      let totalTokens = 0;

      // TIER 1: STRATEGY AGENTS
      console.log(chalk.bold.blue('━━━ STRATEGY TIER ━━━\n'));

      // 1. Planner Agent
      spinner.start('Running Planner Agent...');
      const planner = new PlannerAgent(context);
      const plannerResult = await planner.run({
        companyProfileId,
        constraints: {
          maxPages: parseInt(options.maxPages),
          budget: { maxCostUsd: parseFloat(options.maxCost) },
        },
      });

      if (!plannerResult.success) {
        spinner.fail('Planner Agent failed');
        console.error(chalk.red(plannerResult.error));
        process.exit(1);
      }

      totalCost += plannerResult.cost;
      totalTokens += plannerResult.tokensUsed;
      spinner.succeed(`Planner Agent complete (${plannerResult.tokensUsed} tokens, $${plannerResult.cost.toFixed(4)})`);

      // Store SiteSpec
      const fs = require('fs');
      const siteSpecPath = `/tmp/${projectId}/specs/site-spec.json`;
      fs.mkdirSync(`/tmp/${projectId}/specs`, { recursive: true });
      fs.writeFileSync(siteSpecPath, JSON.stringify(plannerResult.output, null, 2));

      // 2. IA Architect and Brand Interpreter in parallel
      spinner.start('Running IA Architect and Brand Interpreter in parallel...');

      const iaArchitect = new IAArchitectAgent(context);
      const brandInterpreter = new BrandInterpreterAgent(context);

      const [iaResult, designResult] = await Promise.all([
        iaArchitect.run({ projectId, siteSpecPath }),
        brandInterpreter.run({ projectId, companyProfileId, siteSpecPath }),
      ]);

      if (!iaResult.success || !designResult.success) {
        spinner.fail('Strategy agents failed');
        console.error(chalk.red(iaResult.error || designResult.error));
        process.exit(1);
      }

      totalCost += iaResult.cost + designResult.cost;
      totalTokens += iaResult.tokensUsed + designResult.tokensUsed;

      const iaPlanPath = `/tmp/${projectId}/specs/ia-plan.json`;
      const designSpecPath = `/tmp/${projectId}/specs/design-spec.json`;
      fs.writeFileSync(iaPlanPath, JSON.stringify(iaResult.output, null, 2));
      fs.writeFileSync(designSpecPath, JSON.stringify(designResult.output, null, 2));

      spinner.succeed(`Strategy agents complete (${iaResult.tokensUsed + designResult.tokensUsed} tokens, $${(iaResult.cost + designResult.cost).toFixed(4)})`);

      // 3. Backlog Manager
      spinner.start('Running Backlog Manager...');
      const backlogManager = new BacklogManagerAgent(context);
      const workQueueResult = await backlogManager.run({
        projectId,
        siteSpecPath,
        designSpecPath,
        iaPlanPath,
      });

      if (!workQueueResult.success) {
        spinner.fail('Backlog Manager failed');
        console.error(chalk.red(workQueueResult.error));
        process.exit(1);
      }

      totalCost += workQueueResult.cost;
      totalTokens += workQueueResult.tokensUsed;
      spinner.succeed(`Backlog Manager complete (${workQueueResult.tokensUsed} tokens, $${workQueueResult.cost.toFixed(4)})`);

      console.log(chalk.gray(`\nStrategy Tier Summary: ${totalTokens} tokens, $${totalCost.toFixed(4)}\n`));

      // TIER 2: BUILD AGENTS
      console.log(chalk.bold.green('━━━ BUILD TIER ━━━\n'));

      // 1. Scaffolder
      spinner.start('Running Scaffolder...');
      const scaffolder = new ScaffolderAgent(context);
      const scaffoldResult = await scaffolder.run({
        projectId,
        siteSpecPath,
        designSpecPath,
      });

      if (!scaffoldResult.success) {
        spinner.fail('Scaffolder failed');
        console.error(chalk.red(scaffoldResult.error));
        process.exit(1);
      }

      totalCost += scaffoldResult.cost;
      totalTokens += scaffoldResult.tokensUsed;
      spinner.succeed(`Scaffolder complete (${scaffoldResult.tokensUsed} tokens, $${scaffoldResult.cost.toFixed(4)})`);

      console.log(chalk.gray(`\nBuild Tier Summary: ${scaffoldResult.tokensUsed} tokens, $${scaffoldResult.cost.toFixed(4)}\n`));

      // TIER 3: QUALITY AGENTS
      console.log(chalk.bold.yellow('━━━ QUALITY TIER ━━━\n'));

      spinner.start('Running Static Analyzer...');
      const staticAnalyzer = new StaticAnalyzerAgent(context);
      const analysisResult = await staticAnalyzer.run({
        projectId,
        projectRoot: `/tmp/${projectId}/build`,
        runLighthouse: false, // Skip Lighthouse for local testing
        thresholds: {
          bundleSize: { maxTotalKb: 500, maxRouteKb: 250 },
        },
      });

      totalCost += analysisResult.cost || 0;
      totalTokens += analysisResult.tokensUsed || 0;

      if (analysisResult.success) {
        const findings = analysisResult.output.findings;
        const summary = findings.summary;

        spinner.succeed(`Static Analyzer complete`);
        console.log(`\nFindings:`);
        console.log(`  Critical: ${chalk.red(summary.bySeverity.critical)}`);
        console.log(`  High: ${chalk.yellow(summary.bySeverity.high)}`);
        console.log(`  Medium: ${summary.bySeverity.medium}`);
        console.log(`  Low: ${summary.bySeverity.low}`);
        console.log(`  Auto-fixable: ${chalk.green(summary.autoFixable)}`);
      } else {
        spinner.warn('Static Analyzer completed with warnings');
      }

      // Final Summary
      console.log(chalk.bold('\n━━━ WORKFLOW SUMMARY ━━━\n'));
      console.log(`Total Tokens: ${chalk.cyan(totalTokens)}`);
      console.log(`Total Cost: ${chalk.green(`$${totalCost.toFixed(4)}`)}`);
      console.log(`\nArtifacts stored in: ${chalk.cyan(`/tmp/${projectId}/`)}`);
      console.log();

      await prisma.$disconnect();
    } catch (error) {
      spinner.fail('Workflow execution failed');
      console.error(chalk.red('\nError:'), error);
      process.exit(1);
    }
  });

/**
 * Get agent-specific input via interactive prompts
 */
async function getAgentInput(agentId: string, context: ExtendedAgentContext, prisma: PrismaClient): Promise<any> {
  switch (agentId) {
    case 'planner':
      return inquirer.prompt([
        {
          type: 'input',
          name: 'companyProfileId',
          message: 'Company Profile ID:',
          validate: (input: string) => !!input || 'Required',
        },
      ]);

    case 'ia-architect':
      return inquirer.prompt([
        {
          type: 'input',
          name: 'siteSpecPath',
          message: 'Path to SiteSpec JSON:',
          default: `/tmp/${context.projectId}/specs/site-spec.json`,
        },
      ]);

    case 'brand-interpreter':
      return inquirer.prompt([
        {
          type: 'input',
          name: 'companyProfileId',
          message: 'Company Profile ID:',
          validate: (input: string) => !!input || 'Required',
        },
        {
          type: 'input',
          name: 'siteSpecPath',
          message: 'Path to SiteSpec JSON:',
          default: `/tmp/${context.projectId}/specs/site-spec.json`,
        },
      ]);

    case 'backlog-manager':
      return inquirer.prompt([
        {
          type: 'input',
          name: 'siteSpecPath',
          message: 'Path to SiteSpec JSON:',
          default: `/tmp/${context.projectId}/specs/site-spec.json`,
        },
        {
          type: 'input',
          name: 'designSpecPath',
          message: 'Path to DesignSpec JSON:',
          default: `/tmp/${context.projectId}/specs/design-spec.json`,
        },
        {
          type: 'input',
          name: 'iaPlanPath',
          message: 'Path to IAPlan JSON:',
          default: `/tmp/${context.projectId}/specs/ia-plan.json`,
        },
      ]);

    default:
      return {};
  }
}

program.version('1.0.0');
program.parse(process.argv);

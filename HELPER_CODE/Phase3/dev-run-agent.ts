#!/usr/bin/env node
// scripts/dev-run-agent.ts

import { Command } from 'commander';
import { createPlannerAgent } from '../packages/agents/strategy/planner-agent';
import { BaseAgent } from '../packages/agents/shared/base-agent';
import { Redis } from 'ioredis';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { z } from 'zod';

// Sample client profiles for testing
const SAMPLE_PROFILES = {
  roofing: {
    businessInfo: {
      businessName: "Summit Roofing Solutions",
      industry: "roofing",
      businessType: "contractor",
      targetMarket: "residential",
      services: ["roof-replacement", "roof-repair", "gutter-installation", "emergency-services"],
      serviceAreas: [
        { city: "Austin", state: "TX", radius: 50 }
      ],
      yearsInBusiness: 15,
    },
    brandGuidelines: {
      colorPalette: {
        primary: "#1e40af",
        secondary: "#dc2626",
        accent: "#facc15",
      },
      typography: {
        fontFamily: "Inter",
        headingFont: "Montserrat",
      },
      voiceAndTone: {
        tone: ["professional", "trustworthy", "helpful"],
        style: "conversational",
      },
    },
    goals: {
      primary: "generate-qualified-leads",
      metrics: ["form-submissions", "phone-calls", "chat-interactions"],
      targetAudience: ["homeowners", "property-managers"],
    },
    integrations: [
      { platform: "google-my-business", apiKey: "***" },
      { platform: "calendly", apiKey: "***" },
      { platform: "quickbooks", apiKey: "***" },
    ],
  },
  hvac: {
    businessInfo: {
      businessName: "CoolBreeze HVAC Services",
      industry: "hvac",
      businessType: "contractor",
      targetMarket: "residential-commercial",
      services: ["ac-installation", "heating-repair", "maintenance-plans", "indoor-air-quality"],
      serviceAreas: [
        { city: "Phoenix", state: "AZ", radius: 75 }
      ],
      yearsInBusiness: 20,
    },
    brandGuidelines: {
      colorPalette: {
        primary: "#0891b2",
        secondary: "#f97316",
        accent: "#84cc16",
      },
      typography: {
        fontFamily: "Roboto",
        headingFont: "Poppins",
      },
      voiceAndTone: {
        tone: ["friendly", "expert", "reliable"],
        style: "informative",
      },
    },
    goals: {
      primary: "service-scheduling",
      metrics: ["appointments-booked", "maintenance-signups", "emergency-calls"],
      targetAudience: ["homeowners", "business-owners"],
    },
    integrations: [
      { platform: "servicetitan", apiKey: "***" },
      { platform: "google-calendar", apiKey: "***" },
      { platform: "stripe", apiKey: "***" },
    ],
  },
};

// Agent registry
const AGENTS: Record<string, () => BaseAgent> = {
  planner: createPlannerAgent,
  // Add more agents as implemented
  // 'brand-interpreter': createBrandInterpreterAgent,
  // 'ia-architect': createIAArchitectAgent,
  // etc.
};

// CLI program
const program = new Command();

program
  .name('dev-run-agent')
  .description('Run an agent locally for testing')
  .version('1.0.0')
  .requiredOption('--agent <id>', 'Agent ID to run (e.g., planner)')
  .option('--project <id>', 'Project ID (defaults to test-[timestamp])')
  .option('--profile <type>', 'Sample profile to use (roofing, hvac)', 'roofing')
  .option('--input <json>', 'Custom input JSON file')
  .option('--workspace <path>', 'Workspace directory', './tmp/agent-test')
  .option('--mcp-servers <list>', 'Comma-separated list of MCP servers to enable')
  .option('--verbose', 'Enable verbose logging')
  .action(async (options) => {
    const startTime = Date.now();
    
    // Validate agent exists
    const agentFactory = AGENTS[options.agent];
    if (!agentFactory) {
      console.error(chalk.red(`❌ Unknown agent: ${options.agent}`));
      console.log(chalk.yellow('Available agents:'), Object.keys(AGENTS).join(', '));
      process.exit(1);
    }

    console.log(chalk.cyan(`🚀 Running agent: ${chalk.bold(options.agent)}`));

    // Setup workspace
    const workspace = path.resolve(options.workspace);
    await fs.mkdir(workspace, { recursive: true });
    await fs.mkdir(path.join(workspace, 'specs'), { recursive: true });
    await fs.mkdir(path.join(workspace, 'artifacts'), { recursive: true });
    console.log(chalk.gray(`📁 Workspace: ${workspace}`));

    // Prepare input
    let input: any;
    if (options.input) {
      const inputPath = path.resolve(options.input);
      const inputData = await fs.readFile(inputPath, 'utf-8');
      input = JSON.parse(inputData);
      console.log(chalk.gray(`📄 Input from: ${inputPath}`));
    } else {
      // Use sample profile
      const profile = SAMPLE_PROFILES[options.profile];
      if (!profile) {
        console.error(chalk.red(`❌ Unknown profile: ${options.profile}`));
        process.exit(1);
      }
      
      // Agent-specific input formatting
      if (options.agent === 'planner') {
        input = {
          clientProfile: profile,
          constraints: {
            budget: 10000,
            timeline: "4 weeks",
            mustHaveFeatures: ["online-booking", "customer-portal", "live-chat"],
          },
        };
      } else {
        input = profile;
      }
      
      console.log(chalk.gray(`📋 Using profile: ${options.profile}`));
    }

    // Create context
    const projectId = options.project || `test-${Date.now()}`;
    const runId = `run-${Date.now()}`;
    
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      lazyConnect: true,
    });

    // Try to connect to Redis (optional for local testing)
    let redisConnected = false;
    try {
      await redis.connect();
      redisConnected = true;
      console.log(chalk.green('✓ Redis connected'));
    } catch (error) {
      console.log(chalk.yellow('⚠ Redis not available - running without state persistence'));
    }

    const context = {
      projectId,
      runId,
      phase: 'plan' as const,
      workspace,
      redis: redisConnected ? redis : null,
      logger: options.verbose ? console : null,
    };

    console.log(chalk.gray(`🔖 Project ID: ${projectId}`));
    console.log(chalk.gray(`🔖 Run ID: ${runId}`));

    // Create and run agent
    const agent = agentFactory();
    
    try {
      // Initialize MCP servers if specified
      if (options.mcpServers) {
        const servers = options.mcpServers.split(',');
        console.log(chalk.gray(`🔌 Initializing MCP servers: ${servers.join(', ')}`));
        await agent.initializeMCP(servers);
      }

      console.log(chalk.cyan('\n⚡ Executing agent...\n'));
      
      const result = await agent.execute(input, context);
      
      const duration = Date.now() - startTime;
      
      if (result.success) {
        console.log(chalk.green(`\n✅ Agent completed successfully in ${duration}ms`));
        
        // Save output
        const outputPath = path.join(workspace, 'output.json');
        await fs.writeFile(
          outputPath,
          JSON.stringify(result.data, null, 2)
        );
        console.log(chalk.gray(`📝 Output saved to: ${outputPath}`));
        
        // Display metadata
        console.log(chalk.cyan('\n📊 Execution Metadata:'));
        console.log(chalk.gray(`  • Model: ${result.metadata.modelVersion}`));
        console.log(chalk.gray(`  • Tokens: ${result.metadata.tokenUsage.input} in / ${result.metadata.tokenUsage.output} out`));
        console.log(chalk.gray(`  • Duration: ${result.metadata.duration}ms`));
        
        // Display artifacts
        if (result.artifacts && result.artifacts.length > 0) {
          console.log(chalk.cyan('\n📦 Generated Artifacts:'));
          for (const artifact of result.artifacts) {
            console.log(chalk.gray(`  • ${artifact.type}: ${artifact.path}`));
            
            // Save artifacts
            if (artifact.content) {
              const artifactPath = path.join(workspace, artifact.path);
              await fs.mkdir(path.dirname(artifactPath), { recursive: true });
              await fs.writeFile(artifactPath, artifact.content);
            }
          }
        }
        
        // Display summary for specific agents
        if (options.agent === 'planner' && result.data.routes) {
          console.log(chalk.cyan('\n📍 Generated Routes:'));
          for (const route of result.data.routes.slice(0, 5)) {
            console.log(chalk.gray(`  • ${route.path} - ${route.name}`));
          }
          if (result.data.routes.length > 5) {
            console.log(chalk.gray(`  ... and ${result.data.routes.length - 5} more`));
          }
        }
        
      } else {
        console.log(chalk.red(`\n❌ Agent failed in ${duration}ms`));
        console.log(chalk.red('Error:', result.error?.message));
        
        if (result.error?.details) {
          console.log(chalk.red('Details:'), result.error.details);
        }
        
        if (result.error?.retryable) {
          console.log(chalk.yellow('⚠ This error is retryable'));
        }
        
        process.exit(1);
      }
    } catch (error: any) {
      console.error(chalk.red('\n💥 Unexpected error:'), error.message);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    } finally {
      // Cleanup
      await agent.dispose();
      if (redisConnected) {
        await redis.quit();
      }
    }
    
    console.log(chalk.green('\n✨ Done!'));
  });

// Add list command
program
  .command('list')
  .description('List available agents')
  .action(() => {
    console.log(chalk.cyan('Available agents:\n'));
    
    const agentInfo = {
      // Strategy Tier
      'planner': '📋 Convert client profile to site specification',
      'brand-interpreter': '🎨 Create design system from brand guidelines',
      'ia-architect': '🗺️ Design information architecture',
      'backlog-manager': '📝 Break plan into executable tasks',
      
      // Build Tier  
      'scaffolder': '🏗️ Create Next.js project skeleton',
      'design-system-synthesizer': '🎨 Generate design tokens and components',
      'page-planner': '📄 Plan page layouts and sections',
      'component-worker': '🧩 Build individual components',
      'page-assembler': '📦 Compose components into pages',
      'copywriter': '✍️ Generate SEO-optimized content',
      'media-generator': '🖼️ Create and optimize media assets',
      'integration-fitter': '🔌 Integrate third-party services',
      
      // Quality Tier
      'static-analyzer': '🔍 Type checking and linting',
      'a11y-grader': '♿ Accessibility evaluation',
      'seo-grader': '🔍 SEO optimization checking',
      'perf-grader': '⚡ Performance testing',
      'fixer': '🔧 Apply automated fixes',
      'regenerator': '♻️ Regenerate broken sections',
      'deployer': '🚀 Deploy to hosting platform',
    };
    
    for (const [id, description] of Object.entries(agentInfo)) {
      const implemented = AGENTS[id] ? chalk.green('✓') : chalk.gray('○');
      console.log(`  ${implemented} ${chalk.bold(id.padEnd(25))} ${description}`);
    }
    
    console.log(chalk.gray('\n✓ = implemented, ○ = not yet implemented'));
  });

program.parse();

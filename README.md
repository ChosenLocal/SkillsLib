# Business Automation System

A comprehensive TypeScript monorepo featuring **30+ specialized AI agents** for automated website generation, content creation, data processing, and workflow orchestration, specifically designed for contractor businesses.

## 🌟 Overview

This system uses a multi-layered agent architecture powered by **Claude 4.5 Sonnet** to generate high-quality websites through iterative refinement. Each agent specializes in a specific task (discovery, design, content, code generation, or quality grading), ensuring professional results.

### Key Features

- **30+ Specialized Agents** - Discovery, Design, Content, Code Generation, and Quality Grading layers
- **Iterative Refinement** - Agents grade outputs and re-execute with feedback until excellent
- **Multi-Tenant Architecture** - Handle multiple contractor clients simultaneously with Row-Level Security
- **Industry-Specific** - Pre-configured for roofing, HVAC, solar, restoration, plumbing, electrical, and more
- **Comprehensive Integrations** - 40+ industry-specific APIs (Sunlight Financial, SumoQuote, EagleView, etc.)
- **Web Dashboard** - Real-time monitoring and control via Next.js 16
- **Hybrid Orchestration** - Mastra + XState for agent coordination with event-driven communication
- **Extensive MCP Integration** - Playwright, filesystem, PostgreSQL, scheduling, and custom servers

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│              WEB DASHBOARD (Next.js 16)                 │
│  Real-time monitoring, project management, control      │
└────────────────────────┬────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────┐
│          ORCHESTRATION LAYER (Mastra + XState)          │
│  30+ Agent Website Builder | Content | Workflows        │
└────────────────────────┬────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ↓               ↓               ↓
    Discovery        Design &         Content
    Agents (8)     Branding (10)    Agents (10)
         │               │               │
         └───────────────┴───────────────┘
                         ↓
                  Code Generation (5)
                         ↓
                Quality Grading (5)
                         ↓
              Iterative Refinement Loop
```

### Agent Layers

#### 1. Discovery Layer (8 Agents)
- **Business Requirements** - Core business information
- **Service Definition** - Services and offerings
- **Brand Identity** - Voice, colors, messaging
- **SEO Strategy** - Keywords, competitors, targeting
- **Content Asset** - Photos, testimonials, projects
- **Legal/Compliance** - Certifications, licenses, insurance
- **Technical Requirements** - Integrations, features
- **Discovery Validator** - Data completeness check

#### 2. Design & Branding Layer (10 Agents)
- **Color Palette** - Brand colors, accessibility
- **Typography** - Font selection, hierarchy
- **Layout Architecture** - Page structure, sections
- **Component Design** - UI components, patterns
- **Responsive Design** - Mobile/tablet/desktop
- **Animation** - Micro-interactions, transitions
- **Image Selection** - Stock photos, imagery
- **Icon Design** - Icon systems, visual elements
- **Brand Consistency** - Style guide enforcement
- **Accessibility** - WCAG compliance, alt text

#### 3. Content Generation Layer (10 Agents)
- **Hero Copy** - Compelling headlines, CTAs
- **Service Description** - Detailed service content
- **About Page** - Company story, mission
- **Blog Content** - SEO-optimized articles
- **FAQ** - Common questions, voice search
- **Testimonial** - Review formatting, social proof
- **Meta Description** - SEO meta tags
- **Schema Markup** - Structured data generation
- **Local SEO** - NAP consistency, location pages
- **Call-to-Action** - Conversion optimization

#### 4. Code Generation Layer (5 Agents)
- **Next.js Scaffold** - Project structure, configuration
- **Component Code** - React component generation
- **API Route** - Backend endpoints, server actions
- **Styling** - Tailwind CSS implementation
- **Integration** - Third-party API connections

#### 5. Quality Grading Layer (5 Agents)
- **Performance Evaluator** - Lighthouse scores, Core Web Vitals
- **SEO Evaluator** - Technical SEO, on-page optimization
- **Accessibility Evaluator** - WCAG compliance, screen readers
- **Code Quality Evaluator** - TypeScript errors, best practices
- **Content Quality Evaluator** - Readability, grammar, brand voice

### Iterative Refinement Process

1. Agents execute their tasks in parallel within each layer
2. Quality grading agents evaluate all outputs across multiple dimensions
3. If any dimension fails (< 70% score), refinement is triggered
4. Failed agents re-execute with specific feedback from evaluators
5. Process repeats until all dimensions pass or max iterations reached (default: 3)

## 📦 Project Structure

```
business-automation-system/
├── apps/
│   ├── web/                      # Next.js 16 web dashboard
│   ├── api/                      # Backend API service (tRPC)
│   └── workers/                  # Background job workers (BullMQ)
│
├── packages/
│   ├── agents/                   # Agent implementations
│   │   ├── orchestrator/        # Main orchestration logic
│   │   ├── discovery/           # Discovery layer agents (8)
│   │   ├── design/              # Design & branding agents (10)
│   │   ├── content/             # Content generation agents (10)
│   │   ├── code-generation/     # Code generation agents (5)
│   │   ├── quality-grading/     # Evaluation agents (5)
│   │   └── shared/              # Shared agent utilities
│   │
│   ├── workflows/                # Workflow definitions
│   │   ├── website-generation/  # 30+ agent website workflow
│   │   ├── content-creation/    # Content generation workflows
│   │   ├── seo-audit/           # SEO analysis workflows
│   │   └── customer-service/    # Support workflows
│   │
│   ├── database/                 # Database layer (Prisma + PostgreSQL)
│   │   ├── prisma/
│   │   │   ├── schema.prisma    # Database schema
│   │   │   ├── migrations/      # Database migrations
│   │   │   └── seed.ts          # Seed data
│   │   └── src/
│   │       ├── client.ts        # Prisma client singleton
│   │       └── index.ts         # Exports
│   │
│   ├── mcp-servers/              # Custom MCP server implementations
│   │   ├── sendgrid/            # Email MCP server
│   │   ├── twilio/              # SMS MCP server
│   │   ├── image-optimizer/     # Image processing MCP
│   │   └── content-generator/   # AI content MCP
│   │
│   ├── schema/                   # Shared TypeScript types & schemas
│   │   ├── client-profile.ts    # Comprehensive client profile
│   │   ├── project.ts           # Project and evaluation types
│   │   ├── agent.ts             # Agent execution types
│   │   ├── workflow.ts          # Workflow orchestration types
│   │   ├── tenant.ts            # Multi-tenant types
│   │   └── index.ts             # Barrel export
│   │
│   ├── config/                   # Shared configuration
│   │   ├── env.ts               # Environment variable validation
│   │   ├── constants.ts         # Application constants
│   │   ├── logger.ts            # Pino structured logging
│   │   └── index.ts             # Barrel export
│   │
│   └── ui/                       # Shared UI components (shadcn/ui)
│       ├── components/          # React components
│       └── lib/                 # UI utilities
│
├── docs/                         # Documentation
├── .env.example                  # Environment variables template
├── package.json                  # Root package.json
├── pnpm-workspace.yaml           # pnpm workspace config
├── turbo.json                    # Turborepo configuration
└── tsconfig.json                 # TypeScript configuration
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** 20+ LTS
- **pnpm** 9.0+
- **PostgreSQL** 16+
- **Redis** 7+ (or Upstash account)
- **Claude API Key** (from Anthropic)

### Installation

1. **Clone the repository**
   ```bash
   cd /home/jack-leszczynski/Desktop/ChosenLocal/SkillsLib
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   pnpm db:generate

   # Run migrations
   pnpm db:migrate

   # Seed the database
   pnpm db:seed
   ```

5. **Start development servers**
   ```bash
   # Start all apps in development mode
   pnpm dev
   ```

### Environment Variables

See `.env.example` for the complete list. Key variables:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/business_automation"

# Redis
REDIS_URL="redis://localhost:6379"

# AI Services
CLAUDE_API_KEY="your-claude-api-key"
ANTHROPIC_API_KEY="your-anthropic-api-key"

# Core 6 APIs (from stack-docs.md)
SUNLIGHT_API_KEY="your-sunlight-api-key"
SUMOQUOTE_API_KEY="your-sumoquote-api-key"
EAGLEVIEW_API_KEY="your-eagleview-api-key"
COMPANYCAM_API_KEY="your-companycam-api-key"
BEACON_API_KEY="your-beacon-api-key"
QUICKBOOKS_CLIENT_ID="your-quickbooks-client-id"
```

## 🛠️ Technology Stack

### Core Framework
- **Next.js 16** - React framework with App Router
- **React 19** - UI library
- **TypeScript 5.7+** - Type-safe development
- **Tailwind CSS 4** - Utility-first CSS
- **Framer Motion** - Animation library

### Agent Orchestration
- **Mastra** - Multi-agent orchestration framework
- **XState 5** - State machine library
- **Claude Agent SDK** - Official Anthropic SDK
- **Inngest** - Durable workflow engine

### Backend & API
- **tRPC** - Type-safe API layer
- **Prisma ORM** - Database toolkit
- **PostgreSQL 16** - Relational database
- **Redis/Upstash** - Caching and job queues
- **BullMQ** - Background job processing

### State Management & Data Fetching
- **TanStack Query** - Server state management
- **Zustand** - Client state management

### Build & Development Tools
- **Turborepo** - Monorepo build system
- **pnpm** - Fast package manager
- **Vitest** - Unit testing
- **Playwright** - E2E testing

### Observability
- **Langfuse** - LLM tracing and observability
- **Sentry** - Error tracking
- **PostHog** - Product analytics
- **Pino** - Structured logging

## 📊 Database Schema

The system uses a **multi-tenant architecture** with PostgreSQL and Prisma ORM:

- **Tenants** - Organizations using the system
- **Users** - Users within tenants (RBAC)
- **Company Profiles** - Comprehensive client data
- **Projects** - Website generation and automation projects
- **Workflow Executions** - Orchestrated workflow runs
- **Agent Executions** - Individual agent task executions
- **Generated Assets** - Website pages, components, content
- **Website Evaluations** - Quality grading results

**Row-Level Security** ensures tenant data isolation at the database level.

## 🎯 Usage Examples

### Generate a Website for a Contractor

```typescript
import { createProject } from '@business-automation/api';

// Create a new website generation project
const project = await createProject({
  name: 'ABC Roofing Website',
  type: 'WEBSITE',
  discoveryData: {
    businessInfo: {
      name: 'ABC Roofing & Restoration',
      industry: 'roofing',
      location: 'Denver, CO',
    },
    services: ['roof-repair', 'roof-replacement', 'emergency-service'],
    // ... more discovery data
  },
});

// The orchestrator will automatically:
// 1. Run discovery agents to gather requirements
// 2. Execute design agents to create visual identity
// 3. Generate content with content agents
// 4. Build the Next.js code with code generation agents
// 5. Grade quality with evaluation agents
// 6. Refine iteratively until all dimensions pass
```

### Monitor Agent Execution

```typescript
import { getProjectStatus } from '@business-automation/api';

const status = await getProjectStatus(projectId);

console.log(`Progress: ${status.progressPercentage}%`);
console.log(`Current Step: ${status.currentStepName}`);
console.log(`Completed Agents: ${status.completedSteps}/${status.totalSteps}`);
```

### View Quality Grades

```typescript
import { getLatestEvaluation } from '@business-automation/api';

const evaluation = await getLatestEvaluation(projectId);

evaluation.grades.forEach((grade) => {
  console.log(`${grade.dimension}: ${grade.grade} (${grade.score * 100}%)`);
  if (grade.passFailGrade === 'fail') {
    console.log('Issues:', grade.issues);
    console.log('Suggestions:', grade.suggestions);
  }
});
```

## 🔧 Adding New Agents

To add a new agent to the system:

1. **Create agent definition** in `packages/agents/[layer]/[agent-name].ts`
2. **Define agent role** in `packages/schema/src/agent.ts`
3. **Configure system prompt** and tools
4. **Add to workflow** in `packages/workflows/[workflow-name].ts`
5. **Update orchestrator** to coordinate the new agent

Example agent structure:

```typescript
import { createAgent } from '@business-automation/agents/shared';
import { AgentRole } from '@business-automation/schema';

export const myNewAgent = createAgent({
  role: 'MY_NEW_AGENT' as AgentRole,
  layer: 'design',
  name: 'My New Agent',
  description: 'Specialized task description',
  systemPrompt: `You are a specialized agent that...`,
  tools: ['web_search', 'code_execution'],
  mcpServers: ['playwright', 'filesystem'],
});
```

## 📈 Monitoring & Observability

### Langfuse Integration

Track all LLM calls, costs, and performance:

```typescript
import { initLangfuse } from '@business-automation/config';

const langfuse = initLangfuse();
langfuse.trace({
  name: 'website-generation',
  userId: tenantId,
  metadata: { projectId },
});
```

### Sentry Error Tracking

All errors are automatically tracked:

```typescript
import { logError } from '@business-automation/config';

try {
  // Agent execution
} catch (error) {
  logError(error, { agentRole, projectId, tenantId });
}
```

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run E2E tests
pnpm test:e2e

# Run type checking
pnpm type-check

# Run linting
pnpm lint
```

## 📚 Documentation

- **Architecture** - See [docs/architecture/README.md](docs/architecture/README.md)
- **Agent Guides** - See [docs/agent-guides/README.md](docs/agent-guides/README.md)
- **API Reference** - See [docs/api-reference/README.md](docs/api-reference/README.md)
- **Stack Docs** - See [stack-docs.md](stack-docs.md) for industry-specific APIs

## 🤝 Contributing

This is a private project. For questions or issues:

1. Check existing documentation
2. Review the architecture diagrams
3. Consult the agent guides
4. Reach out to the development team

## 📄 License

MIT License - See LICENSE file for details

---

## 🎉 What's Next?

The foundational structure is complete! Next steps:

1. ✅ Monorepo structure with Turborepo + pnpm
2. ✅ Root configuration files
3. ✅ Package directories
4. ✅ PostgreSQL schema with Prisma
5. ✅ Comprehensive TypeScript schemas
6. ⏳ Initialize Next.js 16 web dashboard
7. ⏳ Set up tRPC API layer
8. ⏳ Create Mastra orchestration foundation
9. ⏳ Implement first 3 proof-of-concept agents
10. ⏳ Build basic dashboard UI

**Ready to build the most sophisticated contractor website automation system! 🚀**

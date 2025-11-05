- go to @stack-docs.md for reference documentaation
i want to use nextjs16 for this project
# Business Automation System - Claude Project Guide

## 🎯 Project Overview
**Mission**: A modular TypeScript/Next.js 16 automation platform that orchestrates specialized Claude agents to build, grade, and iterate client websites and business automations.

**Core Stack**:
- Next.js 16 (App Router)
- TypeScript 5.x (strict mode)
- tRPC for type-safe APIs
- Prisma ORM + PostgreSQL
- Redis for ephemeral state
- BullMQ/Inngest for job orchestration
- MCP (Model Context Protocol) for agent tools
- Turborepo + pnpm monorepo

## 📁 Repository Structure
business-automation-system/
├── apps/
│   ├── web/                 # Next.js 16 main app
│   ├── orchestrator/        # Agent orchestration service
│   └── mcp-gateway/         # MCP server adapter
├── packages/
│   ├── schema/             # Shared TypeScript types & Zod schemas
│   ├── database/           # Prisma schema & migrations
│   ├── agents/             # Agent implementations
│   │   ├── builder/        # Website builder agent
│   │   ├── grader/         # Quality assessment agent
│   │   ├── optimizer/      # Performance optimization agent
│   │   └── _template/      # Agent template
│   ├── ui/                 # Shared React components
│   └── utils/              # Common utilities
├── services/
│   ├── queue/              # BullMQ/Inngest setup
│   └── storage/            # S3/GCS abstraction
└── scripts/
    └── dev-run-agent       # Local agent testing

## 🤖 When Asked to Create/Modify Code

### Agent Template
Always use this structure for new agents:

// packages/agents/[agent-name]/index.ts
import { z } from 'zod';
import { AgentBase, AgentManifest } from '@business-automation/schema';

const InputSchema = z.object({
  projectId: z.string(),
  runId: z.string(),
  // agent-specific fields
});

const OutputSchema = z.object({
  success: z.boolean(),
  artifacts: z.array(z.object({
    type: z.string(),
    url: z.string(),
    metadata: z.record(z.any())
  })),
  grade: z.object({
    score: z.number().min(0).max(100),
    issues: z.array(z.object({
      severity: z.enum(['critical', 'warning', 'info']),
      message: z.string(),
      remediation: z.string().optional()
    }))
  }).optional()
});

export class [AgentName]Agent extends AgentBase {
  static manifest: AgentManifest = {
    id: '[agent-name]',
    name: '[Agent Display Name]',
    version: '1.0.0',
    capabilities: [],
    requiredEnvVars: [],
    mcpServers: [],
    inputSchema: InputSchema,
    outputSchema: OutputSchema,
    sideEffects: ['writes-to-s3'],
    retryable: true,
    maxRetries: 3
  };

  async execute(input: z.infer<typeof InputSchema>) {
    // Implementation
  }
}

### Message Format for Agent Communication

// Standard event shape for BullMQ/Inngest
interface AgentEvent {
  eventType: 'agent.start' | 'agent.complete' | 'agent.failed' | 'agent.retry';
  projectId: string;
  runId: string;
  agentId: string;
  payload: unknown; // Validated against agent schema
  schemaVersion: '1.0.0';
  metadata: {
    timestamp: string;
    modelVersion: string;
    promptHash: string;
    parentRunId?: string;
  };
}

### API Endpoint Pattern (tRPC)

// apps/web/server/routers/agents.ts
import { z } from 'zod';
import { protectedProcedure } from '../trpc';

export const agentsRouter = {
  execute: protectedProcedure
    .input(z.object({
      agentId: z.string(),
      projectId: z.string(),
      input: z.record(z.any())
    }))
    .mutation(async ({ ctx, input }) => {
      const runId = generateRunId();
      
      await ctx.queue.add('agent.execute', {
        eventType: 'agent.start',
        projectId: input.projectId,
        runId,
        agentId: input.agentId,
        payload: input.input,
        schemaVersion: '1.0.0'
      });

      return { runId, status: 'queued' };
    })
};

## 🔒 Security & Operations

### Environment Variables Pattern

// Never hardcode secrets. Always use:
const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
    orgId: process.env.OPENAI_ORG_ID
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY!
  },
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    s3Bucket: process.env.S3_BUCKET!
  }
};

// Validate at startup
if (!config.openai.apiKey) {
  throw new Error('OPENAI_API_KEY is required');
}

### Audit Logging

// Always log sensitive operations
await auditLog.record({
  action: 'production.deploy',
  userId: ctx.user.id,
  projectId: input.projectId,
  metadata: { 
    environment: 'production',
    changes: diffSummary 
  },
  requiresApproval: true
});

### Human Review Gates

// For destructive operations
if (operation.requiresApproval && !operation.approved) {
  await notificationService.send({
    type: 'approval_required',
    title: 'Production deployment requires approval',
    projectId,
    actions: [
      { label: 'Approve', action: 'approve_deployment' },
      { label: 'Reject', action: 'reject_deployment' }
    ]
  });
  return { status: 'pending_approval' };
}

## 📊 Database Patterns

### Prisma Schema Snippet

// packages/database/schema.prisma
model Project {
  id          String   @id @default(cuid())
  name        String
  clientId    String
  status      ProjectStatus
  
  runs        Run[]
  artifacts   Artifact[]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([clientId])
}

model Run {
  id          String   @id @default(cuid())
  projectId   String
  agentId     String
  status      RunStatus
  input       Json
  output      Json?
  error       Json?
  
  project     Project  @relation(fields: [projectId], references: [id])
  
  startedAt   DateTime @default(now())
  completedAt DateTime?
  
  @@index([projectId, status])
}

enum ProjectStatus {
  DRAFT
  BUILDING
  GRADING
  OPTIMIZING
  COMPLETE
  FAILED
}

enum RunStatus {
  QUEUED
  RUNNING
  COMPLETE
  FAILED
  RETRYING
}

## 🧪 Testing Patterns

### Agent Test Template

// packages/agents/[agent-name]/__tests__/index.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { [AgentName]Agent } from '../index';

describe('[AgentName]Agent', () => {
  let agent: [AgentName]Agent;
  
  beforeEach(() => {
    agent = new [AgentName]Agent({
      redis: mockRedis,
      storage: mockStorage,
      prisma: mockPrisma
    });
  });

  it('should validate input schema', async () => {
    const invalidInput = { projectId: 123 }; // wrong type
    await expect(agent.execute(invalidInput)).rejects.toThrow();
  });

  it('should produce valid output', async () => {
    const input = {
      projectId: 'test-project',
      runId: 'test-run'
    };
    
    const result = await agent.execute(input);
    expect(result.success).toBe(true);
    expect(result.artifacts).toBeDefined();
  });
});

## 🚀 Local Development

### Running an Agent Locally

# Start dependencies
pnpm docker:up  # PostgreSQL, Redis

# Run migrations
pnpm db:migrate

# Test specific agent
pnpm dev:agent --agent=builder --project=test-123

# Watch mode for development
pnpm dev --filter=@business-automation/agents-builder

### Adding a New Agent Checklist
1. Copy packages/agents/_template to packages/agents/[new-agent]
2. Update manifest.json with capabilities and dependencies
3. Implement execute() method with proper error handling
4. Add input/output schema validation
5. Write tests covering happy path and error cases
6. Update orchestrator to include new agent in workflow
7. Document MCP server requirements if any
8. Add to CI/CD pipeline

## 📝 Common Patterns & Best Practices

### Error Handling

// Always return structured errors
class AgentError extends Error {
  constructor(
    public code: string,
    message: string,
    public retryable: boolean = false,
    public details?: any
  ) {
    super(message);
  }
}

// Usage
throw new AgentError(
  'RATE_LIMIT_EXCEEDED',
  'OpenAI rate limit hit',
  true, // retryable
  { retryAfter: 60 }
);

### Idempotency

// Use runId for idempotent operations
const cacheKey = `agent:${agentId}:run:${runId}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

const result = await performWork();
await redis.set(cacheKey, JSON.stringify(result), 'EX', 3600);
return result;

### State Management

// Ephemeral state in Redis
await redis.hset(`project:${projectId}:state`, {
  currentAgent: agentId,
  progress: 0.5,
  lastUpdate: new Date().toISOString()
});

// Persistent state in PostgreSQL
await prisma.projectState.upsert({
  where: { projectId },
  create: { projectId, state: finalState },
  update: { state: finalState }
});

## 🎯 Priority Guidelines

When working on this codebase:
1. **Safety First**: Never auto-deploy to production without human approval
2. **Type Safety**: Use TypeScript strictly, validate all inputs with Zod
3. **Observability**: Log all agent operations, include trace IDs
4. **Testability**: Every agent must have tests, aim for >80% coverage
5. **Documentation**: Update this file when adding major features

## 🔄 Workflow Example

graph LR
    A[Client Request] --> B[Orchestrator]
    B --> C[Builder Agent]
    C --> D[Grader Agent]
    D --> E{Grade Pass?}
    E -->|No| F[Optimizer Agent]
    F --> D
    E -->|Yes| G[Deploy Preview]
    G --> H[Human Review]
    H -->|Approved| I[Production Deploy]

## 💡 Quick Commands

# Development
pnpm dev           # Start all services in dev mode
pnpm test          # Run all tests
pnpm lint          # Lint codebase
pnpm typecheck     # Type checking

# Database
pnpm db:migrate    # Run migrations
pnpm db:studio     # Open Prisma Studio
pnpm db:seed       # Seed test data

# Agents
pnpm agent:new     # Scaffold new agent
pnpm agent:test    # Test specific agent
pnpm agent:deploy  # Deploy agent updates

# Production
pnpm build         # Build all packages
pnpm start         # Start production servers

## 🚨 Important Notes

1. **MCP Integration**: Agents requiring external tools must declare MCP servers in manifest.json
2. **Rate Limiting**: Implement exponential backoff for all external API calls
3. **Cost Control**: Track token usage per project, implement spending limits
4. **Versioning**: Use semantic versioning for agents, maintain backward compatibility
5. **Monitoring**: Integrate with Langfuse for LLM observability

---

**Remember**: When in doubt, prioritize correctness and maintainability over speed. This system handles client production websites - reliability is paramount.
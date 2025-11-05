# Phase 3 Implementation - Agent Framework

## ✅ What We've Built

### 1. **Base Agent Framework** (`base-agent.ts`)
- Abstract `BaseAgent` class with Claude SDK integration
- MCP server connection management
- Automatic retry logic and error handling
- Token usage tracking and observability
- Artifact storage system

### 2. **Master Orchestrator** (`master-orchestrator.ts`)
- Inngest-based state machine for phase transitions
- Handles: Planning → Synthesis → Validation → Deployment
- Automatic fix cycles with iteration limits
- Event-driven architecture (no polling)

### 3. **Planner Agent** (`planner-agent.ts`)
- Complete implementation as proof-of-concept
- Converts ClientProfile → SiteSpec
- Industry-specific guidance
- Structured output validation

### 4. **Worker Infrastructure** (`agent-worker.ts`)
- BullMQ workers for 3 tiers (Strategy, Build, Quality)
- Concurrency management per tier
- Rate limiting and backoff
- Health monitoring

### 5. **Message Contracts** (`contracts.ts`)
- Complete schemas for all agent communication
- Type-safe contracts between tiers
- Version-controlled message formats

### 6. **tRPC API** (`agents-router.ts`)
- Control plane for web dashboard
- Real-time progress subscriptions
- Project management endpoints

### 7. **Dev Tools** (`dev-run-agent.ts`)
- Local testing script for agents
- Sample profiles (roofing, HVAC)
- Verbose debugging mode

## 📦 Installation

```bash
# Install core dependencies
pnpm add @anthropic-ai/sdk inngest bullmq ioredis @modelcontextprotocol/sdk zod

# Install MCP servers
pnpm add -D @modelcontextprotocol/server-filesystem \
           @modelcontextprotocol/server-memory \
           @modelcontextprotocol/server-playwright

# Dev dependencies
pnpm add -D commander chalk pino pino-pretty
```

## 🏗️ Project Structure

```
packages/
├── agents/
│   ├── shared/
│   │   └── base-agent.ts        # Base class for all agents
│   ├── strategy/
│   │   ├── planner-agent.ts     # ✅ Implemented
│   │   ├── brand-interpreter.ts # TODO
│   │   ├── ia-architect.ts      # TODO
│   │   └── backlog-manager.ts   # TODO
│   ├── build/
│   │   ├── scaffolder.ts        # TODO
│   │   ├── design-system.ts     # TODO
│   │   ├── component-worker.ts  # TODO
│   │   └── ...
│   └── quality/
│       ├── graders/              # TODO
│       ├── fixer.ts              # TODO
│       └── deployer.ts           # TODO
│
├── workflows/
│   └── orchestrator/
│       ├── master-orchestrator.ts
│       ├── planning-phase.ts     # TODO
│       ├── synthesis-phase.ts    # TODO
│       └── validation-phase.ts   # TODO
│
└── schema/
    └── src/
        ├── contracts.ts          # Inter-agent messages
        └── client-profile.ts     # Existing
```

## 🚀 Running Locally

### 1. Start Infrastructure
```bash
# Terminal 1: Redis
docker run -p 6379:6379 redis:alpine

# Terminal 2: Inngest Dev Server
npx inngest-cli@latest dev

# Terminal 3: Workers
pnpm tsx apps/workers/agent-worker.ts
```

### 2. Test an Agent
```bash
# Run planner agent with sample profile
pnpm tsx scripts/dev-run-agent.ts --agent planner --profile roofing

# With custom input
pnpm tsx scripts/dev-run-agent.ts --agent planner --input ./my-client.json

# With MCP servers
pnpm tsx scripts/dev-run-agent.ts --agent planner --mcp-servers filesystem,memory
```

### 3. Start Full Build
```bash
# Via API
curl -X POST http://localhost:3000/trpc/agents.startBuild \
  -H "Content-Type: application/json" \
  -d '{"clientProfile": {...}}'
```

## 🎯 Next Steps (Priority Order)

### Immediate (Day 1-2)
1. **Set up environment**:
   ```bash
   cp .env.example .env
   # Add your ANTHROPIC_API_KEY
   ```

2. **Implement Brand Interpreter agent**:
   - Copy `planner-agent.ts` as template
   - Input: ClientProfile.brandGuidelines
   - Output: DesignSpec with tokens

3. **Create Planning Phase workflow**:
   - Wire up all 4 strategy agents
   - Coordinate in Inngest

### Short-term (Day 3-5)
4. **Implement Scaffolder agent**:
   - Creates Next.js 16 project structure
   - Uses MCP filesystem server

5. **Build Component Worker**:
   - Template for ephemeral workers
   - Generates single components

6. **Add progress tracking**:
   - Redis pub/sub for real-time updates
   - WebSocket subscriptions

### Medium-term (Day 6-10)
7. **Complete Build tier agents**
8. **Implement Grader agents**
9. **Create Fixer with auto-merge logic**
10. **Add deployment with Vercel/Netlify**

## 🔧 Key Implementation Patterns

### Creating a New Agent

1. **Define schemas**:
```typescript
const MyAgentInputSchema = z.object({...});
const MyAgentOutputSchema = z.object({...});
```

2. **Extend BaseAgent**:
```typescript
export class MyAgent extends BaseAgent<Input, Output> {
  constructor() {
    super({
      id: 'my-agent',
      tier: 'build',
      type: 'core',
      // ...
    });
  }
  
  protected buildSystemPrompt() {...}
  protected buildUserPrompt() {...}
  protected validateInput() {...}
  protected parseOutput() {...}
  protected validateOutput() {...}
  protected storeArtifacts() {...}
}
```

3. **Register in worker**:
```typescript
const AGENT_REGISTRY = {
  'my-agent': () => new MyAgent(),
  // ...
};
```

### Using MCP Tools

```typescript
// In your agent
this.manifest.mcpServers = ['filesystem', 'browser'];

// Tools become available to Claude automatically
const tools = await this.getMCPTools();
// Returns: filesystem_read, filesystem_write, browser_navigate, etc.
```

### Handling Ephemeral Workers

```typescript
// For Component Workers - spawn multiple
if (agentId === 'component-worker') {
  const componentJobs = components.map(comp => ({
    agentId: 'component-worker',
    input: comp,
    // Each gets unique job ID
  }));
  
  await Promise.all(
    componentJobs.map(job => enqueueAgent(job.agentId, job))
  );
}
```

## 📊 Monitoring

### Worker Health Check
```typescript
GET /api/agents/health

{
  "redis": true,
  "queues": {
    "strategy": { "waiting": 0, "active": 2, "completed": 45 },
    "build": { "waiting": 5, "active": 8, "completed": 123 },
    "quality": { "waiting": 1, "active": 3, "completed": 67 }
  },
  "workers": {
    "strategy": { "running": true, "concurrency": 4 },
    "build": { "running": true, "concurrency": 10 },
    "quality": { "running": true, "concurrency": 5 }
  }
}
```

## 🐛 Troubleshooting

### Agent Timeout
- Increase `maxTokens` in manifest
- Check MCP server connections
- Verify Redis connectivity

### Memory Issues
- Ephemeral workers auto-cleanup
- Workspace files expire after 24h
- Redis keys have TTL

### Debugging
```bash
# Verbose mode
DEBUG=* pnpm tsx scripts/dev-run-agent.ts --agent planner --verbose

# Check Redis
redis-cli
> KEYS project:*
> GET project:test-123
```

## 📚 Resources

- [Claude Agent SDK Docs](https://docs.claude.com/en/api/agent-sdk)
- [MCP Protocol Spec](https://modelcontextprotocol.org)
- [Inngest Workflows](https://www.inngest.com/docs/guides/multi-step-workflows)
- [BullMQ Patterns](https://docs.bullmq.io/patterns)

---

**Ready to implement remaining agents?** Start with Brand Interpreter using Planner as template!

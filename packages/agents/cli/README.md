# Agent CLI - Local Testing Tool

A command-line interface for testing agents locally without deploying to production.

## Installation

```bash
# Install dependencies
pnpm install

# The CLI is available via the `agent` command
pnpm agent --help
```

## Usage

### List All Agents

```bash
pnpm agent list
```

**Output:**
```
📋 Registered Agents

Total: 12 agents

STRATEGY Tier:
  • planner - Planner (core)
    Generates comprehensive website specifications from company profiles
  • ia-architect - IA Architect (core)
    Designs information architecture and navigation structure
  • brand-interpreter - Brand Interpreter (core)
    Translates brand identity into design tokens
  • backlog-manager - Backlog Manager (core)
    Creates prioritized work queue for build agents

BUILD Tier:
  • scaffolder - Scaffolder (core)
    Generates Next.js 16 project structure
  • component-worker - Component Worker (ephemeral)
    Generates individual React components
  • page-assembler - Page Assembler (core)
    Assembles complete Next.js pages

QUALITY Tier:
  • static-analyzer - Static Analyzer (core)
    Validates TypeScript, ESLint, build, and Lighthouse
  • fixer - Fixer (core)
    Applies automated fixes within budget constraints
```

### View Agent Information

```bash
pnpm agent info planner
```

**Output:**
```
🤖 Planner

ID: planner
Version: 1.0.0
Category: planner
Tier: strategy
Type: core

Description: Generates comprehensive website specifications from company profiles

Capabilities:
  • Analyze company profile
  • Determine optimal page structure
  • Create route definitions with metadata
  • Design layout hierarchy
  • Plan component library
  • Estimate build complexity

Dependencies:
  (none)

Required Environment Variables:
  ✓ ANTHROPIC_API_KEY
  ✓ DATABASE_URL

Retryable: Yes
Max Retries: 3

Model Settings:
  Temperature: 0.5
  Max Tokens: 20000
```

### Test a Single Agent

```bash
# Interactive mode (prompts for all inputs)
pnpm agent test planner

# With project ID
pnpm agent test planner --project-id=550e8400-e29b-41d4-a716-446655440000

# With all options
pnpm agent test planner \
  --project-id=550e8400-e29b-41d4-a716-446655440000 \
  --tenant-id=7c9e6679-7425-40de-944b-e07fc1f90ae7 \
  --user-id=c56a4180-65aa-42ec-a945-5fd21dec0538
```

**Example Session:**
```
✔ Loaded Planner
ℹ Agent requires input parameters. Starting interactive prompt...

? Company Profile ID: 8f8b5e12-d4e6-4c8a-9f7e-3b2c1a5d6e7f
✔ Running Planner... (12.5s)

📊 Results:

Tokens Used: 15234
Cost: $0.1829

Artifacts:
  • site-spec: 550e8400-e29b-41d4-a716-446655440000/specs/site-spec.json

📝 Output:

{
  "version": "1.0",
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "routes": [
    {
      "path": "/",
      "name": "Home",
      "title": "Professional Roofing Services | Denver, CO",
      ...
    }
  ],
  ...
}
```

### Test Complete Website Generation Workflow

```bash
# Interactive mode
pnpm agent test-workflow website-generator

# With options
pnpm agent test-workflow website-generator \
  --project-id=550e8400-e29b-41d4-a716-446655440000 \
  --profile-id=8f8b5e12-d4e6-4c8a-9f7e-3b2c1a5d6e7f \
  --max-pages=10 \
  --max-cost=50
```

**Example Output:**
```
✔ Loaded project: ABC Roofing

🏗️  Website Generation Workflow

Project: ABC Roofing
Type: ROOFING_WEBSITE
Max Pages: 10
Budget: $50.00

━━━ STRATEGY TIER ━━━

✔ Planner Agent complete (15234 tokens, $0.1829)
✔ Strategy agents complete (8912 tokens, $0.1069)
✔ Backlog Manager complete (4567 tokens, $0.0548)

Strategy Tier Summary: 28713 tokens, $0.3446

━━━ BUILD TIER ━━━

✔ Scaffolder complete (6789 tokens, $0.0815)

Build Tier Summary: 6789 tokens, $0.0815

━━━ QUALITY TIER ━━━

✔ Static Analyzer complete

Findings:
  Critical: 0
  High: 2
  Medium: 5
  Low: 8
  Auto-fixable: 10

━━━ WORKFLOW SUMMARY ━━━

Total Tokens: 35502
Total Cost: $0.4261

Artifacts stored in: /tmp/550e8400-e29b-41d4-a716-446655440000/
```

## Supported Agents

### Strategy Tier

- **planner** - Generates comprehensive website specifications
- **ia-architect** - Designs information architecture
- **brand-interpreter** - Translates brand to design tokens
- **backlog-manager** - Creates prioritized work queue

### Build Tier

- **scaffolder** - Generates Next.js 16 project structure
- **component-worker** - Generates individual React components (ephemeral)
- **page-assembler** - Assembles complete pages

### Quality Tier

- **static-analyzer** - Validates TypeScript, ESLint, build, Lighthouse
- **fixer** - Applies automated fixes

## Environment Variables

The CLI requires the following environment variables:

```bash
# Required
DATABASE_URL=postgresql://...
ANTHROPIC_API_KEY=sk-ant-...

# Optional (for specific agents)
REDIS_URL=redis://localhost:6379
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
LANGFUSE_PUBLIC_KEY=...
LANGFUSE_SECRET_KEY=...
```

## Output Locations

All agent outputs are stored in `/tmp/<project-id>/`:

```
/tmp/<project-id>/
├── specs/
│   ├── site-spec.json
│   ├── design-spec.json
│   ├── ia-plan.json
│   └── work-queue.json
├── build/
│   ├── package.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── ...
│   └── components/
│       └── ...
└── quality/
    ├── findings.json
    └── patches.json
```

## Tips

### Testing Individual Agents

When testing individual agents, you often need outputs from previous agents. Use the interactive workflow first to generate all artifacts, then test specific agents:

```bash
# 1. Run full workflow to generate all artifacts
pnpm agent test-workflow website-generator \
  --project-id=<uuid> \
  --profile-id=<uuid>

# 2. Test specific agent with existing artifacts
pnpm agent test fixer --project-id=<uuid>
```

### Mocking Data

To test without a real database, use the `--mock` flag:

```bash
pnpm agent test planner --project-id=<uuid> --mock
```

### Viewing Costs

The CLI shows token usage and costs for all operations. Track your spending:

```bash
# Test with strict budget
pnpm agent test-workflow website-generator \
  --max-cost=10 \
  --max-pages=5
```

## Troubleshooting

### "Agent not found" Error

Make sure the agent is registered in `packages/agents/index.ts`:

```typescript
registerAllAgents();
```

### Database Connection Failed

Verify your `DATABASE_URL` environment variable:

```bash
echo $DATABASE_URL
```

### Missing Environment Variables

Check required variables for the agent:

```bash
pnpm agent info <agent-id>
```

Look for the "Required Environment Variables" section and ensure all are set with ✓.

## Development

### Adding Support for New Agents

1. Register the agent in `packages/agents/index.ts`
2. Add agent-specific input prompts in `getAgentInput()` function in `cli/index.ts`
3. Test the agent:

```bash
pnpm agent test <new-agent-id>
```

### Debugging

Enable debug logging:

```bash
DEBUG=* pnpm agent test planner
```

## See Also

- [Agent Architecture](../README.md)
- [Testing Guide](../docs/testing.md)
- [Production Deployment](../docs/deployment.md)

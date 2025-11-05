# 📚 Stack Documentation

**Last Updated**: 2025-01-04
**Platform Version**: 2.1
**Environment**: Production & Development

---

## 📖 Quick Navigation

- [Core Integration Partners](#-core-integration-partners)
- [Industry-Specific Platforms](#-industry-specific-platforms)
- [Technology Stack](#-technology-stack)
- [Development Setup](#-development-setup)

---

## 🎯 Core Integration Partners

These 6 integrations are required for all contractor sites:

### 1. Sunlight Financial
**Financing & Loans**
- API Docs: https://developer.sunlightfinancial.com/docs
- Partner Portal: https://partners.sunlightfinancial.com
- Support: partners@sunlightfinancial.com

### 2. SumoQuote
**Instant Pricing & Proposals**
- API Docs: https://docs.sumoquote.com/api
- Developer Portal: https://developers.sumoquote.com
- Support: support@sumoquote.com

### 3. EagleView
**Aerial Measurements & Property Data**
- API Docs: https://developer.eagleview.com/docs
- Support: apisupport@eagleview.com

### 4. CompanyCam
**Photo Documentation & Project Management**
- API Docs: https://api.companycam.com/docs
- Webhooks: https://api.companycam.com/docs/webhooks
- Support: developers@companycam.com

### 5. Beacon Pro+
**Material Ordering & Supply Chain**
- API Docs: https://api.beaconproplus.com/swagger
- Partner Portal: https://partners.becn.com
- Support: techsupport@becn.com

### 6. QuickBooks Online
**Accounting & Invoicing**
- API Docs: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities
- OAuth Guide: https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization
- Support: https://developer.intuit.com/support

---

## 🏭 Industry-Specific Platforms

### Roofing
- **JobNimbus** - https://documenter.getpostman.com/view/3919598/S11HvKSz
- **AccuLynx** - https://www.acculynx.com/api
- **RoofSnap** - https://www.roofsnap.com/api
- **HOVER** - https://hover.to/developers
- **Xactimate** - https://www.verisk.com/insurance/products/xactimate

### Solar
- **Aurora Solar** - https://docs.aurorasolar.com/api
- **Helioscope** - https://helioscope.folsomlabs.com/api
- **Enphase** - https://developer.enphase.com
- **SolarEdge** - https://www.solaredge.com/sites/default/files/se_monitoring_api.pdf
- **PVWatts (NREL)** - https://developer.nrel.gov/docs/solar/pvwatts/v6

### HVAC
- **ServiceTitan** - https://developer.servicetitan.com/apis/hvac
- **Coolfront** - https://www.coolfront.com/api
- **Nest Pro** - https://developers.google.com/nest/device-access
- **Ecobee** - https://www.ecobee.com/home/developer/api/introduction

### Plumbing
- **Housecall Pro** - https://api.housecallpro.com/docs
- **ServiceTitan** - https://developer.servicetitan.com
- **Ferguson** - https://www.ferguson.com/api-documentation

### Auto Repair
- **Tekmetric** - https://developer.tekmetric.com
- **CARFAX** - https://developer.carfax.com
- **ALLDATA** - https://www.alldata.com/api
- **Mitchell Cloud** - https://www.mitchell.com/products/cloud-estimating

### Restoration & Mitigation
- **Jobber** - https://developer.getjobber.com
- **Encircle** - https://www.getencircle.com/api
- **DASH** - https://www.dashrestoration.com/api
- **DryTrack** - https://www.drytrack.com/api-docs

### Electrical
- **ServiceTitan Electrical** - https://developer.servicetitan.com/apis/electrical
- **Jobber** - https://developer.getjobber.com

---

## 🛠️ Technology Stack

### Core Platform

| Technology | Version | Docs | Purpose |
|-----------|---------|------|---------|
| **Node.js** | 20+ LTS | [nodejs.org](https://nodejs.org/docs) | Runtime environment |
| **TypeScript** | 5.x | [typescriptlang.org](https://www.typescriptlang.org/docs) | Type-safe development |
| **pnpm** | 9.x | [pnpm.io](https://pnpm.io/motivation) | Package manager & workspace manager |
| **Turborepo** | 2.x | [turbo.build](https://turbo.build/repo/docs) | Monorepo orchestration & caching |

### Frontend

| Technology | Docs | Purpose |
|-----------|------|---------|
| **Next.js 16** | [nextjs.org](https://nextjs.org/docs) | React framework with SSR/SSG, App Router |
| **React 19** | [react.dev](https://react.dev/reference/react) | UI library with hooks & server components |
| **Tailwind CSS 4** | [tailwindcss.com](https://tailwindcss.com/docs) | Utility-first styling with CSS engine |
| **Shadcn/ui** | [ui.shadcn.com](https://ui.shadcn.com/docs) | Accessible component library |
| **React Hook Form** | [react-hook-form.com](https://react-hook-form.com) | Performant form state management |
| **Zod** | [zod.dev](https://zod.dev) | TypeScript-first schema validation |
| **Framer Motion** | [framer.com/motion](https://www.framer.com/motion/introduction) | Declarative animations & transitions |

### Backend & API

| Technology | Docs | Purpose |
|-----------|------|---------|
| **tRPC 11** | [trpc.io](https://trpc.io/docs) | End-to-end type-safe RPC |
| **TanStack Query v5** | [tanstack.com/query](https://tanstack.com/query/latest) | Data fetching, caching & sync |
| **Express.js 5** | [expressjs.com](https://expressjs.com/en/api.html) | HTTP server for standalone APIs |
| **NextAuth.js v5** | [next-auth.js.org](https://next-auth.js.org/getting-started/introduction) | Authentication & session management |

### Database & Storage

| Technology | Version | Docs | Purpose |
|-----------|---------|------|---------|
| **PostgreSQL** | 18 | [postgresql.org](https://www.postgresql.org/docs/18) | Primary OLTP database |
| **Neon** | — | [neon.tech/docs](https://neon.tech/docs/introduction) | Managed PostgreSQL 18 with branching & autoscaling |
| **Prisma** | 6.x | [prisma.io](https://www.prisma.io/docs) | Type-safe ORM & migrations |
| **Redis** | 7+ | [redis.io](https://redis.io/docs) | Caching, sessions, real-time subscriptions |
| **pgvector** | 0.8+ | [github.com/pgvector](https://github.com/pgvector/pgvector) | Vector embeddings & semantic search |
| **AWS S3** | — | [docs.aws.amazon.com/s3](https://docs.aws.amazon.com/s3) | Object storage for artifacts & files |

### AI & Agents

| Technology | Docs | Purpose |
|-----------|------|---------|
| **Claude 4 (Anthropic)** | [docs.anthropic.com](https://docs.anthropic.com/claude/reference) | Primary LLM (Opus, Sonnet, Haiku) |
| **Langfuse** | [langfuse.com](https://langfuse.com/docs) | LLM observability, tracing & cost tracking |
| **Model Context Protocol (MCP)** | [modelcontextprotocol.io](https://modelcontextprotocol.io/docs) | Agent tool protocol & integrations |
| **Vercel AI SDK** | [sdk.vercel.ai](https://sdk.vercel.ai/docs) | Agent framework & streaming utilities |

### Job Orchestration & Events

| Technology | Version | Docs | Purpose |
|-----------|---------|------|---------|
| **BullMQ** | 5.x+ | [docs.bullmq.io](https://docs.bullmq.io) | Redis-backed job queue with priorities & retry logic |
| **Inngest** | — | [inngest.com/docs](https://www.inngest.com/docs) | Event-driven workflows with durable execution |
| **Redis** | 7+ | [redis.io](https://redis.io/docs) | Backing store for BullMQ queue state |

**Orchestration Pattern:** Event-driven with observable side effects. Inngest handles long-running workflows; BullMQ handles high-throughput agent job distribution.

### Testing

| Technology | Docs | Purpose |
|-----------|------|---------|
| **Vitest** | [vitest.dev](https://vitest.dev/guide) | Unit & integration tests with Vite speed |
| **Playwright** | [playwright.dev](https://playwright.dev/docs/intro) | Cross-browser E2E testing |
| **React Testing Library** | [testing-library.com](https://testing-library.com/docs/react-testing-library/intro) | Component & DOM testing |

### DevOps & Infrastructure

| Technology | Docs | Purpose |
|-----------|------|---------|
| **Docker** | [docs.docker.com](https://docs.docker.com) | Containerization for reproducible builds |
| **GitHub Actions** | [docs.github.com/actions](https://docs.github.com/en/actions) | CI/CD pipelines & automated workflows |
| **Vercel** | [vercel.com/docs](https://vercel.com/docs) | Next.js hosting with edge functions |
| **Fly.io** | [fly.io/docs](https://fly.io/docs) | API & worker deployment with global distribution |

### Monitoring & Observability

| Technology | Docs | Purpose |
|-----------|------|---------|
| **Sentry** | [docs.sentry.io](https://docs.sentry.io) | Error tracking & crash reporting |
| **Datadog** | [docs.datadoghq.com](https://docs.datadoghq.com) | APM, infrastructure monitoring & dashboards |
| **Prometheus + Grafana** | [prometheus.io](https://prometheus.io/docs), [grafana.com](https://grafana.com/docs) | Metrics collection & visualization |

### Communication

| Technology | Docs | Purpose |
|-----------|------|---------|
| **Twilio** | [twilio.com/docs](https://www.twilio.com/docs) | SMS & voice notifications |
| **SendGrid** | [docs.sendgrid.com](https://docs.sendgrid.com) | Transactional email at scale |
| **Resend** | [resend.com/docs](https://resend.com/docs) | Email API built for developers |

### Payments & Integrations

| Technology | Docs | Purpose |
|-----------|------|---------|
| **Stripe** | [stripe.com/docs](https://stripe.com/docs/api) | Payment processing & subscriptions |
| **Plaid** | [plaid.com/docs](https://plaid.com/docs) | Bank account & identity verification |

---

## 🚀 Development Setup

### Prerequisites

```bash
# Required versions
node --version    # v20.x or higher
pnpm --version    # v9.x or higher
docker --version  # For PostgreSQL & Redis
```

### Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Start infrastructure (PostgreSQL, Redis)
docker-compose -f docker-compose.dev.yml up -d

# 3. Setup environment variables
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env.local

# 4. Run database migrations
cd apps/api
pnpm db:push

# 5. Start development servers
pnpm dev  # Starts both web and API
```

### Project Structure

```
business-automation-system/
├── apps/
│   ├── web/              # Next.js 16 frontend (port 3000)
│   └── api/              # Express + tRPC API (port 3001)
├── packages/
│   ├── schema/           # Shared TS types & Zod schemas
│   ├── database/         # Prisma schema & migrations
│   └── agents/           # AI agent implementations & MCP servers
├── docs/                 # Architecture & guides
├── scripts/              # Dev utilities & agent runners
└── .github/workflows/    # CI/CD pipelines
```

### Environment Variables

**Required for Development:**

```bash
# Database (local dev with PostgreSQL 18)
DATABASE_URL=postgresql://admin:devpassword123@localhost:5432/business_automation

# Database (Neon managed PostgreSQL with branching)
# DATABASE_URL=postgresql://user:password@ep-xxx.us-east-1.neon.tech/business_automation

# Redis (for BullMQ & caching)
REDIS_URL=redis://localhost:6379

# Authentication (development only)
DISABLE_AUTH=true
NEXTAUTH_SECRET=$(openssl rand -base64 64)

# API Configuration
API_PORT=3001
NEXT_PUBLIC_API_URL=http://localhost:3001/trpc

# AI Services
ANTHROPIC_API_KEY=sk-ant-...
LANGFUSE_PUBLIC_KEY=pk-...
LANGFUSE_SECRET_KEY=sk-...

# Event Orchestration
INNGEST_API_KEY=<optional-for-dev>
INNGEST_EVENT_KEY=<optional-for-dev>
```

### Common Commands

```bash
# Development
pnpm dev              # Start all services
pnpm dev --filter=web # Start web only
pnpm dev --filter=api # Start API only

# Testing
pnpm test             # Run all tests
pnpm test:e2e         # E2E tests only
pnpm test:auth        # Auth tests only

# Database
pnpm db:push          # Sync schema to DB (PostgreSQL 18)
pnpm db:studio        # Open Prisma Studio
pnpm db:seed          # Seed test data

# Agent Development
pnpm scripts:dev-run-agent --agent=<id> --project=<id>  # Run single agent locally
pnpm scripts:manifest-check  # Validate agent manifests

# Build & Quality
pnpm build            # Build for production
pnpm typecheck        # TypeScript validation
pnpm lint             # ESLint + Prettier
```

---

## 🔄 Job Orchestration Pattern

### BullMQ (High-Throughput Agent Jobs)

BullMQ is used for distributed agent job processing with Redis backing:

```yaml
Use Cases:
  - Parallel agent skill execution
  - High-concurrency task distribution
  - Priority-based job scheduling
  - Built-in retry with exponential backoff
  - Job progress tracking & completion
```

**Config Example:**
```typescript
import { Queue } from 'bullmq';

const agentQueue = new Queue('agent-jobs', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: true,
  },
});
```

### Inngest (Durable Workflows)

Inngest is used for multi-step, event-driven orchestration with built-in durability:

```yaml
Use Cases:
  - Long-running project workflows
  - Complex retry logic across service boundaries
  - Event-driven automation triggers
  - Fan-out/fan-in patterns
  - Human approval gates
```

**Config Example:**
```typescript
import { inngest } from '@/lib/inngest';

export const projectWorkflow = inngest.createFunction(
  { id: 'project-workflow' },
  { event: 'project.created' },
  async ({ event, step }) => {
    await step.run('initialize', async () => {
      // Runs atomically or rolls back
    });
  }
);
```

---

## 📞 Support Contacts

### Core Integrations
- **Sunlight Financial**: partners@sunlightfinancial.com
- **SumoQuote**: support@sumoquote.com
- **EagleView**: apisupport@eagleview.com
- **CompanyCam**: developers@companycam.com
- **Beacon Pro+**: techsupport@becn.com
- **QuickBooks**: https://developer.intuit.com/support

### Infrastructure & Services
- **Vercel**: https://vercel.com/support
- **Anthropic (Claude)**: https://support.anthropic.com
- **Neon DB**: https://neon.tech/docs/get-in-touch
- **Fly.io**: https://fly.io/docs/getting-help
- **Google Cloud**: https://cloud.google.com/support

---

## 📖 Additional Documentation

- **Pre-Launch Checklist**: `/PRE_LAUNCH_CHECKLIST.md`
- **Agent Development Guide**: `/docs/AGENT_DEVELOPMENT.md`
- **Auth Setup Guide**: `/docs/AUTH_SETUP.md`
- **Architecture Decisions**: `/docs/adr/`
- **Contributing Guide**: `/CONTRIBUTING.md`

---

**Maintained by**: Platform Engineering Team  
**Document Version**: 2.1  
**Updated**: 2025-01-04
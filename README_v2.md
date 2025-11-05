# Architecture Documentation v2.0

This document provides an in-depth technical overview of the Business Automation System v2.0 architecture with streaming, multi-modal capabilities, and edge computing.

## Table of Contents

1. [System Overview](#system-overview)
2. [Multi-Agent Architecture v2.0](#multi-agent-architecture-v20)
3. [Streaming & Real-Time Architecture](#streaming--real-time-architecture)
4. [Semantic Memory & Learning](#semantic-memory--learning)
5. [Edge Computing Strategy](#edge-computing-strategy)
6. [Multi-Modal Processing](#multi-modal-processing)
7. [Continuous Optimization](#continuous-optimization)
8. [Enhanced Security & Compliance](#enhanced-security--compliance)

## 📚 Related Documentation

- **[Stack Documentation](./stack-docs.md)** - Complete technology stack, integration partners, and development setup guide
- **[Pre-Launch Checklist](./PRE_LAUNCH_CHECKLIST.md)** - Production deployment checklist
- **[Auth Setup Guide](./docs/AUTH_SETUP.md)** - Authentication configuration and OAuth setup

## System Overview

### High-Level Architecture v2.0

```
┌─────────────────────────────────────────────────────────────────┐
│                   WEB DASHBOARD (Next.js 16)                     │
│     React 19 RSC | Streaming SSR | Visual Builder | Live Preview │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                    WebSocket / SSE
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                  API LAYER (tRPC + GraphQL)                      │
│     Subscriptions | Real-time Updates | Edge Functions          │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│            ORCHESTRATION LAYER (LangGraph + Temporal)            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Stateful   │  │   Dynamic    │  │   Mixture    │          │
│  │   Workflows  │  │   Routing    │  │  of Experts  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│              AGENT EXECUTION LAYER (38+ Agents)                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌─────────────┐  │
│  │ Discovery  │ │  Design &  │ │  Content   │ │    Code     │  │
│  │  + Vision  │ │  + DALL-E  │ │ + Streaming│ │  + Edge     │  │
│  └────────────┘ └────────────┘ └────────────┘ └─────────────┘  │
│                                                                   │
│  ┌────────────────────┐ ┌─────────────────────────────────────┐ │
│  │ Quality + RUM Data │ │ Optimization + Self-Healing (NEW)   │ │
│  └────────────────────┘ └─────────────────────────────────────┘ │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│              SEMANTIC MEMORY LAYER (NEW)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   pgvector   │  │  LlamaIndex  │  │   Knowledge  │          │
│  │   Embeddings │  │     RAG      │  │    Graphs    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                    EDGE COMPUTING LAYER (NEW)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Cloudflare  │  │    Vercel    │  │   Regional   │          │
│  │   Workers    │  │     Edge     │  │    Caches    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│              DATA & STORAGE LAYER (Enhanced)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  PostgreSQL  │  │    Redis     │  │  Cloudflare  │          │
│  │  + pgvector  │  │  + Streams   │  │   R2/KV      │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## Multi-Agent Architecture v2.0

### LangGraph Orchestration

```typescript
// Dynamic agent graph with stateful coordination
import { StateGraph, Checkpoint } from '@langchain/langgraph';

const agentGraph = new StateGraph({
  channels: {
    projectState: { value: null, default: () => ({}) },
    agentOutputs: { value: [], reducer: (a, b) => [...a, ...b] },
    qualityScores: { value: {}, reducer: (a, b) => ({ ...a, ...b }) },
    memories: { value: [], reducer: (a, b) => [...a, ...b] }
  }
});

// Conditional routing based on quality scores
agentGraph.addConditionalEdge('quality_grading', (state) => {
  const avgScore = calculateAverageScore(state.qualityScores);
  if (avgScore < 0.7) return 'refinement';
  if (avgScore < 0.9) return 'optimization';
  return 'deployment';
});
```

### Mixture of Experts Pattern

```typescript
// Dynamic expert selection based on task complexity
const expertRouter = {
  async selectExperts(task: Task): Promise<Agent[]> {
    const embedding = await generateEmbedding(task.description);
    const similarTasks = await vectorStore.similaritySearch(embedding);
    
    return similarTasks
      .map(t => t.metadata.successfulAgents)
      .flat()
      .filter(unique)
      .slice(0, 5);
  }
};
```

### Agent Collaboration Protocol

```typescript
interface AgentMessage {
  id: string;
  type: 'request' | 'response' | 'broadcast' | 'memory';
  source: AgentRole;
  target?: AgentRole | 'all';
  payload: {
    content: any;
    confidence: number;
    reasoning?: string;
    artifacts?: GeneratedAsset[];
  };
  metadata: {
    timestamp: Date;
    iteration: number;
    parentMessageId?: string;
    memoryRelevance?: number;
  };
}
```

## Streaming & Real-Time Architecture

### Server-Sent Events Implementation

```typescript
// Real-time agent progress streaming
export async function* streamAgentExecution(
  agent: Agent,
  input: AgentInput
): AsyncGenerator<AgentProgressEvent> {
  const stream = await agent.executeStreaming(input);
  
  for await (const chunk of stream) {
    yield {
      type: 'progress',
      agentId: agent.id,
      content: chunk.content,
      reasoning: chunk.reasoning,
      confidence: chunk.confidence,
      tokensUsed: chunk.usage?.totalTokens,
    };
    
    // Store intermediate results for recovery
    await redis.xadd(
      `agent:${agent.id}:stream`,
      '*',
      'chunk', JSON.stringify(chunk)
    );
  }
}
```

### WebSocket Subscriptions

```typescript
// tRPC subscription for real-time updates
export const agentRouter = router({
  onAgentProgress: subscription({
    input: z.object({ projectId: z.string() }),
    resolve({ input, ctx }) {
      return observable<AgentProgressEvent>((observer) => {
        const listener = (event: AgentProgressEvent) => {
          if (event.projectId === input.projectId) {
            observer.next(event);
          }
        };
        
        eventEmitter.on('agent:progress', listener);
        
        return () => {
          eventEmitter.off('agent:progress', listener);
        };
      });
    },
  }),
});
```

### Progressive Rendering

```typescript
// React 19 with streaming SSR
export default async function ProjectDashboard({ id }: Props) {
  return (
    <div>
      <Suspense fallback={<ProjectHeaderSkeleton />}>
        <ProjectHeader projectId={id} />
      </Suspense>
      
      <Suspense fallback={<AgentProgressSkeleton />}>
        <StreamingAgentProgress projectId={id} />
      </Suspense>
      
      <Suspense fallback={<WebsitePreviewSkeleton />}>
        <LiveWebsitePreview projectId={id} />
      </Suspense>
    </div>
  );
}
```

## Semantic Memory & Learning

### Vector Storage Architecture

```typescript
// pgvector implementation for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE agent_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  project_id UUID,
  agent_role TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB,
  importance FLOAT DEFAULT 0.5,
  access_count INT DEFAULT 0,
  last_accessed TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX idx_memories_embedding 
  ON agent_memories USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

### Cross-Project Learning

```typescript
class OrganizationalMemory {
  async learnFromProject(project: Project, evaluation: Evaluation) {
    // Extract successful patterns
    const patterns = await this.extractPatterns(project, evaluation);
    
    for (const pattern of patterns) {
      // Generate embedding for pattern
      const embedding = await this.generateEmbedding(pattern);
      
      // Store with metadata
      await this.vectorStore.insert({
        embedding,
        metadata: {
          projectId: project.id,
          industry: project.industry,
          successScore: evaluation.overallScore,
          pattern: pattern.type,
          components: pattern.artifacts,
        }
      });
    }
    
    // Update knowledge graph
    await this.updateKnowledgeGraph(patterns);
  }
  
  async retrieveRelevantMemories(context: AgentContext): Promise<Memory[]> {
    const query = await this.generateEmbedding(context);
    const memories = await this.vectorStore.search(query, {
      filter: {
        industry: context.industry,
        minSuccessScore: 0.8
      },
      k: 10
    });
    
    // Rerank by recency and relevance
    return this.rerank(memories, context);
  }
}
```

### Industry-Specific Knowledge Graphs

```typescript
// Knowledge graph for pattern relationships
class IndustryKnowledgeGraph {
  private graph: Graph;
  
  async addPattern(pattern: SuccessPattern) {
    const node = this.graph.addNode({
      id: pattern.id,
      type: pattern.type,
      industry: pattern.industry,
      attributes: pattern.attributes,
    });
    
    // Link to similar patterns
    const similar = await this.findSimilar(pattern);
    for (const sim of similar) {
      this.graph.addEdge(node, sim, {
        weight: calculateSimilarity(pattern, sim),
        type: 'similar_to'
      });
    }
    
    // Link to components
    for (const component of pattern.components) {
      this.graph.addEdge(node, component, {
        type: 'uses_component'
      });
    }
  }
}
```

## Edge Computing Strategy

### Cloudflare Workers Deployment

```typescript
// Edge function for lightweight agents
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    
    if (pathname.startsWith('/agent/')) {
      const agentId = pathname.split('/')[2];
      const agent = await loadLightweightAgent(agentId, env);
      
      // Execute on edge for low latency
      const result = await agent.execute({
        input: await request.json(),
        cache: env.KV,
        vectorStore: env.VECTORIZE,
      });
      
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
};
```

### Vercel Edge Functions

```typescript
// Edge API route with streaming
export const runtime = 'edge';

export async function POST(req: Request) {
  const { messages } = await req.json();
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages,
    stream: true,
  });
  
  // Stream response directly from edge
  return new Response(
    streamToReadableStream(response),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    }
  );
}
```

### Global Distribution Strategy

```typescript
// Multi-region deployment configuration
const deploymentConfig = {
  agents: {
    lightweight: {
      // Deploy to all edge locations
      locations: ['global'],
      runtime: 'edge',
      maxDuration: 30, // seconds
    },
    heavyweight: {
      // Deploy to specific regions
      locations: ['us-east-1', 'eu-west-1', 'ap-northeast-1'],
      runtime: 'nodejs',
      maxDuration: 900, // 15 minutes
    }
  },
  
  routing: {
    // Route based on latency
    strategy: 'latency-based',
    fallback: 'us-east-1',
    
    // Cache strategy
    cache: {
      static: 'cloudflare-r2',
      dynamic: 'redis-global',
      ttl: {
        embeddings: 86400, // 1 day
        results: 3600,     // 1 hour
      }
    }
  }
};
```

## Multi-Modal Processing

### Vision Analysis Pipeline

```typescript
class VisionAnalyzer {
  async analyzeCompetitorWebsite(url: string): Promise<WebsiteAnalysis> {
    // Capture screenshots at multiple viewports
    const screenshots = await this.captureScreenshots(url, [
      { width: 1920, height: 1080 }, // Desktop
      { width: 768, height: 1024 },  // Tablet
      { width: 375, height: 812 },   // Mobile
    ]);
    
    // Analyze with Claude Vision
    const analyses = await Promise.all(
      screenshots.map(async (screenshot) => {
        return await anthropic.messages.create({
          model: 'claude-3-opus-20240229',
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/png', data: screenshot }
              },
              {
                type: 'text',
                text: 'Analyze this website design...'
              }
            ]
          }]
        });
      })
    );
    
    // Extract design patterns
    return this.extractPatterns(analyses);
  }
}
```

### Image Generation Integration

```typescript
class BrandImageGenerator {
  async generateHeroImage(brand: BrandIdentity): Promise<GeneratedImage> {
    // Generate with DALL-E 3
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: this.buildPrompt(brand),
      size: '1792x1024',
      quality: 'hd',
      style: 'natural',
    });
    
    // Optimize for web
    const optimized = await this.optimizeImage(response.data[0].url, {
      format: 'webp',
      quality: 85,
      sizes: [
        { width: 1920, suffix: '@2x' },
        { width: 960, suffix: '@1x' },
        { width: 480, suffix: '@mobile' },
      ]
    });
    
    return optimized;
  }
}
```

## Continuous Optimization

### Self-Healing System

```typescript
class SelfHealingMonitor {
  async monitorAndHeal(website: DeployedWebsite) {
    // Real User Monitoring
    const metrics = await this.collectRUMData(website);
    
    // Detect issues
    const issues = await this.detectIssues(metrics);
    
    for (const issue of issues) {
      // Generate fix
      const fix = await this.generateFix(issue);
      
      // Test fix in isolation
      const testResult = await this.testFix(fix, website);
      
      if (testResult.success) {
        // Apply fix
        await this.applyFix(fix, website);
        
        // Verify resolution
        await this.verifyResolution(issue, website);
      } else {
        // Escalate to human
        await this.escalate(issue, testResult);
      }
    }
  }
}
```

### A/B Testing Framework

```typescript
class ContentOptimizer {
  async runABTest(page: WebPage, variants: Variant[]) {
    // Deploy variants to edge
    const deployments = await this.deployVariants(page, variants);
    
    // Configure traffic split
    await this.configureTrafficSplit({
      control: { weight: 50, deployment: deployments[0] },
      variants: variants.map((v, i) => ({
        weight: 50 / variants.length,
        deployment: deployments[i + 1]
      }))
    });
    
    // Monitor performance
    const monitor = this.startMonitoring(deployments);
    
    // Analyze results
    const results = await monitor.waitForSignificance({
      minSampleSize: 1000,
      confidenceLevel: 0.95,
      metrics: ['conversion', 'engagement', 'bounce']
    });
    
    // Auto-apply winner
    if (results.winner) {
      await this.promoteVariant(results.winner);
    }
  }
}
```

## Enhanced Security & Compliance

### Multi-Tenant Isolation v2.0

```sql
-- Enhanced RLS with performance optimization
CREATE POLICY optimized_tenant_isolation ON projects
  USING (
    tenant_id = current_setting('app.current_tenant_id')::uuid
    AND deleted_at IS NULL
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id')::uuid
  );

-- Audit logging
CREATE TABLE security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
) PARTITION BY RANGE (created_at);
```

### Zero-Trust Agent Communication

```typescript
class SecureAgentBus {
  async sendMessage(message: AgentMessage) {
    // Sign message
    const signature = await this.sign(message);
    
    // Encrypt sensitive data
    const encrypted = await this.encrypt(message.payload);
    
    // Send with verification
    const response = await this.transport.send({
      ...message,
      payload: encrypted,
      signature,
      nonce: crypto.randomUUID(),
    });
    
    // Verify response
    if (!await this.verify(response)) {
      throw new SecurityError('Invalid response signature');
    }
    
    return this.decrypt(response);
  }
}
```

---

**Next**: [Agent Development Guide v2.0](../agent-guides/README_v2.md)

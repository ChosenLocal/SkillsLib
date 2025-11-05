# Implementation Guide: Streaming & Real-Time Features

This guide walks through implementing the v2.0 streaming architecture with agent progress, real-time updates, and progressive rendering.

## Table of Contents
1. [Streaming Agent Responses](#streaming-agent-responses)
2. [WebSocket Subscriptions](#websocket-subscriptions)
3. [Server-Sent Events](#server-sent-events)
4. [React 19 Streaming SSR](#react-19-streaming-ssr)
5. [Progress Tracking](#progress-tracking)
6. [Error Recovery](#error-recovery)

## Streaming Agent Responses

### Setting Up Vercel AI SDK Streaming

```typescript
// packages/agents/shared/streaming-agent.ts
import { StreamingTextResponse, LangChainStream } from 'ai';
import { Anthropic } from '@anthropic-ai/sdk';
import { Redis } from '@upstash/redis';

export class StreamingAgent {
  private anthropic: Anthropic;
  private redis: Redis;
  
  constructor(config: AgentConfig) {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    this.redis = Redis.fromEnv();
  }
  
  async *executeStreaming(
    input: AgentInput
  ): AsyncGenerator<AgentChunk> {
    const { stream, handlers } = LangChainStream({
      onStart: async () => {
        await this.redis.xadd(
          `agent:${this.id}:stream`,
          '*',
          'status', 'started',
          'timestamp', Date.now()
        );
      },
      onToken: async (token: string) => {
        // Store tokens for recovery
        await this.redis.append(
          `agent:${this.id}:tokens`,
          token
        );
      },
      onCompletion: async (completion: string) => {
        await this.saveToMemory(completion);
      },
    });
    
    // Start Claude streaming
    const response = await this.anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      messages: [{ role: 'user', content: input.prompt }],
      stream: true,
      max_tokens: 4096,
    });
    
    // Process stream chunks
    for await (const chunk of response) {
      if (chunk.type === 'content_block_delta') {
        const text = chunk.delta.text;
        
        yield {
          type: 'content',
          content: text,
          reasoning: await this.extractReasoning(text),
          confidence: await this.calculateConfidence(text),
          timestamp: Date.now(),
        };
        
        // Update progress
        await this.updateProgress(chunk);
      }
    }
  }
  
  private async extractReasoning(text: string): Promise<string | null> {
    // Extract reasoning from <thinking> tags if present
    const reasoningMatch = text.match(/<thinking>(.*?)<\/thinking>/s);
    return reasoningMatch ? reasoningMatch[1] : null;
  }
  
  private async calculateConfidence(text: string): Promise<number> {
    // Calculate confidence based on content
    const hasEvidence = /because|therefore|thus/i.test(text);
    const hasCitations = /\[\d+\]/.test(text);
    const hasQualifiers = /might|perhaps|possibly/i.test(text);
    
    let confidence = 0.7; // baseline
    if (hasEvidence) confidence += 0.1;
    if (hasCitations) confidence += 0.1;
    if (hasQualifiers) confidence -= 0.1;
    
    return Math.max(0, Math.min(1, confidence));
  }
}
```

### Progressive Content Generation

```typescript
// packages/agents/content/streaming-content-generator.ts
export class StreamingContentGenerator {
  async *generateContent(
    section: ContentSection
  ): AsyncGenerator<ContentChunk> {
    const agent = new StreamingAgent({
      role: 'content_generator',
      temperature: 0.7,
    });
    
    // Generate content in chunks
    const chunks = [
      { type: 'headline', prompt: this.getHeadlinePrompt(section) },
      { type: 'subheadline', prompt: this.getSubheadlinePrompt(section) },
      { type: 'body', prompt: this.getBodyPrompt(section) },
      { type: 'cta', prompt: this.getCTAPrompt(section) },
    ];
    
    for (const chunk of chunks) {
      yield* this.generateChunk(agent, chunk);
    }
  }
  
  private async *generateChunk(
    agent: StreamingAgent,
    chunk: ChunkConfig
  ): AsyncGenerator<ContentChunk> {
    const stream = agent.executeStreaming({
      prompt: chunk.prompt,
      context: this.context,
    });
    
    for await (const piece of stream) {
      yield {
        type: chunk.type,
        content: piece.content,
        metadata: {
          confidence: piece.confidence,
          reasoning: piece.reasoning,
          timestamp: piece.timestamp,
        }
      };
      
      // Update UI in real-time
      await this.publishUpdate({
        section: chunk.type,
        content: piece.content,
      });
    }
  }
}
```

## WebSocket Subscriptions

### tRPC WebSocket Setup

```typescript
// apps/api/src/routers/agent-subscriptions.ts
import { observable } from '@trpc/server/observable';
import { EventEmitter } from 'events';
import { z } from 'zod';

const agentEvents = new EventEmitter();

export const agentSubscriptionRouter = router({
  // Subscribe to agent progress
  onAgentProgress: subscription({
    input: z.object({
      projectId: z.string(),
      agentIds: z.array(z.string()).optional(),
    }),
    
    resolve({ input, ctx }) {
      return observable<AgentProgressEvent>((observer) => {
        const handleProgress = (event: AgentProgressEvent) => {
          if (event.projectId !== input.projectId) return;
          if (input.agentIds && !input.agentIds.includes(event.agentId)) return;
          
          observer.next(event);
        };
        
        const handleError = (error: Error) => {
          observer.error(error);
        };
        
        const handleComplete = (data: { projectId: string }) => {
          if (data.projectId === input.projectId) {
            observer.complete();
          }
        };
        
        agentEvents.on('progress', handleProgress);
        agentEvents.on('error', handleError);
        agentEvents.on('complete', handleComplete);
        
        return () => {
          agentEvents.off('progress', handleProgress);
          agentEvents.off('error', handleError);
          agentEvents.off('complete', handleComplete);
        };
      });
    },
  }),
  
  // Subscribe to quality scores
  onQualityUpdate: subscription({
    input: z.object({
      projectId: z.string(),
    }),
    
    resolve({ input, ctx }) {
      return observable<QualityScoreUpdate>((observer) => {
        const redis = new Redis();
        
        // Subscribe to Redis stream
        const subscription = redis.subscribe(
          `quality:${input.projectId}`,
          (message) => {
            observer.next(JSON.parse(message));
          }
        );
        
        return () => {
          subscription.unsubscribe();
        };
      });
    },
  }),
});
```

### Client-Side WebSocket Consumption

```typescript
// apps/web/src/hooks/use-agent-progress.ts
import { trpc } from '@/lib/trpc';
import { useEffect, useState } from 'react';

export function useAgentProgress(projectId: string) {
  const [progress, setProgress] = useState<AgentProgress>({});
  const [connected, setConnected] = useState(false);
  
  const subscription = trpc.agent.onAgentProgress.useSubscription(
    { projectId },
    {
      onStarted: () => setConnected(true),
      onData: (data: AgentProgressEvent) => {
        setProgress(prev => ({
          ...prev,
          [data.agentId]: {
            status: data.status,
            progress: data.progress,
            content: data.content,
            reasoning: data.reasoning,
            confidence: data.confidence,
            lastUpdated: new Date(),
          },
        }));
      },
      onError: (error) => {
        console.error('Subscription error:', error);
        setConnected(false);
      },
    }
  );
  
  return { progress, connected, subscription };
}
```

## Server-Sent Events

### SSE Implementation for Non-WebSocket Clients

```typescript
// apps/api/src/routes/sse/agent-stream.ts
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      
      // Send initial connection
      controller.enqueue(
        encoder.encode(': Connected\n\n')
      );
      
      // Subscribe to Redis streams
      const redis = new Redis();
      const streamKey = `agent:${projectId}:events`;
      let lastId = '$';
      
      const interval = setInterval(async () => {
        try {
          const messages = await redis.xread(
            'BLOCK', 1000,
            'STREAMS', streamKey, lastId
          );
          
          if (messages && messages.length > 0) {
            for (const [stream, entries] of messages) {
              for (const [id, fields] of entries) {
                const event = {
                  id,
                  type: fields.type,
                  data: JSON.parse(fields.data),
                  timestamp: fields.timestamp,
                };
                
                controller.enqueue(
                  encoder.encode(
                    `id: ${id}\n` +
                    `event: ${event.type}\n` +
                    `data: ${JSON.stringify(event.data)}\n\n`
                  )
                );
                
                lastId = id;
              }
            }
          }
        } catch (error) {
          controller.error(error);
        }
      }, 100);
      
      // Cleanup on close
      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

### Client-Side SSE Consumption

```typescript
// apps/web/src/hooks/use-sse-progress.ts
export function useSSEProgress(projectId: string) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [connected, setConnected] = useState(false);
  
  useEffect(() => {
    const eventSource = new EventSource(
      `/api/sse/agent-stream?projectId=${projectId}`
    );
    
    eventSource.onopen = () => setConnected(true);
    
    eventSource.addEventListener('agent:progress', (event) => {
      const data = JSON.parse(event.data);
      setEvents(prev => [...prev, data]);
    });
    
    eventSource.addEventListener('agent:complete', (event) => {
      const data = JSON.parse(event.data);
      setEvents(prev => [...prev, { ...data, complete: true }]);
    });
    
    eventSource.onerror = () => {
      setConnected(false);
      // Automatic reconnection handled by EventSource
    };
    
    return () => {
      eventSource.close();
    };
  }, [projectId]);
  
  return { events, connected };
}
```

## React 19 Streaming SSR

### Server Component with Streaming

```typescript
// apps/web/src/app/project/[id]/page.tsx
import { Suspense } from 'react';
import { notFound } from 'next/navigation';

export default async function ProjectPage({ 
  params 
}: { 
  params: { id: string } 
}) {
  return (
    <div className="container mx-auto p-6">
      {/* Header loads immediately */}
      <ProjectHeader projectId={params.id} />
      
      {/* Agent progress streams in */}
      <Suspense fallback={<AgentProgressSkeleton />}>
        <StreamingAgentProgress projectId={params.id} />
      </Suspense>
      
      {/* Website preview loads progressively */}
      <Suspense fallback={<WebsitePreviewSkeleton />}>
        <StreamingWebsitePreview projectId={params.id} />
      </Suspense>
      
      {/* Quality scores stream as available */}
      <Suspense fallback={<QualityScoresSkeleton />}>
        <StreamingQualityScores projectId={params.id} />
      </Suspense>
    </div>
  );
}

// Streaming component
async function StreamingAgentProgress({ 
  projectId 
}: { 
  projectId: string 
}) {
  // This creates a streaming boundary
  const stream = await fetch(
    `${process.env.API_URL}/projects/${projectId}/agents/stream`,
    { cache: 'no-store' }
  );
  
  return (
    <AgentProgressDisplay stream={stream.body} />
  );
}
```

### Client Component with Streaming Updates

```typescript
// apps/web/src/components/streaming-website-preview.tsx
'use client';

import { useEffect, useState } from 'react';
import { useStream } from '@/hooks/use-stream';

export function StreamingWebsitePreview({ 
  projectId 
}: { 
  projectId: string 
}) {
  const { data, loading, error } = useStream(
    `/api/projects/${projectId}/preview/stream`
  );
  
  const [sections, setSections] = useState<WebsiteSection[]>([]);
  
  useEffect(() => {
    if (data) {
      setSections(prev => {
        const updated = [...prev];
        const index = updated.findIndex(s => s.id === data.sectionId);
        
        if (index >= 0) {
          updated[index] = { ...updated[index], ...data.updates };
        } else {
          updated.push(data);
        }
        
        return updated;
      });
    }
  }, [data]);
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-4">Live Preview</h2>
      
      <div className="relative">
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
            <div className="flex space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-100" />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-200" />
            </div>
          </div>
        )}
        
        {/* Progressive sections */}
        <div className="space-y-4">
          {sections.map(section => (
            <WebsiteSection
              key={section.id}
              section={section}
              isStreaming={!section.complete}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

## Progress Tracking

### Granular Progress Updates

```typescript
// packages/agents/shared/progress-tracker.ts
export class AgentProgressTracker {
  private redis: Redis;
  private projectId: string;
  private agentId: string;
  
  async updateProgress(update: ProgressUpdate) {
    const key = `progress:${this.projectId}:${this.agentId}`;
    
    // Store progress in Redis
    await this.redis.hset(key, {
      status: update.status,
      percentage: update.percentage,
      currentStep: update.currentStep,
      totalSteps: update.totalSteps,
      estimatedTimeRemaining: update.estimatedTimeRemaining,
      tokensUsed: update.tokensUsed,
      cost: update.cost,
      lastUpdated: Date.now(),
    });
    
    // Publish to subscribers
    await this.redis.publish(
      `progress:${this.projectId}`,
      JSON.stringify({
        agentId: this.agentId,
        ...update,
      })
    );
    
    // Store in time series for analytics
    await this.redis.zadd(
      `progress:history:${this.projectId}`,
      Date.now(),
      JSON.stringify({
        agentId: this.agentId,
        percentage: update.percentage,
        timestamp: Date.now(),
      })
    );
  }
  
  async getProgress(): Promise<AgentProgress> {
    const key = `progress:${this.projectId}:${this.agentId}`;
    const data = await this.redis.hgetall(key);
    
    return {
      ...data,
      percentage: parseFloat(data.percentage || '0'),
      tokensUsed: parseInt(data.tokensUsed || '0'),
      cost: parseFloat(data.cost || '0'),
    };
  }
  
  async getProjectProgress(): Promise<ProjectProgress> {
    const agents = await this.redis.smembers(
      `project:${this.projectId}:agents`
    );
    
    const progresses = await Promise.all(
      agents.map(agentId => 
        this.redis.hgetall(`progress:${this.projectId}:${agentId}`)
      )
    );
    
    const total = progresses.reduce(
      (acc, p) => acc + parseFloat(p.percentage || '0'),
      0
    );
    
    return {
      overall: total / agents.length,
      agents: progresses,
      estimatedCompletion: this.estimateCompletion(progresses),
    };
  }
}
```

## Error Recovery

### Stream Recovery Mechanism

```typescript
// packages/streaming/recovery.ts
export class StreamRecoveryManager {
  private checkpoints: Map<string, StreamCheckpoint> = new Map();
  
  async createCheckpoint(
    streamId: string,
    state: StreamState
  ): Promise<void> {
    const checkpoint: StreamCheckpoint = {
      id: crypto.randomUUID(),
      streamId,
      position: state.position,
      content: state.content,
      metadata: state.metadata,
      timestamp: Date.now(),
    };
    
    // Store in Redis with TTL
    await this.redis.setex(
      `checkpoint:${streamId}`,
      3600, // 1 hour TTL
      JSON.stringify(checkpoint)
    );
    
    this.checkpoints.set(streamId, checkpoint);
  }
  
  async recoverStream(
    streamId: string
  ): Promise<StreamState | null> {
    // Try memory first
    let checkpoint = this.checkpoints.get(streamId);
    
    // Fallback to Redis
    if (!checkpoint) {
      const data = await this.redis.get(`checkpoint:${streamId}`);
      if (data) {
        checkpoint = JSON.parse(data);
      }
    }
    
    if (!checkpoint) return null;
    
    // Verify checkpoint integrity
    const isValid = await this.verifyCheckpoint(checkpoint);
    if (!isValid) {
      console.warn(`Invalid checkpoint for stream ${streamId}`);
      return null;
    }
    
    return {
      position: checkpoint.position,
      content: checkpoint.content,
      metadata: checkpoint.metadata,
    };
  }
  
  async handleStreamFailure(
    streamId: string,
    error: Error
  ): Promise<void> {
    console.error(`Stream ${streamId} failed:`, error);
    
    // Attempt recovery
    const state = await this.recoverStream(streamId);
    
    if (state) {
      // Resume from checkpoint
      await this.resumeStream(streamId, state);
    } else {
      // Start fresh with exponential backoff
      await this.retryWithBackoff(streamId);
    }
  }
  
  private async retryWithBackoff(
    streamId: string,
    attempt: number = 1
  ): Promise<void> {
    const maxAttempts = 5;
    const baseDelay = 1000;
    
    if (attempt > maxAttempts) {
      throw new Error(`Max retry attempts exceeded for stream ${streamId}`);
    }
    
    const delay = baseDelay * Math.pow(2, attempt - 1);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      await this.restartStream(streamId);
    } catch (error) {
      await this.retryWithBackoff(streamId, attempt + 1);
    }
  }
}
```

## Best Practices

### 1. Progressive Enhancement
- Always provide fallbacks for non-streaming clients
- Use skeleton loaders for better perceived performance
- Implement graceful degradation

### 2. Error Handling
- Create checkpoints for long-running streams
- Implement automatic recovery mechanisms
- Provide clear error messages to users

### 3. Performance Optimization
- Use compression for WebSocket messages
- Implement message batching for high-frequency updates
- Cache partial results in Redis

### 4. Security
- Authenticate WebSocket connections
- Rate limit streaming endpoints
- Validate all streaming data

### 5. Monitoring
- Track streaming performance metrics
- Monitor connection stability
- Log recovery attempts

## Testing Streaming Features

```typescript
// packages/streaming/__tests__/streaming.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { StreamingAgent } from '../streaming-agent';

describe('Streaming Agent', () => {
  let agent: StreamingAgent;
  
  beforeEach(() => {
    agent = new StreamingAgent({
      role: 'test_agent',
      mockMode: true,
    });
  });
  
  it('should stream content progressively', async () => {
    const chunks: string[] = [];
    
    for await (const chunk of agent.executeStreaming({ prompt: 'test' })) {
      chunks.push(chunk.content);
    }
    
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toContain('test response');
  });
  
  it('should recover from stream interruption', async () => {
    const stream = agent.executeStreaming({ prompt: 'test' });
    
    // Simulate interruption
    await agent.interrupt();
    
    // Should recover
    const recovered = await agent.recover();
    expect(recovered).toBeTruthy();
  });
});
```

---

**Next Steps:**
1. Implement WebSocket server with proper authentication
2. Set up Redis streams for event distribution
3. Configure Vercel for streaming SSR
4. Add progress tracking to all agents
5. Implement checkpoint system for recovery

This streaming architecture provides real-time feedback, better user experience, and robust error recovery for your multi-agent system.

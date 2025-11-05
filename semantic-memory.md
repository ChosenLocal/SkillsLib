# Semantic Memory & Learning System

This guide covers the implementation of organizational learning through vector embeddings, RAG (Retrieval Augmented Generation), and cross-project pattern recognition.

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Vector Storage Setup](#vector-storage-setup)
3. [Memory Formation](#memory-formation)
4. [Knowledge Retrieval](#knowledge-retrieval)
5. [Cross-Project Learning](#cross-project-learning)
6. [Industry Knowledge Graphs](#industry-knowledge-graphs)

## Architecture Overview

### Memory System Components

```
┌─────────────────────────────────────────────────────┐
│                  Agent Execution                     │
└────────────────────┬────────────────────────────────┘
                     ↓
         ┌───────────┴───────────┐
         │   Memory Formation    │
         │  (Extract Patterns)   │
         └───────────┬───────────┘
                     ↓
     ┌───────────────┴───────────────┐
     │                               │
┌────▼─────────┐           ┌────────▼────────┐
│   Vector     │           │   Knowledge     │
│   Storage    │           │     Graph       │
│  (pgvector)  │           │  (Neo4j/Redis)  │
└──────┬───────┘           └────────┬────────┘
       │                             │
       └─────────────┬───────────────┘
                     ↓
           ┌─────────────────┐
           │  RAG Pipeline   │
           │  (LlamaIndex)   │
           └────────┬────────┘
                    ↓
         ┌──────────────────────┐
         │  Enhanced Agent      │
         │  with Memories       │
         └──────────────────────┘
```

## Vector Storage Setup

### PostgreSQL with pgvector

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Main memories table
CREATE TABLE agent_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Memory metadata
  memory_type VARCHAR(50) NOT NULL, -- 'pattern', 'solution', 'error', 'optimization'
  source_type VARCHAR(50) NOT NULL, -- 'project', 'agent', 'evaluation', 'user_feedback'
  source_id VARCHAR(255) NOT NULL,
  
  -- Content and embedding
  content TEXT NOT NULL,
  summary TEXT,
  embedding vector(1536), -- OpenAI ada-002 dimensions
  
  -- Contextual information
  industry VARCHAR(50),
  agent_role VARCHAR(50),
  project_type VARCHAR(50),
  
  -- Quality metrics
  success_score FLOAT DEFAULT 0.5,
  confidence_score FLOAT DEFAULT 0.5,
  usage_count INT DEFAULT 0,
  helpfulness_score FLOAT DEFAULT 0.5,
  
  -- Temporal decay
  created_at TIMESTAMP DEFAULT NOW(),
  last_accessed TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  
  -- Relationships
  parent_memory_id UUID REFERENCES agent_memories(id),
  related_memories UUID[] DEFAULT '{}',
  
  -- Additional metadata
  metadata JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  
  -- Indexes for performance
  INDEX idx_memories_tenant (tenant_id),
  INDEX idx_memories_type (memory_type, source_type),
  INDEX idx_memories_industry (industry),
  INDEX idx_memories_embedding USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100)
);

-- Memory relationships table
CREATE TABLE memory_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_memory_id UUID REFERENCES agent_memories(id) ON DELETE CASCADE,
  to_memory_id UUID REFERENCES agent_memories(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50), -- 'similar', 'contradicts', 'extends', 'replaces'
  strength FLOAT DEFAULT 0.5,
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(from_memory_id, to_memory_id, relationship_type)
);

-- Memory access log for importance decay
CREATE TABLE memory_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID REFERENCES agent_memories(id) ON DELETE CASCADE,
  accessed_by VARCHAR(50), -- agent_role or user_id
  access_type VARCHAR(50), -- 'read', 'applied', 'rejected'
  relevance_score FLOAT,
  outcome VARCHAR(50), -- 'helpful', 'not_helpful', 'neutral'
  accessed_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_access_memory (memory_id),
  INDEX idx_access_time (accessed_at)
);
```

### Memory Service Implementation

```typescript
// packages/memory/src/memory-service.ts
import { OpenAI } from 'openai';
import { Pool } from 'pg';
import { LlamaIndex } from 'llamaindex';

export class MemoryService {
  private pool: Pool;
  private openai: OpenAI;
  private index: LlamaIndex;
  
  constructor() {
    this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.index = new LlamaIndex();
  }
  
  async createMemory(params: CreateMemoryParams): Promise<Memory> {
    // Generate embedding
    const embedding = await this.generateEmbedding(params.content);
    
    // Extract summary if content is long
    const summary = params.content.length > 500
      ? await this.generateSummary(params.content)
      : params.content;
    
    // Store in database
    const query = `
      INSERT INTO agent_memories (
        tenant_id, memory_type, source_type, source_id,
        content, summary, embedding, industry, agent_role,
        project_type, success_score, confidence_score,
        metadata, tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;
    
    const values = [
      params.tenantId,
      params.memoryType,
      params.sourceType,
      params.sourceId,
      params.content,
      summary,
      embedding,
      params.industry,
      params.agentRole,
      params.projectType,
      params.successScore || 0.5,
      params.confidenceScore || 0.5,
      JSON.stringify(params.metadata || {}),
      params.tags || [],
    ];
    
    const result = await this.pool.query(query, values);
    const memory = result.rows[0];
    
    // Find and link related memories
    await this.linkRelatedMemories(memory);
    
    // Update knowledge graph
    await this.updateKnowledgeGraph(memory);
    
    return memory;
  }
  
  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });
    
    return response.data[0].embedding;
  }
  
  private async generateSummary(text: string): Promise<string> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: 'Summarize this content in 2-3 sentences, focusing on key patterns and insights.',
        },
        {
          role: 'user',
          content: text,
        },
      ],
      max_tokens: 100,
    });
    
    return response.choices[0].message.content;
  }
  
  private async linkRelatedMemories(memory: Memory): Promise<void> {
    // Find similar memories using vector similarity
    const query = `
      SELECT id, 1 - (embedding <=> $1) AS similarity
      FROM agent_memories
      WHERE tenant_id = $2
        AND id != $3
        AND 1 - (embedding <=> $1) > 0.8
      ORDER BY similarity DESC
      LIMIT 10
    `;
    
    const result = await this.pool.query(query, [
      memory.embedding,
      memory.tenant_id,
      memory.id,
    ]);
    
    for (const related of result.rows) {
      await this.createRelationship(
        memory.id,
        related.id,
        'similar',
        related.similarity
      );
    }
  }
}
```

## Memory Formation

### Pattern Extraction

```typescript
// packages/memory/src/pattern-extractor.ts
export class PatternExtractor {
  async extractFromProject(
    project: Project,
    evaluation: WebsiteEvaluation
  ): Promise<ExtractedPattern[]> {
    const patterns: ExtractedPattern[] = [];
    
    // Extract successful design patterns
    if (evaluation.grades.design?.score > 0.8) {
      patterns.push(...await this.extractDesignPatterns(project));
    }
    
    // Extract content patterns
    if (evaluation.grades.content?.score > 0.8) {
      patterns.push(...await this.extractContentPatterns(project));
    }
    
    // Extract conversion patterns
    if (evaluation.grades.conversion?.score > 0.8) {
      patterns.push(...await this.extractConversionPatterns(project));
    }
    
    // Extract failure patterns to avoid
    if (evaluation.overallScore < 0.6) {
      patterns.push(...await this.extractFailurePatterns(project, evaluation));
    }
    
    return patterns;
  }
  
  private async extractDesignPatterns(
    project: Project
  ): Promise<DesignPattern[]> {
    const patterns: DesignPattern[] = [];
    
    // Analyze color combinations
    const colorAnalysis = await this.analyzeColorCombinations(project);
    if (colorAnalysis.harmonyScore > 0.9) {
      patterns.push({
        type: 'color_palette',
        name: 'Successful Color Combination',
        content: {
          primary: colorAnalysis.primary,
          secondary: colorAnalysis.secondary,
          accent: colorAnalysis.accent,
          reasoning: colorAnalysis.reasoning,
        },
        confidence: colorAnalysis.harmonyScore,
        context: {
          industry: project.industry,
          brandPersonality: project.brandPersonality,
        },
      });
    }
    
    // Analyze layout patterns
    const layoutAnalysis = await this.analyzeLayout(project);
    if (layoutAnalysis.usabilityScore > 0.85) {
      patterns.push({
        type: 'layout',
        name: 'High-Converting Layout',
        content: {
          structure: layoutAnalysis.structure,
          sections: layoutAnalysis.sections,
          ctaPlacement: layoutAnalysis.ctaPlacement,
        },
        confidence: layoutAnalysis.usabilityScore,
        context: {
          deviceType: 'all',
          industry: project.industry,
        },
      });
    }
    
    return patterns;
  }
  
  private async extractContentPatterns(
    project: Project
  ): Promise<ContentPattern[]> {
    const patterns: ContentPattern[] = [];
    const content = project.generatedAssets.filter(a => a.type === 'content');
    
    for (const asset of content) {
      const analysis = await this.analyzeContent(asset);
      
      if (analysis.engagementScore > 0.8) {
        patterns.push({
          type: 'content',
          name: `High-Engagement ${asset.section}`,
          content: {
            structure: analysis.structure,
            tone: analysis.tone,
            keyPhrases: analysis.keyPhrases,
            wordCount: analysis.wordCount,
            readabilityScore: analysis.readabilityScore,
          },
          confidence: analysis.engagementScore,
          context: {
            section: asset.section,
            industry: project.industry,
            targetAudience: project.targetAudience,
          },
        });
      }
    }
    
    return patterns;
  }
}
```

### Learning from Failures

```typescript
// packages/memory/src/failure-analyzer.ts
export class FailureAnalyzer {
  async analyzeFailure(
    project: Project,
    evaluation: WebsiteEvaluation
  ): Promise<FailurePattern[]> {
    const failures: FailurePattern[] = [];
    
    // Identify what went wrong
    for (const grade of evaluation.grades) {
      if (grade.score < 0.6) {
        const pattern = await this.extractFailurePattern(
          project,
          grade
        );
        
        failures.push({
          type: 'failure',
          dimension: grade.dimension,
          issues: grade.issues,
          rootCause: await this.identifyRootCause(project, grade),
          preventionStrategy: await this.generatePreventionStrategy(grade),
          confidence: 1 - grade.score, // Higher confidence for worse failures
          context: {
            industry: project.industry,
            agentRole: grade.agentId,
            iteration: evaluation.iteration,
          },
        });
      }
    }
    
    return failures;
  }
  
  private async identifyRootCause(
    project: Project,
    grade: QualityGrade
  ): Promise<string> {
    // Analyze agent execution logs
    const agentLogs = await this.getAgentLogs(
      project.id,
      grade.agentId
    );
    
    // Use Claude to analyze root cause
    const analysis = await this.claude.analyze({
      prompt: `
        Analyze why this agent failed:
        Grade: ${JSON.stringify(grade)}
        Agent Logs: ${JSON.stringify(agentLogs)}
        
        Identify the root cause in one sentence.
      `,
    });
    
    return analysis.rootCause;
  }
}
```

## Knowledge Retrieval

### RAG Pipeline Implementation

```typescript
// packages/memory/src/rag-pipeline.ts
import { LlamaIndex, Document, VectorStoreIndex } from 'llamaindex';

export class RAGPipeline {
  private index: VectorStoreIndex;
  
  async initialize(tenantId: string) {
    // Load memories from database
    const memories = await this.loadMemories(tenantId);
    
    // Create documents
    const documents = memories.map(memory => 
      new Document({
        id: memory.id,
        text: memory.content,
        metadata: {
          type: memory.memory_type,
          source: memory.source_type,
          industry: memory.industry,
          success_score: memory.success_score,
          created_at: memory.created_at,
        },
      })
    );
    
    // Create index
    this.index = await VectorStoreIndex.fromDocuments(documents, {
      serviceContext: {
        llm: new Claude3(),
        embedModel: new OpenAIEmbedding(),
      },
    });
  }
  
  async retrieve(
    query: string,
    context: RetrievalContext
  ): Promise<RetrievedMemory[]> {
    // Build contextual query
    const enhancedQuery = this.enhanceQuery(query, context);
    
    // Retrieve relevant documents
    const retriever = this.index.asRetriever({
      similarityTopK: context.topK || 10,
      filters: this.buildFilters(context),
    });
    
    const nodes = await retriever.retrieve(enhancedQuery);
    
    // Rerank by recency and relevance
    const reranked = await this.rerank(nodes, context);
    
    // Convert to memories
    return reranked.map(node => ({
      id: node.id,
      content: node.text,
      relevanceScore: node.score,
      metadata: node.metadata,
      reasoning: this.explainRelevance(node, query),
    }));
  }
  
  private enhanceQuery(
    query: string,
    context: RetrievalContext
  ): string {
    const parts = [query];
    
    if (context.industry) {
      parts.push(`Industry: ${context.industry}`);
    }
    
    if (context.agentRole) {
      parts.push(`Agent: ${context.agentRole}`);
    }
    
    if (context.projectType) {
      parts.push(`Project Type: ${context.projectType}`);
    }
    
    return parts.join(' ');
  }
  
  private async rerank(
    nodes: RetrievalNode[],
    context: RetrievalContext
  ): Promise<RetrievalNode[]> {
    // Calculate composite score
    const scored = nodes.map(node => {
      let score = node.score;
      
      // Boost recent memories
      const age = Date.now() - new Date(node.metadata.created_at).getTime();
      const ageBoost = Math.exp(-age / (30 * 24 * 60 * 60 * 1000)); // 30 day half-life
      score *= (1 + ageBoost * 0.2);
      
      // Boost successful patterns
      score *= (1 + node.metadata.success_score * 0.3);
      
      // Boost industry match
      if (node.metadata.industry === context.industry) {
        score *= 1.2;
      }
      
      return { ...node, adjustedScore: score };
    });
    
    // Sort by adjusted score
    return scored.sort((a, b) => b.adjustedScore - a.adjustedScore);
  }
}
```

### Memory-Augmented Agent

```typescript
// packages/agents/shared/memory-augmented-agent.ts
export abstract class MemoryAugmentedAgent extends BaseAgent {
  protected memoryService: MemoryService;
  protected ragPipeline: RAGPipeline;
  
  async execute(input: AgentInput): Promise<AgentOutput> {
    // Retrieve relevant memories
    const memories = await this.retrieveMemories(input);
    
    // Augment prompt with memories
    const augmentedPrompt = this.augmentPrompt(input.prompt, memories);
    
    // Execute with enhanced context
    const output = await this.executeWithMemory({
      ...input,
      prompt: augmentedPrompt,
      memories,
    });
    
    // Learn from execution
    await this.learnFromExecution(input, output);
    
    return output;
  }
  
  private async retrieveMemories(
    input: AgentInput
  ): Promise<RetrievedMemory[]> {
    const context: RetrievalContext = {
      industry: input.project.industry,
      agentRole: this.role,
      projectType: input.project.type,
      topK: 5,
    };
    
    // Retrieve memories
    const memories = await this.ragPipeline.retrieve(
      input.prompt,
      context
    );
    
    // Log memory access
    for (const memory of memories) {
      await this.memoryService.logAccess(memory.id, {
        accessedBy: this.role,
        accessType: 'read',
        relevanceScore: memory.relevanceScore,
      });
    }
    
    return memories;
  }
  
  private augmentPrompt(
    originalPrompt: string,
    memories: RetrievedMemory[]
  ): string {
    if (memories.length === 0) return originalPrompt;
    
    const memoryContext = memories
      .map(m => `[Memory ${m.relevanceScore.toFixed(2)}]: ${m.content}`)
      .join('\n');
    
    return `
      ${originalPrompt}
      
      ## Relevant Past Experiences:
      ${memoryContext}
      
      Consider these past experiences when generating your response, but adapt them to the current context.
    `;
  }
  
  private async learnFromExecution(
    input: AgentInput,
    output: AgentOutput
  ): Promise<void> {
    // Only learn from successful executions
    if (output.confidence < 0.7) return;
    
    // Extract patterns from output
    const patterns = await this.extractPatterns(input, output);
    
    // Store as memories
    for (const pattern of patterns) {
      await this.memoryService.createMemory({
        tenantId: input.tenantId,
        memoryType: 'pattern',
        sourceType: 'agent',
        sourceId: `${this.role}:${input.executionId}`,
        content: pattern.description,
        industry: input.project.industry,
        agentRole: this.role,
        projectType: input.project.type,
        successScore: output.confidence,
        confidenceScore: pattern.confidence,
        metadata: {
          input: input.prompt,
          output: output.content,
          pattern: pattern.data,
        },
        tags: pattern.tags,
      });
    }
  }
}
```

## Cross-Project Learning

### Pattern Aggregation

```typescript
// packages/memory/src/cross-project-learner.ts
export class CrossProjectLearner {
  async aggregatePatterns(
    tenantId: string,
    timeWindow: TimeWindow = '30d'
  ): Promise<AggregatedPatterns> {
    // Get all successful projects in time window
    const projects = await this.getSuccessfulProjects(
      tenantId,
      timeWindow
    );
    
    // Extract patterns from each project
    const allPatterns: Pattern[] = [];
    for (const project of projects) {
      const patterns = await this.extractProjectPatterns(project);
      allPatterns.push(...patterns);
    }
    
    // Cluster similar patterns
    const clusters = await this.clusterPatterns(allPatterns);
    
    // Identify meta-patterns
    const metaPatterns = await this.identifyMetaPatterns(clusters);
    
    // Generate insights
    const insights = await this.generateInsights(metaPatterns);
    
    return {
      patterns: metaPatterns,
      insights,
      projectCount: projects.length,
      confidence: this.calculateConfidence(metaPatterns),
    };
  }
  
  private async clusterPatterns(
    patterns: Pattern[]
  ): Promise<PatternCluster[]> {
    // Generate embeddings for patterns
    const embeddings = await Promise.all(
      patterns.map(p => this.generateEmbedding(p.content))
    );
    
    // Perform clustering (using DBSCAN)
    const clusters = await this.dbscan(embeddings, {
      epsilon: 0.15, // Similarity threshold
      minPoints: 3,  // Minimum cluster size
    });
    
    // Group patterns by cluster
    return clusters.map(cluster => ({
      id: crypto.randomUUID(),
      patterns: cluster.points.map(i => patterns[i]),
      centroid: cluster.centroid,
      coherence: cluster.coherence,
    }));
  }
  
  private async identifyMetaPatterns(
    clusters: PatternCluster[]
  ): Promise<MetaPattern[]> {
    const metaPatterns: MetaPattern[] = [];
    
    for (const cluster of clusters) {
      // Analyze cluster for common themes
      const analysis = await this.analyzeCluster(cluster);
      
      if (analysis.coherence > 0.8) {
        metaPatterns.push({
          id: crypto.randomUUID(),
          name: analysis.name,
          description: analysis.description,
          patterns: cluster.patterns,
          frequency: cluster.patterns.length,
          successRate: this.calculateSuccessRate(cluster.patterns),
          industries: [...new Set(cluster.patterns.map(p => p.industry))],
          conditions: analysis.conditions,
          recommendations: analysis.recommendations,
        });
      }
    }
    
    return metaPatterns;
  }
}
```

### Continuous Improvement

```typescript
// packages/memory/src/continuous-improvement.ts
export class ContinuousImprovementEngine {
  private scheduler: CronJob;
  
  async initialize() {
    // Schedule regular learning cycles
    this.scheduler = new CronJob('0 0 * * *', async () => {
      await this.runLearningCycle();
    });
    
    this.scheduler.start();
  }
  
  private async runLearningCycle() {
    console.log('Starting learning cycle...');
    
    // Get all tenants
    const tenants = await this.getTenants();
    
    for (const tenant of tenants) {
      try {
        // Aggregate patterns
        const patterns = await this.learner.aggregatePatterns(
          tenant.id,
          '7d'
        );
        
        // Update knowledge base
        await this.updateKnowledgeBase(tenant.id, patterns);
        
        // Prune outdated memories
        await this.pruneMemories(tenant.id);
        
        // Generate recommendations
        const recommendations = await this.generateRecommendations(
          tenant.id,
          patterns
        );
        
        // Notify about insights
        if (recommendations.length > 0) {
          await this.notifyInsights(tenant.id, recommendations);
        }
      } catch (error) {
        console.error(`Learning cycle failed for tenant ${tenant.id}:`, error);
      }
    }
    
    console.log('Learning cycle completed');
  }
  
  private async pruneMemories(tenantId: string) {
    // Remove memories that haven't been accessed recently
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90); // 90 days
    
    await this.db.query(`
      DELETE FROM agent_memories
      WHERE tenant_id = $1
        AND last_accessed < $2
        AND usage_count < 3
        AND success_score < 0.5
    `, [tenantId, cutoffDate]);
    
    // Decay importance of older memories
    await this.db.query(`
      UPDATE agent_memories
      SET confidence_score = confidence_score * 0.95
      WHERE tenant_id = $1
        AND created_at < NOW() - INTERVAL '30 days'
    `, [tenantId]);
  }
}
```

## Industry Knowledge Graphs

### Graph Database Integration

```typescript
// packages/memory/src/knowledge-graph.ts
import neo4j from 'neo4j-driver';

export class KnowledgeGraphService {
  private driver: neo4j.Driver;
  
  constructor() {
    this.driver = neo4j.driver(
      process.env.NEO4J_URI,
      neo4j.auth.basic(
        process.env.NEO4J_USER,
        process.env.NEO4J_PASSWORD
      )
    );
  }
  
  async addPattern(pattern: Pattern): Promise<void> {
    const session = this.driver.session();
    
    try {
      // Create pattern node
      await session.run(`
        MERGE (p:Pattern {id: $id})
        SET p.name = $name,
            p.type = $type,
            p.content = $content,
            p.industry = $industry,
            p.confidence = $confidence,
            p.created_at = datetime()
      `, {
        id: pattern.id,
        name: pattern.name,
        type: pattern.type,
        content: pattern.content,
        industry: pattern.industry,
        confidence: pattern.confidence,
      });
      
      // Link to industry
      await session.run(`
        MATCH (p:Pattern {id: $patternId})
        MERGE (i:Industry {name: $industry})
        MERGE (p)-[:APPLIES_TO]->(i)
      `, {
        patternId: pattern.id,
        industry: pattern.industry,
      });
      
      // Link to components
      for (const component of pattern.components || []) {
        await session.run(`
          MATCH (p:Pattern {id: $patternId})
          MERGE (c:Component {id: $componentId})
          SET c.name = $name, c.type = $type
          MERGE (p)-[:USES]->(c)
        `, {
          patternId: pattern.id,
          componentId: component.id,
          name: component.name,
          type: component.type,
        });
      }
      
      // Find and link similar patterns
      await this.linkSimilarPatterns(pattern);
      
    } finally {
      await session.close();
    }
  }
  
  async queryPatterns(
    query: GraphQuery
  ): Promise<Pattern[]> {
    const session = this.driver.session();
    
    try {
      const cypher = this.buildCypherQuery(query);
      const result = await session.run(cypher, query.params);
      
      return result.records.map(record => 
        this.recordToPattern(record)
      );
    } finally {
      await session.close();
    }
  }
  
  private buildCypherQuery(query: GraphQuery): string {
    let cypher = 'MATCH (p:Pattern)';
    const conditions: string[] = [];
    
    if (query.industry) {
      cypher += '-[:APPLIES_TO]->(i:Industry)';
      conditions.push('i.name = $industry');
    }
    
    if (query.type) {
      conditions.push('p.type = $type');
    }
    
    if (query.minConfidence) {
      conditions.push('p.confidence >= $minConfidence');
    }
    
    if (conditions.length > 0) {
      cypher += ' WHERE ' + conditions.join(' AND ');
    }
    
    cypher += ' RETURN p ORDER BY p.confidence DESC LIMIT $limit';
    
    return cypher;
  }
  
  async findPath(
    from: string,
    to: string,
    maxHops: number = 3
  ): Promise<PatternPath[]> {
    const session = this.driver.session();
    
    try {
      const result = await session.run(`
        MATCH path = shortestPath(
          (start:Pattern {id: $from})-[*..${maxHops}]-(end:Pattern {id: $to})
        )
        RETURN path
      `, { from, to });
      
      return result.records.map(record => 
        this.recordToPath(record.get('path'))
      );
    } finally {
      await session.close();
    }
  }
}
```

---

**Next Steps:**
1. Set up pgvector in PostgreSQL
2. Configure embedding generation pipeline
3. Implement memory formation triggers
4. Set up RAG pipeline with LlamaIndex
5. Create knowledge graph visualization

This semantic memory system enables:
- Organizational learning across projects
- Pattern recognition and reuse
- Continuous improvement
- Industry-specific knowledge accumulation
- Intelligent agent decision-making based on past experiences

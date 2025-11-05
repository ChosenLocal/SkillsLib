# Deployment Guide v2.0

Complete guide for deploying the Business Automation System v2.0 with edge computing, streaming, and multi-region support.

## Table of Contents
1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Database Deployment](#database-deployment)
4. [Edge Function Deployment](#edge-function-deployment)
5. [Main Application Deployment](#main-application-deployment)
6. [Monitoring Setup](#monitoring-setup)
7. [Post-Deployment Verification](#post-deployment-verification)

## Pre-Deployment Checklist

### Required Services
```bash
# Check all required services are configured
./scripts/check-deployment-readiness.sh
```

**Essential Services:**
- [ ] PostgreSQL 16+ with pgvector extension
- [ ] Redis/Upstash for caching and streams
- [ ] Anthropic Claude API access
- [ ] OpenAI API for embeddings
- [ ] Cloudflare account (Workers, KV, R2)
- [ ] Vercel account (or alternative hosting)
- [ ] Temporal server (or Docker)

### Environment Variables
```bash
# Validate all required environment variables
pnpm run validate:env

# Generate production secrets
./scripts/generate-secrets.sh > .env.production
```

## Infrastructure Setup

### 1. Multi-Region Database Setup

```bash
# Primary Database (US East)
fly postgres create \
  --name business-automation-db \
  --region iad \
  --initial-cluster-size 3 \
  --vm-size dedicated-cpu-2x

# Read Replicas
fly postgres create-replica \
  --region sfo  # US West
fly postgres create-replica \
  --region lhr  # Europe
```

### 2. Vector Database Configuration

```sql
-- Enable pgvector on production database
CREATE EXTENSION IF NOT EXISTS vector;

-- Create optimized indexes
CREATE INDEX CONCURRENTLY idx_memories_embedding_l2 
  ON agent_memories 
  USING ivfflat (embedding vector_l2_ops)
  WITH (lists = 200);

-- Optimize for production workload
ALTER TABLE agent_memories SET (fillfactor = 90);
VACUUM ANALYZE agent_memories;
```

### 3. Redis Cluster Setup

```yaml
# docker-compose.redis.yml
version: '3.8'
services:
  redis-node-1:
    image: redis:7-alpine
    command: redis-server --cluster-enabled yes --cluster-config-file nodes.conf
    volumes:
      - redis-data-1:/data
    ports:
      - "7000:7000"
      
  redis-node-2:
    image: redis:7-alpine
    command: redis-server --cluster-enabled yes --cluster-config-file nodes.conf
    volumes:
      - redis-data-2:/data
    ports:
      - "7001:7001"
      
  redis-node-3:
    image: redis:7-alpine
    command: redis-server --cluster-enabled yes --cluster-config-file nodes.conf
    volumes:
      - redis-data-3:/data
    ports:
      - "7002:7002"

volumes:
  redis-data-1:
  redis-data-2:
  redis-data-3:
```

### 4. Temporal Deployment

```yaml
# temporal-docker-compose.yml
version: '3.8'
services:
  temporal:
    image: temporalio/auto-setup:latest
    ports:
      - "7233:7233"
    environment:
      - DB=postgresql
      - DB_PORT=5432
      - POSTGRES_USER=temporal
      - POSTGRES_PWD=temporal
      - POSTGRES_SEEDS=postgres
    depends_on:
      - postgres
      
  temporal-web:
    image: temporalio/web:latest
    ports:
      - "8080:8080"
    environment:
      - TEMPORAL_GRPC_ENDPOINT=temporal:7233
```

## Database Deployment

### Migration Strategy

```bash
# 1. Create backup of current database
pg_dump $CURRENT_DATABASE_URL > backup_$(date +%Y%m%d).sql

# 2. Run migrations with transaction
pnpm db:migrate:prod --transaction

# 3. Verify migration
pnpm db:verify

# 4. Seed production data (if needed)
pnpm db:seed:prod --safe
```

### Zero-Downtime Migration

```typescript
// scripts/zero-downtime-migration.ts
import { migrate } from '@database/migrator';

async function zeroDowntimeMigration() {
  // Phase 1: Add new columns (backward compatible)
  await migrate('add-columns');
  
  // Phase 2: Deploy new code
  console.log('Deploy new application version now');
  await waitForDeployment();
  
  // Phase 3: Migrate data
  await migrate('migrate-data', { batch: 1000 });
  
  // Phase 4: Drop old columns
  await migrate('cleanup');
}
```

## Edge Function Deployment

### Cloudflare Workers

```bash
# Deploy all edge functions
cd edge/cloudflare

# Install dependencies
pnpm install

# Build workers
pnpm build

# Deploy to production
wrangler deploy --env production

# Configure secrets
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put OPENAI_API_KEY

# Set up KV namespaces
wrangler kv:namespace create "AGENT_CACHE" --env production
wrangler kv:namespace create "AGENT_STATE" --env production

# Configure R2 buckets
wrangler r2 bucket create agent-assets
```

### Vercel Edge Functions

```bash
# Deploy with Vercel CLI
vercel --prod

# Configure edge functions
cat > vercel.json << EOF
{
  "functions": {
    "app/api/edge/**/*.ts": {
      "runtime": "edge",
      "regions": ["iad1", "sfo1", "lhr1", "sin1"],
      "maxDuration": 30
    }
  },
  "rewrites": [
    {
      "source": "/edge/:path*",
      "destination": "/api/edge/:path*"
    }
  ],
  "crons": [
    {
      "path": "/api/cron/memory-optimization",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/pattern-learning",
      "schedule": "0 */6 * * *"
    }
  ]
}
EOF

vercel --prod
```

## Main Application Deployment

### Next.js Production Build

```bash
# Build optimization
NODE_ENV=production pnpm build

# Analyze bundle size
ANALYZE=true pnpm build

# Generate static pages
pnpm build:static
```

### Docker Deployment

```dockerfile
# Dockerfile.production
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN cpm install -g pnpm && pnpm install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
```

### Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: business-automation
spec:
  replicas: 3
  selector:
    matchLabels:
      app: business-automation
  template:
    metadata:
      labels:
        app: business-automation
    spec:
      containers:
      - name: app
        image: your-registry/business-automation:v2.0.0
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
        readinessProbe:
          httpGet:
            path: /api/ready
            port: 3000
          initialDelaySeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: business-automation-service
spec:
  selector:
    app: business-automation
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

### Auto-Scaling Configuration

```yaml
# k8s/autoscaling.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: business-automation-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: business-automation
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
```

## Monitoring Setup

### Observability Stack

```bash
# Deploy monitoring infrastructure
docker-compose -f monitoring/docker-compose.yml up -d

# Services included:
# - Prometheus (metrics)
# - Grafana (dashboards)
# - Jaeger (tracing)
# - Loki (logs)
```

### LangFuse Configuration

```typescript
// lib/monitoring/langfuse.ts
import { Langfuse } from 'langfuse';

export const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_HOST,
  flushAt: 1,
  flushInterval: 10000,
});

// Trace all agent executions
export function traceAgent(agentName: string) {
  return langfuse.trace({
    name: agentName,
    userId: getCurrentUserId(),
    sessionId: getSessionId(),
    metadata: {
      environment: process.env.NODE_ENV,
      version: process.env.APP_VERSION,
    },
  });
}
```

### Custom Metrics

```typescript
// lib/monitoring/metrics.ts
import { Counter, Histogram, register } from 'prom-client';

export const agentExecutionCounter = new Counter({
  name: 'agent_executions_total',
  help: 'Total number of agent executions',
  labelNames: ['agent', 'status', 'tenant'],
});

export const agentDurationHistogram = new Histogram({
  name: 'agent_duration_seconds',
  help: 'Agent execution duration in seconds',
  labelNames: ['agent'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
});

export const tokenUsageCounter = new Counter({
  name: 'llm_tokens_used_total',
  help: 'Total LLM tokens consumed',
  labelNames: ['model', 'tenant'],
});

register.registerMetric(agentExecutionCounter);
register.registerMetric(agentDurationHistogram);
register.registerMetric(tokenUsageCounter);
```

## Post-Deployment Verification

### Health Checks

```bash
# Run comprehensive health checks
./scripts/health-check.sh production

# Expected output:
# ✅ Database connection: OK
# ✅ Redis connection: OK
# ✅ Temporal connection: OK
# ✅ Edge functions: OK (4/4 regions)
# ✅ API endpoints: OK (42/42 passing)
# ✅ WebSocket: OK
# ✅ Memory usage: 45% (OK)
# ✅ CPU usage: 23% (OK)
```

### Load Testing

```bash
# Run load tests with k6
k6 run --vus 100 --duration 5m tests/load/website-generation.js

# Expected metrics:
# - p95 response time < 2s
# - Error rate < 0.1%
# - Throughput > 100 req/s
```

### Smoke Tests

```typescript
// tests/smoke/production.test.ts
describe('Production Smoke Tests', () => {
  test('Can generate simple website', async () => {
    const project = await createProject({
      type: 'website',
      industry: 'roofing',
    });
    
    const result = await generateWebsite(project.id);
    
    expect(result.status).toBe('completed');
    expect(result.qualityScore).toBeGreaterThan(0.8);
  });
  
  test('Edge functions responding', async () => {
    const regions = ['iad', 'sfo', 'lhr', 'sin'];
    
    for (const region of regions) {
      const response = await fetch(
        `https://${region}.edge.yourdomain.com/health`
      );
      expect(response.ok).toBe(true);
    }
  });
});
```

## Rollback Procedures

### Database Rollback

```bash
# Rollback to previous migration
pnpm db:rollback

# Restore from backup if needed
pg_restore -d $DATABASE_URL backup_20240301.sql
```

### Application Rollback

```bash
# Vercel rollback
vercel rollback

# Kubernetes rollback
kubectl rollout undo deployment/business-automation

# Docker rollback
docker service update --image your-registry/business-automation:v1.9.0 business-automation
```

## Security Hardening

### Production Security Checklist

- [ ] All secrets in environment variables
- [ ] Database connections use SSL
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] CSP headers set
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention verified
- [ ] XSS protection enabled
- [ ] Authentication required on all routes
- [ ] Audit logging enabled

### WAF Configuration

```nginx
# nginx/security.conf
# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;

# Security headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';" always;

# Block suspicious requests
if ($http_user_agent ~* (crawler|bot|spider)) {
    return 403;
}

if ($request_method !~ ^(GET|HEAD|POST|PUT|DELETE|OPTIONS)$) {
    return 405;
}
```

## Disaster Recovery

### Backup Strategy

```bash
# Automated daily backups
0 2 * * * /scripts/backup-database.sh
0 3 * * * /scripts/backup-redis.sh
0 4 * * * /scripts/backup-vectors.sh

# Verify backups
0 5 * * * /scripts/verify-backups.sh
```

### Recovery Time Objectives

- **RTO**: 1 hour
- **RPO**: 15 minutes
- **Backup retention**: 30 days
- **Geographic redundancy**: 3 regions

---

**Deployment Complete! 🚀**

Monitor your deployment at:
- Application: https://app.yourdomain.com
- Monitoring: https://grafana.yourdomain.com
- Tracing: https://langfuse.yourdomain.com

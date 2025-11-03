# Getting Started Guide

This guide will help you set up and run the Business Automation System locally.

## Prerequisites

### Required Software

1. **Node.js 20+ LTS**
   ```bash
   node --version  # Should be >= 20.0.0
   ```
   Download from: https://nodejs.org/

2. **pnpm 9.0+**
   ```bash
   npm install -g pnpm@latest
   pnpm --version  # Should be >= 9.0.0
   ```

3. **PostgreSQL 16+**
   ```bash
   # macOS (via Homebrew)
   brew install postgresql@16
   brew services start postgresql@16

   # Ubuntu/Debian
   sudo apt-get install postgresql-16

   # Or use Docker
   docker run --name postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:16
   ```

4. **Redis 7+**
   ```bash
   # macOS (via Homebrew)
   brew install redis
   brew services start redis

   # Ubuntu/Debian
   sudo apt-get install redis-server

   # Or use Docker
   docker run --name redis -p 6379:6379 -d redis:7

   # Or use Upstash (cloud Redis)
   # Sign up at https://upstash.com and create a Redis database
   ```

### API Keys

You'll need API keys from:

1. **Anthropic Claude API**
   - Sign up at: https://console.anthropic.com
   - Create an API key
   - Costs: Pay-as-you-go (Claude 4.5 Sonnet recommended)

2. **Industry-Specific APIs** (Optional for full features)
   - Sunlight Financial: https://partners.sunlightfinancial.com
   - SumoQuote: https://developers.sumoquote.com
   - EagleView: https://developer.eagleview.com
   - CompanyCam: https://api.companycam.com
   - See `stack-docs.md` for complete list

## Installation Steps

### 1. Navigate to Project Directory

```bash
cd /home/jack-leszczynski/Desktop/ChosenLocal/SkillsLib
```

### 2. Install Dependencies

```bash
# Install all workspace dependencies
pnpm install

# This will install dependencies for:
# - Root workspace
# - All apps (web, api, workers)
# - All packages (agents, database, schema, config, ui)
```

### 3. Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your credentials
nano .env  # or use your preferred editor
```

**Minimum required variables:**

```bash
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/business_automation"

# Redis (choose one)
REDIS_URL="redis://localhost:6379"
# OR for Upstash:
# UPSTASH_REDIS_REST_URL="https://your-redis.upstash.io"
# UPSTASH_REDIS_REST_TOKEN="your-token"

# Authentication
NEXTAUTH_SECRET="generate-a-random-32-character-string-here"
NEXTAUTH_URL="http://localhost:3000"

# AI Services (required for agents)
CLAUDE_API_KEY="sk-ant-api03-..."
ANTHROPIC_API_KEY="sk-ant-api03-..."  # Same as CLAUDE_API_KEY
```

**Generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

### 4. Set Up Database

```bash
# Create the database
createdb business_automation

# Generate Prisma client
pnpm db:generate

# Run database migrations
pnpm db:migrate

# Seed the database with demo data
pnpm db:seed
```

**Expected output:**
```
🌱 Seeding database...
✅ Created tenant: Demo Contractor Company
✅ Created user: demo@contractor.com
✅ Created company profile: ABC Roofing & Restoration
✅ Created workflow definition: Website Generation - 30+ Agent
🎉 Database seeded successfully!
```

### 5. Start Development Servers

```bash
# Start all apps in development mode
pnpm dev
```

This will start:
- **Web Dashboard** - http://localhost:3000
- **API Server** - http://localhost:3001
- **Workers** - Background job processors

## Verify Installation

### 1. Check Database Connection

```bash
# Open Prisma Studio to browse your database
pnpm db:studio
```

Opens at http://localhost:5555

### 2. Access Web Dashboard

Open http://localhost:3000 in your browser.

You should see the dashboard login page.

**Demo credentials:**
- Email: `demo@contractor.com`
- Password: (Set up authentication in Phase 2)

### 3. Check API Health

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "database": "connected",
  "redis": "connected"
}
```

## Common Issues

### Port Already in Use

If ports 3000, 3001, or 6379 are already in use:

```bash
# Find process using port
lsof -ti:3000 | xargs kill -9

# Or change ports in .env
PORT=3002
API_PORT=3003
```

### Database Connection Error

```bash
# Check PostgreSQL is running
pg_isready

# Restart PostgreSQL
# macOS
brew services restart postgresql@16

# Ubuntu/Debian
sudo systemctl restart postgresql
```

### Redis Connection Error

```bash
# Check Redis is running
redis-cli ping  # Should return "PONG"

# Restart Redis
# macOS
brew services restart redis

# Ubuntu/Debian
sudo systemctl restart redis
```

### Prisma Client Not Generated

```bash
# Regenerate Prisma client
pnpm db:generate

# Clear cache and reinstall
rm -rf node_modules
pnpm install
```

## Next Steps

Once installation is complete:

1. ✅ **Explore the Dashboard** - Familiarize yourself with the UI
2. ✅ **Create a Test Project** - Try generating a simple website
3. ✅ **Monitor Agent Execution** - Watch agents work in real-time
4. ✅ **Review Generated Output** - Check the quality of generated websites
5. ✅ **Read Documentation** - Dive into architecture and agent guides

## Development Workflow

### Running Tests

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Watch mode
pnpm test --watch
```

### Type Checking

```bash
# Check all TypeScript types
pnpm type-check
```

### Linting

```bash
# Run ESLint
pnpm lint

# Fix linting issues
pnpm lint --fix
```

### Formatting

```bash
# Check formatting
pnpm format:check

# Fix formatting
pnpm format
```

### Database Commands

```bash
# Generate Prisma client
pnpm db:generate

# Create a new migration
pnpm db:migrate

# Push schema changes (development only)
pnpm db:push

# Open Prisma Studio
pnpm db:studio

# Seed database
pnpm db:seed
```

### Building for Production

```bash
# Build all apps and packages
pnpm build

# Start production servers
pnpm start
```

## Getting Help

- **Documentation**: See `/docs` directory
- **Architecture**: Read `docs/architecture/README.md`
- **Agent Guides**: Check `docs/agent-guides/README.md`
- **API Reference**: Review `docs/api-reference/README.md`
- **Stack Docs**: Industry-specific APIs in `stack-docs.md`

## What's Next?

Now that your development environment is set up:

1. **Explore the Codebase** - Familiarize yourself with the project structure
2. **Run Example Workflows** - Test the website generation pipeline
3. **Add New Agents** - Extend the system with custom agents
4. **Customize Templates** - Modify website generation templates
5. **Integrate APIs** - Connect industry-specific services

Happy coding! 🚀

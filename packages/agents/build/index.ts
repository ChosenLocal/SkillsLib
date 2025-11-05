// packages/agents/build/index.ts
/**
 * Build Tier Agents
 *
 * These agents generate actual production code from Strategy Tier specifications.
 * They transform abstract plans into concrete Next.js 16 + React 19 applications.
 *
 * Execution Order:
 * 1. Scaffolder (core, priority 100) - Creates Next.js project structure
 * 2. Component Worker (ephemeral, priority 70-90, parallel) - Generates React components
 * 3. Page Assembler (core, priority 60-80) - Assembles pages from components
 * 4. Integration Specialist (core, priority 50-70) - Integrates external services (TODO)
 *
 * Core vs Ephemeral:
 * - Core agents run once per project (Scaffolder, Page Assembler)
 * - Ephemeral agents spawn many parallel instances (Component Worker - one per component)
 */

export * from './scaffolder';
export * from './component-worker';
export * from './page-assembler';

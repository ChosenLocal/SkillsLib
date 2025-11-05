// packages/agents/strategy/index.ts
/**
 * Strategy Tier Agents
 *
 * These agents operate in the first tier of the 3-tier architecture.
 * They transform business requirements into detailed technical specifications
 * that guide all downstream Build and Quality tier agents.
 *
 * Execution Order:
 * 1. Planner - CompanyProfile → SiteSpec
 * 2. IA Architect - SiteSpec → IAPlan (can run parallel with Brand Interpreter)
 * 3. Brand Interpreter - CompanyProfile + SiteSpec → DesignSpec (can run parallel with IA Architect)
 * 4. Backlog Manager - SiteSpec + IAPlan + DesignSpec → WorkQueue
 */

export * from './planner';
export * from './ia-architect';
export * from './brand-interpreter';
export * from './backlog-manager';

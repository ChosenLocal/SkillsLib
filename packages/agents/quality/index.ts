// packages/agents/quality/index.ts
/**
 * Quality Tier Agents
 *
 * These agents validate, analyze, and fix generated code to ensure
 * production-ready quality.
 *
 * Execution Order:
 * 1. Static Analyzer (core) - Runs tsc, eslint, build, Lighthouse
 * 2. Fixer (core) - Applies patches within budget constraints
 *
 * The Quality Tier ensures:
 * - Type safety (TypeScript)
 * - Code quality (ESLint)
 * - Build success (Next.js)
 * - Performance (Lighthouse ≥90)
 * - Accessibility (WCAG AAA, Lighthouse ≥95)
 * - SEO (Lighthouse ≥95)
 * - Bundle size limits
 */

export * from './static-analyzer';
export * from './fixer';

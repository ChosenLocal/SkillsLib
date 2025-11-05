/**
 * tRPC Root Router Type
 *
 * DEPRECATED: This file is kept for backward compatibility during migration.
 * The actual tRPC router now lives in apps/api/src/routers/index.ts
 *
 * The Next.js app (apps/web) now acts as a pure client that connects to
 * the standalone API server at port 3001.
 */

/**
 * Import AppRouter type from the standalone API server
 * This provides full type safety for the tRPC client
 */
export type { AppRouter } from '@business-automation/api/src/routers';

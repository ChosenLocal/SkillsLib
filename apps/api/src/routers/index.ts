/**
 * Main tRPC Router
 *
 * Combines all feature routers into a single app router.
 * This is the main entry point for all tRPC procedures in the API.
 */

import { router } from '../trpc.js';
import { authRouter } from './auth.js';
import { projectRouter } from './project.js';
import { companyProfileRouter } from './company-profile.js';
import { subscriptionRouter } from './subscription.js';
import { tenantRouter } from './tenant.js';
import { workflowRouter } from './workflow.js';
import { agentRouter } from './agent.js';
import { discoveryRouter } from './discovery.js';

/**
 * Main app router combining all feature routers
 */
export const appRouter = router({
  auth: authRouter,
  project: projectRouter,
  companyProfile: companyProfileRouter,
  subscription: subscriptionRouter,
  tenant: tenantRouter,
  workflow: workflowRouter,
  agent: agentRouter,
  discovery: discoveryRouter,
});

/**
 * Export type definition for the router
 * This is used by the tRPC client in apps/web for type inference
 */
export type AppRouter = typeof appRouter;

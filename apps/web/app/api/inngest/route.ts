import { serve } from 'inngest/next';
import { inngest, allFunctions } from '@business-automation/agents/jobs';

/**
 * Inngest API endpoint for Next.js App Router
 *
 * This endpoint handles:
 * - Inngest function registration
 * - Event webhook reception
 * - Function execution
 *
 * POST /api/inngest - Receive events and execute functions
 * GET /api/inngest - View registered functions (dev mode)
 * PUT /api/inngest - Register functions with Inngest Cloud
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: allFunctions,
});
